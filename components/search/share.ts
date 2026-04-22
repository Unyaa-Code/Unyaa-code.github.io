export * from '../train/share'
import { HanziCard, ZigenCardMap, HanziCardMap, fetchJsonWithCache } from "../train/share";
import { useRoute } from "vitepress";

export let cache: Record<string, any> = {}

export interface ZigenAndKey {
    zigen: string
    key: string
}
export type ZigenAndKeyArray = ReadonlyArray<ZigenAndKey>
export type ReformatHandler = (hanziInfo: HanziCard, zigenMap?: ZigenCardMap) => { data: ZigenAndKeyArray, key?: string }

const readKeyReformatHandler: ReformatHandler = (hanziInfo, _) => {
    const comp = hanziInfo.comp!
    if (typeof comp === 'string') {
        const zigens = [...comp]
        return {
            data: [...hanziInfo.key!].map((key, i) => ({
                key,
                zigen: zigens[i] || '',
            })),
            key: hanziInfo.key
        }
    }
    const data: ZigenAndKeyArray = []
    for (const item of comp) {
        for (const [key, zigen] of Object.entries(item)) {
            data.push({ zigen, key })
        }
    }
    return { data, key: hanziInfo.key }
}

export { readKeyReformatHandler }

export interface SearchCardsProps {
    zi: string
    key?: string
    data: ZigenAndKeyArray
}

export type SearchCardsPropsArray = ReadonlyArray<SearchCardsProps>

function* iterateChars(text: string): Generator<string> {
    for (const char of text) {
        yield char
    }
}

export function textToCardsProps(text: string, hanziMap: HanziCardMap, zigenMap?: ZigenCardMap, reformat?: ReformatHandler): SearchCardsPropsArray {
    const fmt = reformat || readKeyReformatHandler
    const result: SearchCardsProps[] = []
    
    for (const zi of iterateChars(text)) {
        const hanziData = hanziMap.get(zi)
        if (!hanziData) {
            result.push({ zi, data: [] })
            continue
        }
        
        if (reformat) {
            const fmtResult = reformat(hanziData, zigenMap)
            result.push({ zi, key: fmtResult.key, data: fmtResult.data })
        } else if ('key' in hanziData) {
            const fmtResult = readKeyReformatHandler(hanziData, zigenMap)
            result.push({ zi, key: fmtResult.key, data: fmtResult.data })
        } else {
            result.push({ zi, data: [] })
        }
    }
    return result
}

export function prehandleJson(json: object) {
    const result: Record<string, any> = {}
    for (const [k, v] of Object.entries(json)) {
        result[k] = v
        if (k.length > 4) {
            const tempKey = k.slice(0, 4)
            if (tempKey in result) {
                result[tempKey] += v
            } else {
                result[tempKey] = v
            }
        }
    }
    return result
}

export function getSchemaNameFromRoute() {
    const route = useRoute()
    const routeSplit = route.path.split('/')
    if (routeSplit[1] === 'yima') return routeSplit[2]
    return routeSplit[1]
}

export async function useFetchJson(json: string | undefined, schemaName: string, jsonMainName: string) {
    if (json)
        return await fetchJsonWithCache(json)
    return await fetchJsonWithCache(`/${schemaName}/${jsonMainName}.json`) as object[]
}
