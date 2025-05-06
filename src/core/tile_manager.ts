import { Map, CustomLayerInterface } from 'mapbox-gl'


import { BoxLayer } from '../test/boxlayer'
import TilePicker from './tile_picker'



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
    }

    render(_: WebGL2RenderingContext, __: Array<number>) {
        const tiles = this._picker.coveringTile({
            minzoom: 5,
            maxzoom: 10,
            renderWorldCopies: true,
            isDEMTile: false
        })
        this.debugLayer?.updateTileBounds(tiles)
    }
}
