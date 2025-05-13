import { mat4 } from 'gl-matrix'
import TileManager from '../core/tile_manager'
import TileSource from '../core/tile_source'
import { createShader } from '../util/glLib'
import { getMatrices } from '../util/map_transform'

export class TileDrivenLayer implements mapboxgl.CustomLayerInterface {
    id: string
    type: 'custom' = 'custom'
    renderingMode: '3d' = '3d'
    map!: mapboxgl.Map
    ready: boolean = false

    // Tile resources
    tileManager: TileManager
    tileSource: TileSource

    // WebGL resources
    private gl: WebGL2RenderingContext | null = null
    private program: WebGLProgram | null = null
    private uMatrix: WebGLUniformLocation | null = null

    // TextLayer resources
    constructor(id: string, tileManager: TileManager) {
        this.id = id
        this.type = 'custom'
        this.renderingMode = '3d'

        tileManager.addSource({
            id: 'terrainRGB',
            type: 'raster',
            // url: 'http://127.0.0.1:8079/test/{z}/{x}/{y}.png',
            url: 'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
            // url: 'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
            // url: 'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png',
        })
        this.tileManager = tileManager
        this.tileSource = tileManager.getSource('terrainRGB')!
    }

    async onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
        this.gl = gl
        this.map = map

        this.program = await createShader(gl, '/shader/raster_tile_show.glsl')

        this.ready = true
        // this.uMatrix = gl.getUniformLocation(this.program, 'uMatrix')
    }

    render(gl: WebGL2RenderingContext, _matrix: number[]) {
        // if (!this.program || !this.vertexBuffer || !this.indexBuffer) return
        if (!this.ready) {
            this.map.triggerRepaint()
            return
        }

        const tiles = this.tileSource.coveringTiles()

        for (let rasterTile of tiles) {
            const posMatrix = rasterTile.tilePosMatrix()
            const tMVP = mat4.create()
            mat4.multiply(tMVP, this.tileManager.sharingVPMatrix, posMatrix)

            gl.useProgram(this.program)
            gl.uniformMatrix4fv(gl.getUniformLocation(this.program!, 'tMVP'), false, tMVP)
            gl.uniform1f(gl.getUniformLocation(this.program!, 'u_scale'), rasterTile.u_scale)
            gl.uniform2fv(gl.getUniformLocation(this.program!, 'u_topLeft'), rasterTile.u_topLeft)

            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, rasterTile.gpuTexture)
            gl.uniform1i(gl.getUniformLocation(this.program!, 'tileTexture'), 0)

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        }
    }
}

function debounce<T extends (...args: any) => any>(fn: T, delay: number) {
    let timer: ReturnType<typeof setTimeout> | null = null
    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            fn.apply(this, args)
        }, delay)
    }
}
