class EazyStore {
    store: Map<string, any>
    static _ins: EazyStore | null
    constructor() {
        this.store = new Map()
    }
    static instance() {
        if (EazyStore._ins == null) {
            EazyStore._ins = new EazyStore()
        }
        return EazyStore._ins
    }
    set(key: string, val: any) {
        this.store.set(key, val)
    }
    get<T>(key: string): T | null {
        return this.store.get(key)
    }
}

export default EazyStore.instance()
