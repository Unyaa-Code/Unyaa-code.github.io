<script setup lang="ts">
import ZitongLogo from "./assets/zitong.svg";
import YedianLogo from "./assets/yedian.png";
import BaiduLogo from "./assets/baidu.png";
import HandianLogo from "./assets/handian.png";
import { computed, inject } from "vue";
import { ZigenAndKeyArray } from "./share";

const p = defineProps<{
    name: string,
    cardKey?: string,
    data: ZigenAndKeyArray
}>()

const highlightStrokes = inject('high') as Set<string>
const getUnicodeBlock = inject<(codePoint: number) => string | null>('getUnicodeBlock')
const getCharRange = inject<(char: string) => (string | number)[] | null>('getCharRange')

const uriText = computed(() => encodeURIComponent(p.name))

const rangeLabels: Record<string, string> = {
    '1': '通规一级字',
    '2': '通规二级字',
    '8': 'gb2312',
}

const unicodeInfo = computed(() => {
    const code = p.name.codePointAt(0)!
    const parts = ['U+' + code.toString(16).toUpperCase().padStart(4, '0')]
    
    if (getUnicodeBlock) {
        const block = getUnicodeBlock(code)
        if (block) parts.push(block)
    }
    
    if (getCharRange) {
        const ranges = getCharRange(p.name)
        if (ranges) {
            for (const r of ranges) {
                parts.push(rangeLabels[String(r)] || String(r))
            }
        }
    }
    
    return parts.join(' · ')
})

const unicodeHex = computed(() => {
    const code = p.name.codePointAt(0)!
    return code.toString(16).toUpperCase().padStart(4, '0')
})

</script>

<template>
    <div class="group border p-4 m-2 rounded-3xl shadow-md text-center bg-gray-100 dark:bg-slate-800 min-w-32">
        <div class="text-3xl text-blue-800 dark:text-blue-400 mb-3 heiti-Unyaa">{{ name }}</div>
        
        <div class="text-sm mb-2 flex items-start justify-center" v-if="cardKey">
            <span class="font-mono text-blue-600 dark:text-blue-300">{{ cardKey }}</span>
        </div>
        
        <div class="text-sm mb-2 flex items-start justify-center" v-if="data && data.length > 0">
            <ruby v-for="zigenAndKey in data" :key="zigenAndKey.zigen + zigenAndKey.key" class="mx-0.5 heiti-Unyaa">
                <span :class="{ 'highlight-text': highlightStrokes && highlightStrokes.has(zigenAndKey.zigen) }">
                    {{ zigenAndKey.zigen }}</span>
                <rp>(</rp>
                <rt class="font-mono text-xs text-blue-400 dark:text-blue-200">
                    {{ zigenAndKey.key }}
                </rt>
                <rp>)</rp>
            </ruby>
        </div>
        
        <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {{ unicodeInfo }}
        </div>
        
        <div class="opacity-0 justify-center group-hover:opacity-100 duration-300 delay-100 transition-all">
            <div class="flex justify-center dark:opacity-55 opacity-100 gap-2">
                <a :href="'https://zi.tools/zi/' + uriText" target="_blank" rel="noreferrer" title="字统网查询">
                    <img :src=ZitongLogo alt="字统网" width="22" />
                </a>
                <a :href="'http://www.yedict.com/zscontent.asp?uni=' + unicodeHex" target="_blank" rel="noreferrer"
                    title="叶典网查询">
                    <img :src="YedianLogo" alt="叶典网" width="22" />
                </a>
                <a :href="'https://hanyu.baidu.com/s?wd=' + uriText" target="_blank" rel="noreferrer" title="百度汉语查询">
                    <img :src="BaiduLogo" alt="百度汉语" width="22" />
                </a>
                <a :href="'https://www.zdic.net/hans/' + uriText" target="_blank" rel="noreferrer" title="汉典查询">
                    <img :src="HandianLogo" alt="汉典网" width="22" />
                </a>
            </div>
        </div>
    </div>
</template>
