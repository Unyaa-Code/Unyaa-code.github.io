<script setup lang="ts">
import { onMounted, shallowRef, provide } from "vue";
import Search from "./Search.vue";
import { cache, HanziCard, HanziCardMap, ZigenCard, ZigenCardMap, fetchJsonWithCache, getSchemaNameFromRoute, ReformatHandler } from "./share";

type UnicodeBlock = [string, string, string]
type CharRange = Record<string, string[]>
interface UnicodeAgeData {
  source: string
  generated: string
  ranges: [number, number, string][]
}

const p = defineProps<{
    chaifenJson?: string
    zigenJson?: string
    noZigenJson?: boolean
    zigenFont?: string
    id?: string
    high?: string
    reformat?: ReformatHandler
}>()

provide('font', p.zigenFont ?? 'kaiti')
provide('high', new Set(p.high))

const schemaData = shallowRef<{
    zg?: ZigenCardMap,
    cf: HanziCardMap,
}>()

let unicodeBlocks: UnicodeBlock[] | null = null
let charRange: CharRange | null = null
let unicodeAge: UnicodeAgeData | null = null

const schemaName = p.id || getSchemaNameFromRoute()
const realJsonName = (json: string | undefined, jsonMainName: string) => json ? json : `/${schemaName}/${jsonMainName}.json`

const makeMapFromObject = (obj: Record<string, Omit<HanziCard, 'name'>>): HanziCardMap => {
    const map = new Map<string, HanziCard>()
    for (const [name, data] of Object.entries(obj)) {
        map.set(name, { name, ...data })
    }
    return map
}

const makeMapFromArray = <T extends { name: string }>(arr: T[]) => new Map(arr.map(v => [v.name, v]))

const getUnicodeBlock = (codePoint: number): string | null => {
    if (!unicodeBlocks) return null
    for (const [start, end, name] of unicodeBlocks) {
        const startNum = parseInt(start, 16)
        const endNum = parseInt(end, 16)
        if (codePoint >= startNum && codePoint <= endNum) return name
    }
    return null
}

const getCharRange = (char: string): (string | number)[] | null => {
    if (!charRange) return null
    return charRange[char] || null
}

provide('getUnicodeBlock', getUnicodeBlock)
provide('getCharRange', getCharRange)

const getUnicodeAge = (codePoint: number): string | null => {
  if (!unicodeAge) return null
  const ranges = unicodeAge.ranges
  let lo = 0
  let hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const [s, e, v] = ranges[mid]
    if (codePoint < s) hi = mid - 1
    else if (codePoint > e) lo = mid + 1
    else return v
  }
  return null
}
provide('getUnicodeAge', getUnicodeAge)

onMounted(async () => {
    let id = schemaName

    if (id in cache) {
        //@ts-ignore
        schemaData.value = cache[id]
        return
    }
    
    const [chaifenJson, blocksJson, rangeJson, ageJson] = await Promise.all([
        fetchJsonWithCache(realJsonName(p.chaifenJson, 'chaifen')) as Promise<Record<string, Omit<HanziCard, 'name'>>>,
        unicodeBlocks ? Promise.resolve(null) : fetchJsonWithCache('/data/Blocks.json') as Promise<UnicodeBlock[]>,
        charRange ? Promise.resolve(null) : fetchJsonWithCache('/data/range.json') as Promise<CharRange>,
        unicodeAge ? Promise.resolve(null) : fetchJsonWithCache('/data/unicode-age.json') as Promise<UnicodeAgeData | null>,
    ])

    if (blocksJson) unicodeBlocks = blocksJson
    if (rangeJson) charRange = rangeJson
    if (ageJson) unicodeAge = ageJson
    
    const result = {
        cf: makeMapFromObject(chaifenJson),
        zg: p.noZigenJson ? undefined : makeMapFromArray(await fetchJsonWithCache(realJsonName(p.zigenJson, 'zigen')) as ZigenCard[])
    }

    cache[id] = result
    schemaData.value = result
})
</script>

<template>
    <div class="text-gray-600" v-if="!schemaData">正在加载拆分数据……</div>
    <Search v-else :hanziMap="schemaData.cf" :zigenMap="schemaData.zg" :reformat />
</template>
