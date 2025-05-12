import { Tile } from './tile'
import type TileManager from './tile_manager'
import Dispatcher from '../data/message/dispatcher'
import { OverscaledTileID } from './tile_id'
import ezStore from './store'

export type TileSourceType = {
    id: string
    type: 'raster'
    url: string
}

class LRUCache {
    cache: { [key: string]: any }
    keys: string[] // 维护了从少取用到频繁取用排序的key值， 所以遍历的时候建议逆序遍历
    capacity: number

    constructor(capacity: number) {
        this.capacity = capacity
        this.cache = {}
        this.keys = []
    }

    get<T>(key: string): T | null {
        if (key in this.cache) {
            // 如果键存在，将其移动到数组的末尾
            this.keys.splice(this.keys.indexOf(key), 1)
            this.keys.push(key)
            return this.cache[key] as T
        }
        return null
    }

    put(key: string, value: any) {
        if (key in this.cache) {
            this.keys.splice(this.keys.indexOf(key), 1)
        } else if (Object.keys(this.cache).length >= this.capacity) {
            const oldestKey = this.keys.shift()
            if (oldestKey) delete this.cache[oldestKey]
        }
        this.cache[key] = value
        this.keys.push(key)
    }

    has(key: string) {
        return key in this.cache
    }

    remove() {
        this.cache = {}
        this.keys = []
    }
}

export default class TileSource {
    id: string
    type: 'raster'

    url: string
    dispatcher: Dispatcher
    lruCache: LRUCache = new LRUCache(150)

    _tileManager!: TileManager

    constructor(desc: TileSourceType) {
        this.id = desc.id
        this.type = desc.type
        this.url = desc.url
        // Object.assign(this, desc)
        this.dispatcher = new Dispatcher(this)
    }

    loadTile(tile: OverscaledTileID) {
        if (this.lruCache!.has(tile.key.toString())) return

        const data_tile = new Tile(tile)
        data_tile.actor = this.dispatcher.actor

        const closestTileInfo = this.findClosestAvailableTile(tile)
        if (closestTileInfo.tile) {
            // 找到了最近的 loaded Tile
            data_tile.injectParentTile(closestTileInfo.tile.gpuTexture!, closestTileInfo.tl, closestTileInfo.scale)
        } else {
            console.log('😢, 燃尽了... 没找到爹地,闪烁一下吧')
        }
        this.lruCache.put(data_tile.id, data_tile)
        const map = ezStore.get<mapboxgl.Map>('map')
        data_tile.load(this.url, () => {
            map?.triggerRepaint()
        })
    }

    unloadTile(tile: Tile) {
        tile.unload()
    }

    abortTile(tile: Tile) {
        tile.abort()
    }

    coveringTiles(): Tile[] {
        const coveringOZIDs = this._tileManager.coveringTiles

        const tiles: Tile[] = []
        for (const ozID of coveringOZIDs) {
            const tile = this.lruCache.get<Tile>(ozID.key.toString())
            if (tile) tiles.push(tile)
            // else {
            //     const closestTile = this.findClosestAvailableTile(ozID)

            //     if (closestTile) tiles.push(closestTile)
            //     else console.log('别急')
            // }
        }
        return tiles
    }

    private findClosestAvailableTile(ozID: OverscaledTileID): {
        tile: Tile | null
        tl: [number, number]
        scale: number
    } {
        const cacheLength = this.lruCache.keys.length
        let closestTile = null
        let tl = [0, 0] as [number, number]
        let scale = 1.0
        for (let i = cacheLength - 1; i >= 0; i--) {
            const key = this.lruCache.keys[i]
            const cachedTile = this.lruCache.cache[key] as Tile
            if (ozID.isChildOf(cachedTile.overscaledTileID) && cachedTile.status === 'loaded') {
                closestTile = cachedTile
                const closestFatherCanonical = closestTile.overscaledTileID.canonical
                const sonCanonical = ozID.canonical

                scale = Math.pow(2, closestFatherCanonical.z - sonCanonical.z)
                tl[0] = (sonCanonical.x * scale) % 1
                tl[1] = (sonCanonical.y * scale) % 1

                break
            }
        }

        return {
            tile: closestTile,
            tl,
            scale,
        }
    }

    remove() {
        this.lruCache.remove()
        this.dispatcher.remove()
    }
}
