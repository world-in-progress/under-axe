import { Map, CustomLayerInterface } from 'mapbox-gl'
import { mat4 } from 'gl-matrix'

import { BoxLayer } from '../test/boxlayer'
import TilePicker from './tile_picker'
import TileSource, { type TileSourceType } from './tile_source'
import Dispatcher from '../data/message/dispatcher'
import { OverscaledTileID } from './tile_id'
import ezstore from './store'
import { getMatrices } from '../util/map_transform'

export default class TileManager implements CustomLayerInterface {
    // Base
    type: 'custom' = 'custom'
    id: string = 'tile_manager'
    renderingMode: '2d' | '3d' = '3d'

    debugMode: boolean = false
    debugLayer: BoxLayer | null = null

    // Core-Properties
    private _map: Map
    private _picker: TilePicker
    dispatcher: Dispatcher | null = null

    tileSouces = new window.Map<string, TileSource>()
    coveringTiles: OverscaledTileID[] = []

    sharingVPMatrix!: mat4

    constructor(map: Map, elevationMode: boolean = false) {
        this._map = map
        this._picker = new TilePicker(map)

        if (this.debugMode) {
            this.debugLayer = new BoxLayer('debug-layer', [])
            this._map.addLayer(this.debugLayer)
        }
    }

    onAdd(_: Map, __: WebGL2RenderingContext) {
        console.log('TileManager added !', this._map)
        ezstore.set('map', this._map)
        ezstore.set('gl', this._map.painter.context.gl)
    }

    render(_: WebGL2RenderingContext, __: Array<number>) {
        this.sharingVPMatrix = getMatrices(this._map.transform).projMatrix
        this.coveringTiles = this._picker.coveringTile({
            minzoom: 0,
            maxzoom: 22,
            renderWorldCopies: true,
            isDEMTile: false,
            roundZoom: true,
        })
        const extendTiles = this._picker.extendTileCover(this.coveringTiles)

        this.debugLayer?.updateTileBounds(this.coveringTiles)

        for (let tileSource of this.tileSouces.values()) {
            for (let overscaledTileID of this.coveringTiles) {
                tileSource.loadTile(overscaledTileID)
            }
            for (let extTileID of extendTiles) {
                tileSource.loadTile(extTileID)
            }
        }
    }

    addSource(sourceDesc: TileSourceType) {
        const tileSource = new TileSource(sourceDesc)
        tileSource._tileManager = this
        this.tileSouces.set(tileSource.id, tileSource)
    }

    removeSource(sourceId: string) {
        const tileSource = this.tileSouces.get(sourceId)
        if (!tileSource) return

        tileSource.remove()
        this.tileSouces.delete(sourceId)
    }

    getSource(sourceId: string): TileSource | undefined {
        return this.tileSouces.get(sourceId)
    }
}
