import { Map } from "mapbox-gl"

export default class TileManager {
    // Map handler
    private _map: Map

    // Layer configuration
    type: 'custom' = 'custom'
    id: string = 'tile_manager'
    renderingMode: '2d' | '3d' = '3d'

    constructor(map: Map) {
        this._map = map
    }

    onAdd(_: Map, __: WebGL2RenderingContext) {
        console.log(this._map)
    }

    render(_: WebGL2RenderingContext, __: Array<number>) {

    }
}