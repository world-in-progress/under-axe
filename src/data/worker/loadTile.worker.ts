import { Callback, WorkerSelf } from '../types'
import { http } from '../request/http'

type TileRequestParams = {
    uid: number
    url: string
}

export function loadTile(this: WorkerSelf, params: TileRequestParams, callback: Callback<any>) {
    const url = params.url
    try {
        http.get<Blob>(url, { timeout: 500, responseType: 'blob' }).then((res) => {
            if (res.status !== 200) {
                callback(new Error(`${url} load failed with status ${res.status}`), null)
                return
            }

            createImageBitmap(res.data, {
                // 'imageOrientation': 'flipY'
            }).then((bitmap: ImageBitmap) => {
                callback(null, bitmap)
            })
        })
    } catch (e: any) {
        callback(e, null)
    }
}
