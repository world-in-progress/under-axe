export type Cancelable = {
    cancel: () => void
}

export type WorkerSelf = WorkerGlobalScope & Record<string, any>

export type TaskType = 'message'

export type Callback<T> = (error?: Error | null, result?: T | null) => void

export type Transferable = ArrayBuffer | MessagePort | ImageBitmap

export type Class<T> = new (...args: any[]) => T

export type Klass = Class<any> & {
    _classRegistryKey: string
    serialize?: (input: any, transferables?: Set<Transferable>) => SerializedObject
    deserialize?: (serialized: unknown) => unknown
}

export type SerializedObject = {
    [_: string]: Serialized
}

export type Serialized =
    | unknown
    | null
    | undefined
    | boolean
    | number
    | string
    | Date
    | RegExp
    | ArrayBuffer
    | ArrayBufferView
    | ImageData
    | Array<Serialized>
    | SerializedObject

/**
 * 可拓展的瓦片数据请求
 * 通过dispatcher即可调用
 * `dispatcher.getActor().send('source-type.methodname', params, callback)`.
 */
export interface WorkerSource {
    // /**
    //  * Loads a tile from the given params and parse it into buckets ready to send
    //  * back to the main thread for rendering. Should call the callback with:
    //  * `{ buckets, featureIndex, collisionIndex, rawTileData}`.
    //  */
    // loadTile: (params: WorkerSourceTileRequest, callback: Callback<unknown>) => void;
    // /**
    //  * Re-parses a tile that has already been loaded. Yields the same data as
    //  * {@link WorkerSource#loadTile}.
    //  */
    // reloadTile: (params: WorkerSourceTileRequest, callback: Callback<unknown>) => void;
    // /**
    //  * Aborts loading a tile that is in progress.
    //  */
    // abortTile: (params: WorkerSourceTileRequest, callback: Callback<unknown>) => void;
    // /**
    //  * Removes this tile from any local caches.
    //  */
    // removeTile: (params: WorkerSourceTileRequest, callback: Callback<unknown>) => void;
    // /**
    //  * Tells the WorkerSource to abort in-progress tasks and release resources.
    //  * The foreground Source is responsible for ensuring that 'removeSource' is
    //  * the last message sent to the WorkerSource.
    //  */
    // removeSource?: (params: {source: string}, callback: Callback<void>) => void;
}
