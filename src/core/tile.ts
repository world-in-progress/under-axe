import { OverscaledTileID } from './tile_id'
import Actor from '../data/message/actor'
import { createTexture2D } from '../util/glLib'
import { Cancelable } from '../data/types'
import { mat4 } from 'gl-matrix'
import ezStore from './store'

type TileStatus = 'ready' | 'loading' | 'loaded' | 'error'
const EXTENT = 8192

export class Tile {
    status: TileStatus

    width: number
    height: number
    overscaledTileID: OverscaledTileID
    gpuTexture: WebGLTexture | null
    parentTile: Tile | null = null
    u_topLeft: [number, number]
    u_scale: number

    _cancel: Cancelable | null = null
    _actor: Actor | null = null
    gl: WebGL2RenderingContext | null = null

    constructor(overscaledTileID: OverscaledTileID) {
        this.overscaledTileID = overscaledTileID
        this.width = 1
        this.height = 1
        this.u_topLeft = [0, 0]
        this.u_scale = 1
        this.gpuTexture = null
        this.status = 'ready'
        this.gl = ezStore.get<WebGL2RenderingContext>('gl')
    }

    injectParentTile(parentGPUTexture: WebGLTexture, tl: [number, number], scale: number) {
        this.gpuTexture = parentGPUTexture
        this.u_topLeft = tl
        this.u_scale = scale
    }

    get id() {
        return this.overscaledTileID.key.toString()
    }

    get actor(): Actor {
        if (!this._actor) throw new Error('Actor is null')
        return this._actor
    }

    set actor(actor: Actor) {
        this._actor = actor
    }

    get cancel() {
        if (!this._cancel) throw new Error('cancle is not found')
        return this._cancel
    }

    set cancel(cancel: Cancelable) {
        this._cancel = cancel
    }

    load(tileUrl: string, cb?: () => void) {
        if (this.status === 'loaded') return
        if (this.status === 'loading') return

        this.status = 'loading'
        if (!this.gl) console.warn('tile gl is null')
        let gl = this.gl!
        const url = this.overscaledTileID.canonical.url(tileUrl)
        this.cancel = this.actor.send(
            'loadTile',
            {
                uid: this.overscaledTileID.key,
                url: url,
            },
            (err, bitmap: ImageBitmap) => {
                if (err) {
                    console.error(err)
                    this.gpuTexture = createTexture2D(
                        gl,
                        this.width,
                        this.height,
                        gl.RGBA8,
                        gl.RGBA,
                        gl.UNSIGNED_BYTE,
                        undefined,
                    )
                    this.status = 'error'
                    return
                }

                this.width = bitmap.width
                this.height = bitmap.height
                this.gpuTexture = createTexture2D(gl, this.width, this.height, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
                this.u_topLeft = [0.0, 0.0]
                this.u_scale = 1.0
                this.status = 'loaded'

                cb && cb()
            },
        )
    }

    unload() {
        if (this.status === 'loading') {
            this.cancel.cancel()
        } else if (this.status === 'loaded') {
            this.gl!.deleteTexture(this.gpuTexture)
            this.gpuTexture = null
        }
    }

    abort() {
        if (this.status === 'loading') {
            this.cancel.cancel()
        }
    }

    tilePosMatrix(): mat4 {
        let scale, scaledX, scaledY
        const canonical = this.overscaledTileID.canonical
        const posMatrix = mat4.identity(new Float64Array(16) as unknown as mat4)
        const worldSize = ezStore.get<mapboxgl.Map>('map')!.transform.worldSize

        scale = worldSize / Math.pow(2, canonical.z)
        const unwrappedX = canonical.x + Math.pow(2, canonical.z) * this.overscaledTileID.wrap
        scaledX = unwrappedX * scale
        scaledY = canonical.y * scale

        mat4.translate(posMatrix, posMatrix, [scaledX, scaledY, 0])
        mat4.scale(posMatrix, posMatrix, [scale / EXTENT, scale / EXTENT, 1])

        return posMatrix
    }
}
