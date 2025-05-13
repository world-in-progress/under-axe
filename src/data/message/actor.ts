import Scheduler, { type TaskMetadata } from './scheduler'
import { bindAll, isWorker } from '../../util/util'
import type { Transferable, Cancelable, Callback } from '../types'
import { deserialize, serialize } from '../transfer/transfer'

type ActorCallback = Callback<any> & { metadata?: TaskMetadata }

class Actor {
    name = 'Actor'
    scheduler = new Scheduler()
    callbacks: { [id: string]: ActorCallback } = {}
    cancelCallbacks: { [id: string]: Cancelable } = {}

    constructor(
        public target: any,
        public parent: any,
    ) {
        bindAll(['receive'], this)
        this.target.addEventListener('message', this.receive, false)
    }

    send(
        type: string,
        data: unknown,
        callback?: ActorCallback,
        mustQueue = false,
        callbackMetadata?: ActorCallback['metadata'],
    ): Cancelable {
        // if (isWorker()) {
        //     console.log("Worker Send : ", data, callback, callbackMetadata)
        // } else {
        //     console.log("Main Send : ", data, callback, callbackMetadata)
        // }

        const id = Math.round(Math.random() * 1e18)
            .toString(36)
            .substring(0, 10)
        if (callback) {
            callback.metadata = callbackMetadata
            this.callbacks[id] = callback
        }

        const buffers: Set<Transferable> = new Set()
        this.target.postMessage(
            {
                id,
                type,
                hasCallback: !!callback,
                mustQueue,
                data: serialize(data, buffers),
            },
            buffers,
        )

        return {
            cancel: () => {
                callback && delete this.callbacks[id]
                this.target.postMessage({ id, type: '<cancel>' })
            },
        }
    }

    receive(message: any) {
        const data = message.data
        const id = data.id

        // if (isWorker()) {
        //     console.log("Worker Receive : ", data)
        // } else {
        //     console.log("Main Receive : ", data)
        // }

        if (!id) return

        if (data.type === '<cancel>') {
            const cancel = this.cancelCallbacks[id]
            delete this.cancelCallbacks[id]
            if (cancel) cancel.cancel()
        } else {
            if (data.mustQueue || isWorker()) {
                const callback = this.callbacks[id]
                let metadata = (callback && callback.metadata) || { type: 'message' }
                if (data.data && data.data.zoom) Object.assign(metadata, { zoom: data.data.zoom })

                const cancel = this.scheduler.add(() => this.processTask(id, data), metadata)
                if (cancel) this.cancelCallbacks[id] = cancel
            } else {
                this.processTask(id, data)
            }
        }
    }

    processTask(id: string, task: any) {
        delete this.cancelCallbacks[id]
        if (task.type === '<response>') {
            const callback = this.callbacks[id]
            if (callback) {
                delete this.callbacks[id]
                if (task.error) callback(deserialize(task.error) as Error)
                else callback(null, deserialize(task.data))
            }
        } else {
            const buffers: Set<Transferable> = new Set()
            const done = task.hasCallback
                ? (err: Error | null, data?: unknown) => {
                      this.target.postMessage(
                          {
                              id,
                              type: '<response>',
                              error: err ? serialize(err) : null,
                              data: serialize(data, buffers),
                          },
                          buffers,
                      )
                  }
                : (_: Error | null, __?: unknown) => {}

            const params = deserialize(task.data)
            if (this.parent[task.type]) {
                this.parent[task.type](params, done)
            } else if (this.parent.getWorkerSource) {
                // No action
            } else {
                done(new Error(`Could not find function ${task.type}`))
            }
        }
    }

    remove() {
        this.scheduler.remove()
        this.target.removeEventListener('message', this.receive, false)
    }
}

export default Actor
