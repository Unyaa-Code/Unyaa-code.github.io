let _instance: DataCache | null = null

export class DataCache {
    private db: IDBDatabase | null = null
    private ready: Promise<IDBDatabase> | null = null

    private ensureReady(): Promise<IDBDatabase> {
        if (!this.ready) {
            this.ready = new Promise((resolve, reject) => {
                if (typeof indexedDB === 'undefined') {
                    reject(new Error('indexedDB not available'))
                    return
                }
                const req = indexedDB.open('unycode_data', 1)
                req.onupgradeneeded = () => {
                    req.result.createObjectStore('cache')
                }
                req.onsuccess = () => {
                    this.db = req.result
                    resolve(this.db)
                }
                req.onerror = () => reject(req.error)
            })
        }
        return this.ready
    }

    async get(key: string): Promise<any | null> {
        await this.ensureReady()
        if (!this.db) return null
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction('cache', 'readonly')
            const req = tx.objectStore('cache').get(key)
            req.onsuccess = () => resolve(req.result ?? null)
            req.onerror = () => reject(req.error)
        })
    }

    async set(key: string, value: any): Promise<void> {
        await this.ensureReady()
        if (!this.db) return
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction('cache', 'readwrite')
            tx.objectStore('cache').put(value, key)
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
        })
    }

    async flushStale(keepPrefixes: Set<string>): Promise<void> {
        await this.ensureReady()
        if (!this.db) return
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction('cache', 'readwrite')
            const store = tx.objectStore('cache')
            const req = store.getAllKeys()
            req.onsuccess = () => {
                for (const key of req.result) {
                    const keyStr = String(key)
                    let keep = false
                    for (const prefix of keepPrefixes) {
                        if (keyStr.startsWith(prefix)) { keep = true; break }
                    }
                    if (!keep) store.delete(key)
                }
            }
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
        })
    }
}

export function getDataCache(): DataCache {
    if (!_instance) _instance = new DataCache()
    return _instance
}
