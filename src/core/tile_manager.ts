import { vec3 } from 'gl-matrix'
import { Map, CustomLayerInterface } from 'mapbox-gl'

import { getMatrices } from './map_transform'
import { Frustum, Aabb } from '../geometry'
import { MercatorCoordinate, tileAABB } from '../util'
import { BaseTile } from './tile_id'
import { BoxLayer } from '../test/boxlayer'

/////// Const //////////////////////////////////
const NUM_WORLD_COPIES = 3
const defaultConfig = {
    minTileZoom: 0,
    maxTileZoom: 24,
    elevationMode: false,
}
type TileManagerConfig = Partial<typeof defaultConfig>

type QuadTileNode = {
    wrap: number
    x: number
    y: number
    z: number
    aabb: Aabb
    maxAltitude: number
    minAltitude: number
    fullyVisible: boolean
    shouldSplit?: boolean
}
type CoveringTileNode = {
    x: number
    y: number
    z: number
    wrap: number
    distance: number // distance to camera
}

export default class TileManager implements CustomLayerInterface {
    // Base
    type: 'custom' = 'custom'
    id: string = 'tile_manager'
    renderingMode: '2d' | '3d' = '3d'

    debugMode: boolean = true
    debugLayer: BoxLayer | null = null

    // Options
    minTileZoom: number
    maxTileZoom: number
    elevationMode: boolean

    // Core-Properties
    private _map: Map
    frustum!: Frustum

    constructor(map: Map, config: TileManagerConfig = {}) {
        this._map = map

        const options = Object.assign({}, defaultConfig, config)
        this.elevationMode = options.elevationMode
        this.minTileZoom = options.minTileZoom
        this.maxTileZoom = options.maxTileZoom

        if (this.debugMode) {
            this.debugLayer = new BoxLayer('debug-layer', [])
            this._map.addLayer(this.debugLayer)
        }
    }

    onAdd(_: Map, __: WebGL2RenderingContext) {
        console.log('TileManager added !', this._map)
    }

    render(_: WebGL2RenderingContext, __: Array<number>) {
        const tiles = this.coveringTile()
        this.debugLayer?.updateTileBounds(tiles)
    }

