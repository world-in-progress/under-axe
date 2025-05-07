import { Callback, WorkerSelf } from '../types'

export function checkIfReady(this: WorkerSelf, _: unknown, callback: Callback<any>) {
    callback()
}
