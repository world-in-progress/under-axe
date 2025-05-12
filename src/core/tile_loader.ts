// import { Tile } from './Tile';

// export default class TileLoader {
//   private loading = new Map<string, Promise<Tile>>();

//   async load(tile: Tile): Promise<Tile> {
//     if (this.loading.has(tile.key)) {
//       return this.loading.get(tile.key)!;
//     }

//     const promise = tile.load().then(() => {
//       this.loading.delete(tile.key);
//       return tile;
//     }).catch(err => {
//       this.loading.delete(tile.key);
//       throw err;
//     });

//     this.loading.set(tile.key, promise);
//     return promise;
//   }

//   cancel(tileKey: string) {

//   }
// }
