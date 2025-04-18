import mapboxgl from 'mapbox-gl'
type TileBound = {
    west: number // lng degree
    east: number // lng degree
    north: number // lat degree
    south: number // lat degree
    minHeight: number
    maxHeight: number
}

export class BoxLayer implements mapboxgl.CustomLayerInterface {
    id: string
    type: 'custom'
    renderingMode: '3d'
    private tileBounds: TileBound[]
    private indices: number[] = []

    // WebGL resources
    private gl: WebGL2RenderingContext | null = null
    private program: WebGLProgram | null = null
    private vertexBuffer: WebGLBuffer | null = null
    private indexBuffer: WebGLBuffer | null = null
    private uMatrix: WebGLUniformLocation | null = null

    constructor(id: string, tileBounds: TileBound[]) {
        this.id = id
        this.type = 'custom'
        this.renderingMode = '3d'
        this.tileBounds = tileBounds
    }

    onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
        this.gl = gl

        const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
        gl.shaderSource(
            vertexShader,
            `#version 300 es
            layout(location = 0) in vec3 aPos;
            uniform mat4 uMatrix;

            float hash(float x) {
                return fract(sin(x * 12.9898) * 43758.5453123);
            }

            out float idx;
            void main() {
                float squareid = float(gl_VertexID / 4);
                idx = hash(squareid) * 9.86; // 0 - 10

                gl_Position = uMatrix * vec4(aPos, 1.0);
            }
        `,
        )
        gl.compileShader(vertexShader)
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error(
                '顶点着色器编译错误:',
                gl.getShaderInfoLog(vertexShader),
            )
            return
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
        gl.shaderSource(
            fragmentShader,
            `#version 300 es
            precision mediump float;
            out vec4 fragColor;

            in float idx;
            const vec3 palette[11] = vec3[11](
                vec3(231.0, 76.0, 60.0),   // 红色
                vec3(241.0, 196.0, 15.0),  // 黄色
                vec3(46.0, 204.0, 113.0),  // 绿色
                vec3(52.0, 152.0, 219.0),  // 蓝色
                vec3(155.0, 89.0, 182.0),  // 紫色
                vec3(230.0, 126.0, 34.0),  // 橙色
                vec3(236.0, 240.0, 241.0), // 浅灰
                vec3(149.0, 165.0, 166.0), // 深灰
                vec3(243.0, 156.0, 18.0),  // 深黄
                vec3(192.0, 57.0, 43.0),   // 深红
                vec3(22.0, 160.0, 133.0)   // 青色
            );
            vec3 colorMap(int index) {
                return palette[index] / 255.0;
            }

            vec3 randomColor(int seed) {
                return vec3(
                    fract(sin(float(seed) * 5555.9898) * 4365558.5453123),
                    fract(sin(float(seed) * 5.233) * 437338.5453123),
                    fract(sin(float(seed) * 55.164) * 758.5453123)
                );
            }
            void main() {
                int index = int(idx);
                fragColor = vec4(randomColor(index), 0.11);
            }
        `,
        )
        gl.compileShader(fragmentShader)
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error(
                '片段着色器编译错误:',
                gl.getShaderInfoLog(fragmentShader),
            )
            return
        }

        this.program = gl.createProgram()!
        gl.attachShader(this.program, vertexShader)
        gl.attachShader(this.program, fragmentShader)
        gl.linkProgram(this.program)
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('程序链接错误:', gl.getProgramInfoLog(this.program))
            return
        }

        this.uMatrix = gl.getUniformLocation(this.program, 'uMatrix')

        this.vertexBuffer = gl.createBuffer()
        this.indexBuffer = gl.createBuffer()

        this.updateBuffers()
    }

    private updateBuffers() {
        if (!this.vertexBuffer || !this.indexBuffer) return

        const gl = this.gl!
        const vertices: number[] = []
        const indices: number[] = []
        let vertexOffset = 0

        this.tileBounds.forEach((bound) => {
            // 构建每个盒子的8个顶点
            const { west, east, north, south, minHeight, maxHeight } = bound

            const merc1 = mapboxgl.MercatorCoordinate.fromLngLat(
                [west, south],
                minHeight,
            )
            const merc2 = mapboxgl.MercatorCoordinate.fromLngLat(
                [east, north],
                maxHeight,
            )

            const [w, s, e, n, minh, maxh] = [
                merc1.x,
                merc1.y,
                merc2.x,
                merc2.y,
                merc1.z,
                merc2.z,
            ]

            // 底部4个顶点
            vertices.push(w, s) // 左下
            vertices.push(e, s) // 右下
            vertices.push(e, n) // 右上
            vertices.push(w, n) // 左上

            const idx = vertexOffset
            // lines
            // indices.push(
            //     idx, idx + 1,
            //     idx + 1, idx + 2,
            //     idx + 2, idx + 3,
            //     idx + 3, idx
            // );
            // fill
            indices.push(idx, idx + 1, idx + 2, idx, idx + 3, idx + 2)

            vertexOffset += 4
        })
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(vertices),
            gl.STATIC_DRAW,
        )

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array(indices),
            gl.STATIC_DRAW,
        )

        this.indices = indices
    }

    updateTileBounds(tileBounds: TileBound[]) {
        this.tileBounds = tileBounds
        // console.log('boxlayer :: updateTileBounds ', this.tileBounds.length)
        this.updateBuffers()
    }

    render(gl: WebGL2RenderingContext, matrix: number[]) {
        if (!this.program || !this.vertexBuffer || !this.indexBuffer) return

        gl.useProgram(this.program)
        gl.uniformMatrix4fv(this.uMatrix!, false, matrix)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        const numIndices = this.indices.length
        // gl.drawElements(gl.LINES, numIndices, gl.UNSIGNED_SHORT, 0);
        gl.drawElements(gl.TRIANGLES, numIndices, gl.UNSIGNED_SHORT, 0)
    }
}
