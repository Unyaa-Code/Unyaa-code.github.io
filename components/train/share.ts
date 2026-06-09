import { withBase } from "vitepress";
import { getDataCache } from "./idbCache";

export const cache: Record<string, any> = {}
const fetchCache: Record<string, any> = {}


export interface ZigenCard {
    /** 字根用字 */
    name: string;
    /** 所在按键（大码） */
    key: string;
    /** 相关的汉字 */
    rel: string;
    /** 类型，易码用，笔划、二笔 */
    kind?: 'b' | 'eb'
    /** 小码所在键，奕码用 */
    secondary?: string
    /** 字根归类：它与哪个字根相似 */
    class?: string
    /** 内部属性，字根归类用的类似字根，程序会修改这个属性，json里不要填写 */
    _classZigen?: ZigenCard[]
    /** 内部属性 */
    _idx?: number
}

/** 字根部件项 [编码, 字根] */
export type CompItem = [string, string]

/** 汉字信息 */
export interface HanziCard {
    /** 汉字 */
    name: string,
    /** 编码 */
    key?: string,
    /** 拆分 */
    comp?: string | CompItem[],
}

export type Card = ZigenCard | HanziCard

/** 汉字 - 汉字信息的Map数据 */
export type HanziCardMap = Map<string, HanziCard>

/** 字根 - 字根信息的Map数据 */
export type ZigenCardMap = Map<string, ZigenCard>

async function decompressGzip(response: Response): Promise<string> {
    if (typeof DecompressionStream === 'undefined') {
        return response.text()
    }
    const ds = new DecompressionStream('gzip')
    const decompressedStream = response.body!.pipeThrough(ds)
    return new Response(decompressedStream).text()
}

let versionManifest: { files: Record<string, string> } | null = null
let versionLoading: Promise<typeof versionManifest> | null = null

async function loadVersionManifest() {
    if (versionManifest) return versionManifest
    if (versionLoading) return versionLoading
    versionLoading = (async () => {
        try {
            const resp = await fetch(withBase('/data-version.json') + '?t=' + Date.now())
            if (resp.ok) {
                versionManifest = await resp.json()
            }
        } catch {}
        return versionManifest
    })()
    return versionLoading
}

interface CacheEntry {
    hash: string
    data: any
}

async function loadIdbCache(url: string, hash: string): Promise<any | null> {
    try {
        const entry: CacheEntry | null = await getDataCache().get(url)
        if (!entry || entry.hash !== hash) return null
        return entry.data
    } catch {
        return null
    }
}

async function saveIdbCache(url: string, hash: string, data: any) {
    try {
        await getDataCache().set(url, { hash, data })
    } catch {}
}

export async function fetchJsonWithCache(url: string) {
    if (url in fetchCache)
        return fetchCache[url]

    let urlFixed = url
    if (url[0] === '/') {
        urlFixed = withBase(url)
    }

    let json: any = null

    const isDev = import.meta.env.DEV

    if (!isDev) {
        const manifest = await loadVersionManifest()
        const manifestKey = url.replace(/^\/+/, '')
        const currentHash = manifest?.files?.[manifestKey]

        if (currentHash) {
            json = await loadIdbCache(url, currentHash)
            if (json) {
                fetchCache[url] = json
                return json
            }
        }

        try {
            const gzipResp = await fetch(urlFixed + '.gz')
            if (gzipResp.ok) {
                const text = await decompressGzip(gzipResp)
                json = JSON.parse(text)
                if (json.$v) {
                    delete json.$v
                    json = restoreKeys(json, url)
                }
            }
        } catch {}
    }

    if (!json) {
        try {
            const req = await fetch(urlFixed)
            json = await req.json()
        } catch (error) {
            if (error instanceof Error)
                alert(`无法下载或解析《${url}》文件：${error.cause}`)
            throw error
        }
    }

    if (!isDev) {
        const manifest = await loadVersionManifest()
        const manifestKey = url.replace(/^\/+/, '')
        const currentHash = manifest?.files?.[manifestKey]
        if (currentHash) {
            saveIdbCache(url, currentHash, json)
        }
    }

    fetchCache[url] = json
    return json
}

function restoreKeys(obj: any, url: string) {
    const map = getReverseKeyMap(url)
    if (!map) return obj
    return applyReverseKeyMap(obj, map)
}

function getReverseKeyMap(url: string): [string, string][] | null {
    if (url.includes('chaifen')) return [['c', 'comp'], ['k', 'key']]
    if (url.includes('zigen')) return [['n', 'name'], ['k', 'key'], ['r', 'rel'], ['s', 'secondary'], ['l', 'class'], ['d', 'kind']]
    return null
}

function applyReverseKeyMap(obj: any, map: [string, string][]): any {
    if (Array.isArray(obj)) {
        return obj.map(item => {
            if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
                return applyReverseKeyMap(item, map)
            }
            return item
        })
    }
    if (obj !== null && typeof obj === 'object') {
        const result: any = {}
        for (const [k, v] of Object.entries(obj)) {
            let newKey = k
            for (const [short, long] of map) {
                if (k === short) { newKey = long; break }
            }
            result[newKey] = v
        }
        return result
    }
    return obj
}