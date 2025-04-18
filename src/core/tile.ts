import { BoundingBox } from './bounding_box'

export class Tile {
    x: number
    y: number
    z: number

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.x = x
        this.y = y
        this.z = z
    }

    static fromKey(key: string): Tile {
        let x = 0
        let y = 0
        let z = 0

        for (let i = z; i > 0; i--) {
            const mask = 1 << (i - 1)
            const b = parseInt(key[z - i])
            if (b === 1) x |= mask
            if (b === 2) y |= mask
            if (b === 3) {
                x |= mask
                y |= mask
            }
        }
        return new Tile(x, y, z)
    }

    static pointToTile(lon: number, lat: number, z: number): Tile {
        const tile = pointToTileFraction(lon, lat, z)
        const x = Math.floor(tile[0])
        const y = Math.floor(tile[1])
        return new Tile(x, y, z)
    }

    static bboxToTile(bbox: BoundingBox): Tile {
        const minTile = this.pointToTile(bbox.minX, bbox.minY, 32)
        const maxTile = this.pointToTile(bbox.maxX, bbox.maxY, 32)
        const tileBox = [minTile.x, minTile.y, maxTile.x, maxTile.y]

        const z = getBboxZoom(tileBox)
        if (z === 0) return new Tile()

        const x = tileBox[0] >>> (32 - z)
        const y = tileBox[1] >>> (32 - z)
        return new Tile(x, y, z)
    }

    get parent(): Tile {
        return new Tile(this.x >> 1, this.y >> 1, this.z - 1)
    }

    get children(): Tile[] {
        return [
            new Tile(this.x * 2, this.y * 2, this.z + 1),
            new Tile(this.x * 2 + 1, this.y * 2, this.z + 1),
            new Tile(this.x * 2 + 1, this.y * 2 + 1, this.z + 1),
            new Tile(this.x * 2, this.y * 2 + 1, this.z + 1),
        ]
    }

    get siblings(): Tile[] {
        return this.parent.children
    }

    get key(): string {
        let index = ''
        for (let z = this.z; z > 0; z--) {
            let b = 0
            const mask = 1 << (z - 1)
            if ((this.x & mask) !== 0) b++
            if ((this.y & mask) !== 0) b += 2
            index += b.toString()
        }
        return index
    }

    equals(other: Tile): boolean {
        return this.x === other.x && this.y === other.y && this.z === other.z
    }
}

// Helpers //////////////////////////////////////////////////

const MAX_ZOOM = 28

const DEG_TO_RAD = Math.PI / 180.0
// const RAD_TO_DEG = 180.0 / Math.PI

function getBboxZoom(bbox: Array<number>): number {
    for (let z = 0; z < MAX_ZOOM; z++) {
        const mask = 1 << (32 - (z + 1))
        if (
            (bbox[0] & mask) !== (bbox[2] & mask) ||
            (bbox[1] & mask) !== (bbox[3] & mask)
        ) {
            return z
        }
    }

    return MAX_ZOOM
}

function pointToTileFraction(lon: number, lat: number, z: number) {
    const sin = Math.sin(lat * DEG_TO_RAD)
    const z2 = Math.pow(2.0, z)

    let x = z2 * (lon / 360.0 + 0.5)
    const y =
        z2 * (0.5 - (0.25 * Math.log((1.0 + sin) / (1.0 - sin))) / Math.PI)

    x = x % z2
    if (x < 0) x = x + z2
    return [x, y, z]
}