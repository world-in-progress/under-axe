import { mat4 } from 'gl-matrix'
import { BaseTile, OverscaledTileID } from '../core/tile_id'
import { tileToBBox, tileToCenterLngLat } from '../util/tile_util'
import MercatorCoordinate from '../util/mercator_coordinate'

export class BoxLayer implements mapboxgl.CustomLayerInterface {
    id: string
    type: 'custom'
    renderingMode: '3d'
    primitiveMode: 'line' | 'fill' = 'fill'
    map!: mapboxgl.Map

    private debugKey: string = '1'
    private baseTiles: BaseTile[]
    private indices: number[] = []

    // WebGL resources
    private gl: WebGL2RenderingContext | null = null
    private program: WebGLProgram | null = null
    private vertexBuffer: WebGLBuffer | null = null
    private indexBuffer: WebGLBuffer | null = null
    private uMatrix: WebGLUniformLocation | null = null

    updateTileLable: () => void

    // TextLayer resources
    private labelGeojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [],
    }

    constructor(id: string, baseTileList: BaseTile[]) {
        this.id = id
        this.type = 'custom'
        this.renderingMode = '3d'
        this.baseTiles = baseTileList

        document.addEventListener('keydown', (e) => {
            this.debugKey = e.key
        })

        this.updateTileLable = debounce(this._updateTileLable, 50).bind(this)
    }

    onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
        this.gl = gl
        this.map = map

        // Setup for tile-fill-rendering
        const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
        gl.shaderSource(
            vertexShader,
            `#version 300 es
            layout(location = 0) in vec3 aPos;
            uniform mat4 uMatrix;
            uniform vec2 u_centerPosHigh;
            uniform vec2 u_centerPosLow;

            float hash(float x) {
                return fract(sin(x * 12.9898) * 43758.5453123);
            }

            vec2 translate(vec2 high, vec2 low){
                vec2 highDiff = high - u_centerPosHigh;
                vec2 lowDiff = low - u_centerPosLow;
                return highDiff + lowDiff;
            }

            out float idx;
            void main() {
                float squareid = float(gl_VertexID / 4);
                idx = hash(squareid) * 9.86; // 0 - 10
                vec2 translated = translate(aPos.xy, vec2(0.0));
                float wmcZ = aPos.z; // need to be mercatorZ actually
                gl_Position = uMatrix * vec4(translated.xy, wmcZ, 1.0);

                // gl_Position = uMatrix * vec4(aPos, 1.0);
            }
        `,
        )
        gl.compileShader(vertexShader)
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(vertexShader))
            return
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
        gl.shaderSource(
            fragmentShader,
            `#version 300 es
            precision mediump float;
            out vec4 fragColor;

            in float idx;

            vec3 colorMap(int index) {

                vec3[] palette = vec3[11](
                    vec3(158.0, 1.0, 66.0),
                    vec3(213.0, 62.0, 79.0),
                    vec3(244.0, 109.0, 67.0),
                    vec3(253.0, 174.0, 97.0),
                    vec3(254.0, 224.0, 139.0),
                    vec3(255.0, 255.0, 191.0),
                    vec3(230.0, 245.0, 152.0),
                    vec3(171.0, 221.0, 164.0),
                    vec3(102.0, 194.0, 165.0),
                    vec3(50.0, 136.0, 189.0),
                    vec3(94.0, 79.0, 162.0)
                );

                return palette[index] / 255.0;
            }

            void main() {
                int index = int(idx) % 11;
                fragColor = vec4(colorMap(index), 0.65);
            }
        `,
        )
        gl.compileShader(fragmentShader)
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(fragmentShader))
            return
        }

        this.program = gl.createProgram()!
        gl.attachShader(this.program, vertexShader)
        gl.attachShader(this.program, fragmentShader)
        gl.linkProgram(this.program)
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(this.program))
            return
        }

        this.uMatrix = gl.getUniformLocation(this.program, 'uMatrix')

        this.vertexBuffer = gl.createBuffer()
        this.indexBuffer = gl.createBuffer()

        this.updateBuffers()

        // Setup for labelLayer
        this.labelGeojson.features = []
        map.addSource('tile-labels', {
            type: 'geojson',
            data: this.labelGeojson,
        })
        map.addLayer({
            id: 'tile-label-layer',
            type: 'symbol',
            source: 'tile-labels',
            layout: {
                'text-field': ['get', 'label'],
                'text-size': 24,
                'text-anchor': 'center',
                'text-pitch-alignment': 'map',
                'text-rotation-alignment': 'map',
            },
            paint: {
                'text-color': '#000000',
                'text-halo-color': '#ffffff',
                'text-halo-width': 3,
            },
        })
    }

    render(gl: WebGL2RenderingContext, matrix: number[]) {
        if (!this.program || !this.vertexBuffer || !this.indexBuffer) return

        ///// 1. unuseful Float64Array
        // const worldSize = this.map.transform.worldSize
        // const zUnit = this.map.transform.pixelsPerMeter
        // const projMatrix = this.map.transform.projMatrix
        // const Xmatrix = mat4.scale(new Float64Array(16) as unknown as mat4, projMatrix, [worldSize, worldSize, worldSize / zUnit] as unknown as vec3)

        ///// 2. relative to map center
        const mapCenter = MercatorCoordinate.fromLngLat(this.map.transform._center.toArray())
        const relativeMat = mat4.translate([] as any, matrix as mat4, [mapCenter[0], mapCenter[1], 0])
        const mapPosX = encodeFloatToDouble(mapCenter[0])
        const mapPosY = encodeFloatToDouble(mapCenter[1])

        gl.useProgram(this.program)
        gl.uniformMatrix4fv(this.uMatrix!, false, relativeMat)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        gl.uniform2f(gl.getUniformLocation(this.program, 'u_centerPosHigh'), mapPosX[0], mapPosY[0])
        gl.uniform2f(gl.getUniformLocation(this.program, 'u_centerPosLow'), mapPosX[1], mapPosY[1])

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        const numIndices = this.indices.length

        if (this.primitiveMode === 'line') gl.drawElements(gl.LINES, numIndices, gl.UNSIGNED_SHORT, 0)
        else if (this.primitiveMode === 'fill') gl.drawElements(gl.TRIANGLES, numIndices, gl.UNSIGNED_SHORT, 0)
    }

    private updateBuffers() {
        if (!this.vertexBuffer || !this.indexBuffer) return

        const gl = this.gl!
        const vertices: number[] = []
        const indices: number[] = []
        let vertexOffset = 0

        this.baseTiles.forEach((bound) => {
            const wrap = bound.wrap

            const [west, south, east, north] = tileToBBox([bound.x, bound.y, bound.z])
            const [w, s] = MercatorCoordinate.fromLngLat([west, south])
            const [e, n] = MercatorCoordinate.fromLngLat([east, north])

            vertices.push(w + wrap, s) // 左下
            vertices.push(e + wrap, s) // 右下
            vertices.push(e + wrap, n) // 右上
            vertices.push(w + wrap, n) // 左上

            const idx = vertexOffset
            vertexOffset += 4

            if (this.primitiveMode === 'line') indices.push(idx, idx + 1, idx + 1, idx + 2, idx + 2, idx + 3, idx + 3, idx)
            else if (this.primitiveMode === 'fill') {
                indices.push(idx, idx + 1, idx + 2)
                indices.push(idx, idx + 3, idx + 2)
            }
        })
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)

        this.indices = indices
    }

    updateTileBounds(tileBounds: OverscaledTileID[]) {
        // Update for tile-fill-layer

        this.baseTiles = tileBounds.map((tile) => {
            return {
                x: tile.canonical.x,
                y: tile.canonical.y,
                z: tile.canonical.z,
                wrap: tile.wrap,
            } as BaseTile
        })

        this.updateBuffers()

        this.updateTileLable()
    }

    _updateTileLable() {
        // Update for text-layer
        const features = this.baseTiles.map((tile) => {
            const center = tileToCenterLngLat([tile.x, tile.y, tile.z])
            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [center[0] + tile.wrap * 360, center[1]],
                },
                properties: {
                    label: `x:${tile.x} y:${tile.y} z:${tile.z}`,
                },
            } as GeoJSON.Feature
        })

        this.labelGeojson.features = features
        this.map.getSource<mapboxgl.GeoJSONSource>('tile-labels')?.setData(this.labelGeojson)
    }
}

function encodeFloatToDouble(value: number) {
    let result = new Float32Array(2)
    result[0] = value
    result[1] = value - result[0]
    return result
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
