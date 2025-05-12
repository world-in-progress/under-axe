import { Tile } from './tile'
import type TileManager from './tile_manager'
import Dispatcher from '../data/message/dispatcher'
import { OverscaledTileID } from './tile_id'

export type TileSourceType = {
    id: string
    type: 'raster'
    url: string
}

class LRUCache {
    cache: { [key: string]: number }
    keys: string[]
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

export default class TileSouce {
    id: string
    type: 'raster'
    
    url: string
    dispatcher: Dispatcher
    cache: LRUCache = new LRUCache(50)

    _tileManager!: TileManager

    constructor(desc: TileSourceType) {
        this.id = desc.id
        this.type = desc.type
        this.url = desc.url
        // Object.assign(this, desc)
        this.dispatcher = new Dispatcher(this)
    }

    loadTile(tile: OverscaledTileID) {
        if (this.cache!.has(tile.key.toString())) return

        const data_tile = new Tile(tile)
        data_tile.actor = this.dispatcher.actor
        data_tile.load(this.url)
        this.cache.put(data_tile.id, data_tile)
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
            const tile = this.cache?.get<Tile>(ozID.key.toString())
            tile && tiles.push(tile)
        }
        return tiles
    }

    remove() {
        this.cache.remove()
        this.dispatcher.remove()
    }
}