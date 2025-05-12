import { Map, CustomLayerInterface } from 'mapbox-gl'
import { mat4 } from 'gl-matrix'

import { BoxLayer } from '../test/boxlayer'
import TilePicker from './tile_picker'
import TileSouce, { type TileSourceType } from './tile_source'
import Dispatcher from '../data/message/dispatcher'
import { OverscaledTileID } from './tile_id'
import ezstore from './store'
import { getMatrices } from '../util/map_transform'


export default class TileManager implements CustomLayerInterface {
    // Base
    type: 'custom' = 'custom'
    id: string = 'tile_manager'
    renderingMode: '2d' | '3d' = '3d'

    debugMode: boolean = true
    debugLayer: BoxLayer | null = null

    // Core-Properties
    private _map: Map
    private _picker: TilePicker
    dispatcher: Dispatcher | null = null

    tileSouces = new window.Map<string, TileSouce>()
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
            minzoom: 5,
            maxzoom: 14,
            renderWorldCopies: true,
            isDEMTile: false,
        })
        this.debugLayer?.updateTileBounds(this.coveringTiles)

        for (let tileSource of this.tileSouces.values()) {
            for (let overscaledTileID of this.coveringTiles) {
                tileSource.loadTile(overscaledTileID)
            }
        }
    }

    addSource(sourceDesc: TileSourceType) {
        const tileSouce = new TileSouce(sourceDesc)
        tileSouce._tileManager = this
        this.tileSouces.set(tileSouce.id, tileSouce)
    }

    removeSource(sourceId: string) {
        const tileSouce = this.tileSouces.get(sourceId)
        if (!tileSouce) return

        tileSouce.remove()
        this.tileSouces.delete(sourceId)
    }

    getSource(sourceId: string): TileSouce | undefined {
        return this.tileSouces.get(sourceId)
    }
}