    coveringTile(): Array<BaseTile> {
        /////// Basic variables //////////////////////////////////////////////////
        const transform = this._map.transform
        let mapZoom = transform.zoom
        if (mapZoom < this.minTileZoom) return []
        if (mapZoom > this.maxTileZoom) mapZoom = this.maxTileZoom

        const elevationMode = this.elevationMode
        const minTileZoom = this.minTileZoom
        const maxTileZoom = Math.floor(mapZoom)
        const worldSize_wd = 1 << maxTileZoom

        let minElevation = 0,
            maxElevation = 0
        if (elevationMode) {
            maxElevation = 1000 * 6000 // 6000 km, a little less than 6371 km
            minElevation = -maxElevation
        }

        /////// Map Center //////////////////////////////////////////////////////
        // Lnglat-space | Webmercator-space | WD-space
        const mapCenter_lnglat = [transform._center.lng, transform._center.lat]
        const mapCenter_wmc = MercatorCoordinate.fromLngLat(mapCenter_lnglat)
        const mapCenter_wd = [mapCenter_wmc[0] * worldSize_wd, mapCenter_wmc[1] * worldSize_wd, 0.0]
        const mapCenterAltitude = 0.0 // temporary

        /////// zAxis-translation ///////////////////////////////////////////////
        // Meter-unit | WebmercatorZ-unit | WD-Z-unit
        const meter2wmcz = MercatorCoordinate.mercatorZfromAltitude(1, mapCenter_lnglat[1]) // meter to wmc-z
        const wmcz2meter = 1.0 / meter2wmcz // wmc-z to meter
        const meter2wdz = worldSize_wd * meter2wmcz // meter -> WD-z

        /////// Camera-Pos /////////////////////////////////////////////////////
        const cameraPos_wmc = transform.getFreeCameraOptions().position
        if (!cameraPos_wmc) return []
        const cameraAltitude = cameraPos_wmc.z * wmcz2meter
        const cameraPos_wd = [worldSize_wd * cameraPos_wmc.x, worldSize_wd * cameraPos_wmc.y, cameraAltitude]
        const cameraHeight = (cameraAltitude - mapCenterAltitude) * meter2wdz // in pixel coords.

        /////// Frustum  //////////////////////////////////////////////////////
        const { invProjMatrix } = getMatrices(transform, -100.0)!
        this.frustum = Frustum.fromInvViewProjection(invProjMatrix, transform.worldSize, maxTileZoom)

        ////// Tile-Picking /////////////////////////////////////////////////////
        const stack: QuadTileNode[] = []
        let coveringTilesList: CoveringTileNode[] = []
        if (transform.renderWorldCopies) {
            for (let i = 1; i <= NUM_WORLD_COPIES; i++) {
                stack.push(rootTileNode(-i))
                stack.push(rootTileNode(i))
            }
        }
        stack.push(rootTileNode(0))

        while (stack.length > 0) {
            const node = stack.pop()!
            const x = node.x
            const y = node.y
            const z = node.z
            let fullyVisible = node.fullyVisible

            // Step 1: Make intersection check to determine [ If frustum fully contains Aabb when fullyVisible == false || undefined ]
            if (!fullyVisible) {
                const intersect = elevationMode ? node.aabb.intersects(this.frustum) : node.aabb.intersectsFlat(this.frustum)

                if (intersect === 0) continue // discard if not at all intersected

                fullyVisible = intersect === 2
            }

            // Step 2: Stop splitting and collect it [ If tile-z is maxTileZoom, or the tile is too far from the camera ]
            if (z === maxTileZoom || !shouldNodeSplit(node)) {
                /*
                    Calculate dx, dy in WD_Space
                    node.wrap << z is node.wrap * numTiles in node.z
                    if maxTileZoom is 3, node.z is 2, and node.x is 1,
                    then the size of this tile is equivalent to 2^(maxTileZoom - z) times larger than a maxTileZoom tile.
                */
                const dx = mapCenter_wd[0] - (0.5 + x + (node.wrap << z)) * (1 << (maxTileZoom - z))
                const dy = mapCenter_wd[1] - (y + 0.5)

                coveringTilesList.push({
                    x,
                    y,
                    z,
                    wrap: node.wrap,
                    distance: Math.sqrt(dx * dx + dy * dy),
                })

                continue
            }

            // Step 3: Quadrant
            for (let i = 0; i < 4; i++) {
                /*   ————————————
                    |  0  |  1  |
                    ————————————
                    |  2  |  3  |
                    ————————————  */
                const childX = (x << 1) + (i % 2)
                const childY = (y << 1) + (i >> 1)

                const aabb = node.aabb.quadrant(i)
                const child: QuadTileNode = {
                    x: childX,
                    y: childY,
                    z: z + 1,
                    aabb: aabb,
                    maxAltitude: maxElevation,
                    minAltitude: minElevation,
                    fullyVisible: fullyVisible,
                    shouldSplit: undefined,
                    wrap: node.wrap,
                }

                stack.push(child)
            }
        }

        // Sort by distance to camera
        const cover = coveringTilesList.sort((a, b) => a.distance - b.distance)
        return cover

        // local helper /////////////////////////////////////////////////
        /**
         * Creates a root tile node.
         * @param warp
         * @returns A QuadTileNode representing the world root tile.
         */
        function rootTileNode(warp: number): QuadTileNode {
            return {
                x: 0,
                y: 0,
                z: 0,
                wrap: warp,
                aabb: tileAABB(worldSize_wd, 0, 0, 0, warp, minElevation, maxElevation),
                maxAltitude: minElevation,
                minAltitude: maxElevation,
                fullyVisible: false,
            } as QuadTileNode
        }

        /**
         * Determines if the given tile node should be split based on `distance to the camera`.
         * @param node The tile node to evaluate.
         * @returns A boolean indicating whether the node should be split.
         */
        function shouldNodeSplit(node: QuadTileNode): boolean {
            if (node.z < minTileZoom) return true
            if (node.z >= maxTileZoom) return false
            if (node.shouldSplit != null) return node.shouldSplit

            const camera2corner: vec3 = [0, 0, 0]

            // Note: closest-point is cameraPos_wd if it is inside the camera AABB
            const closestCornerPoint = node.aabb.closestPoint(cameraPos_wd as vec3)
            vec3.sub(camera2corner, closestCornerPoint, cameraPos_wd as vec3)
            camera2corner[2] = elevationMode ? camera2corner[2] * meter2wdz : cameraHeight

            const closestDistance = vec3.dot(camera2corner, transform._camera.forward())

            let distToSplit = 1 << (maxTileZoom - node.z) // default mode
            // let distToSplit = (1 << maxTileZoom - node.z - 1) // lazy mode
            // let distToSplit = (1 << maxTileZoom - node.z + 1) // hurry mode

            if (closestDistance < distToSplit) {
                return true
            }

            // Border case: with tilt of 85 degrees, center could be outside max zoom distance, due to scale.
            // Ensure max zoom tiles over center.
            const closestPointToCenter = node.aabb.closestPoint(mapCenter_wd as vec3)
            return closestPointToCenter[0] === mapCenter_wd[0] && closestPointToCenter[1] === mapCenter_wd[1]
        }
    }
}
