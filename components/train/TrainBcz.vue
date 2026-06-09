<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, watch, inject, computed, nextTick } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { fetchJsonWithCache, cache, type HanziCardMap } from "./share";
import { getSchemaNameFromRoute } from "../search/share";
import { readKeyReformatHandler } from "../search/share";
//@ts-expect-error
import { startConfette } from "./startConfette.js";

const p = defineProps<{
    name?: string
    bczJson?: string
    chaifenJson?: string
    zigenFont?: string
}>()

const schemaName = getSchemaNameFromRoute()
const id = p.name || schemaName
const realJsonName = (json: string | undefined, jsonMainName: string) => json ? json : `/${schemaName}/${jsonMainName}.json`

const chars = shallowRef<string[]>([])
const hanziMap = shallowRef<HanziCardMap>(new Map())

const currentIndex = useLocalStorage(`bcz_${id}_index`, 0)
const round = useLocalStorage(`bcz_${id}_round`, 1)
const isCorrect = shallowRef(true)
const userInput = shallowRef('')
const hintHover = ref(false)
const pinned = ref(false)
const escHint = ref(false)
const showConfetti = ref(false)

const progress = computed(() => currentIndex.value + 1)
const max = computed(() => chars.value.length)
const currentChar = computed(() => chars.value[currentIndex.value] || '')

const prevChar = computed(() => {
    if (currentIndex.value > 0) return chars.value[currentIndex.value - 1] || ''
    return ''
})

const nextChar = computed(() => {
    if (currentIndex.value < chars.value.length - 1) return chars.value[currentIndex.value + 1] || ''
    return ''
})

const slideTrigger = ref(false)
const slideDirection = ref<'forward' | 'backward'>('forward')
const rowOffset = ref(0)

watch(currentIndex, (newVal, oldVal) => {
    slideDirection.value = newVal > oldVal ? 'forward' : 'backward'
    slideTrigger.value = true

    // 先偏移，再动画回位，产生整体滑动感
    rowOffset.value = newVal > oldVal ? 30 : -30
    setTimeout(() => {
        rowOffset.value = 0
    }, 0)

    setTimeout(() => { slideTrigger.value = false }, 400)
})

const showHint = computed(() => pinned.value || hintHover.value || escHint.value)

watch(round, async (newRound, oldRound) => {
    if (newRound > oldRound && chars.value.length > 0) {
        showConfetti.value = true
        await nextTick()
        startConfette()
    }
})

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        escHint.value = !escHint.value
    }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

watch(currentIndex, () => { escHint.value = false })

const currentCardData = computed(() => {
    const zi = currentChar.value
    if (!zi) return null
    const data = hanziMap.value.get(zi)
    if (!data) return null
    const fmtResult = readKeyReformatHandler(data)
    return { key: fmtResult.key, data: fmtResult.data }
})

onMounted(async () => {
    const [bczData, cfData] = await Promise.all([
        fetchJsonWithCache(realJsonName(p.bczJson, 'bcz')) as Promise<string[]>,
        fetchJsonWithCache(realJsonName(p.chaifenJson, 'chaifen')) as Promise<Record<string, any>>,
    ])
    
    chars.value = bczData
    
    const map = new Map<string, any>()
    for (const [name, data] of Object.entries(cfData)) {
        map.set(name, { name, ...data })
    }
    hanziMap.value = map
    
    if (currentIndex.value >= chars.value.length) {
        currentIndex.value = 0
    }
})

function focusInput() {
    setTimeout(() => {
        const el = document.getElementById('bcz_input')
        el?.focus()
    }, 50)
}

onMounted(() => focusInput())

watch(userInput, (input) => {
    if (!currentChar.value) return
    
    if (input === currentChar.value) {
        isCorrect.value = true
        userInput.value = ''
        currentIndex.value++
        if (currentIndex.value >= chars.value.length) {
            round.value++
            currentIndex.value = 0
        }
        focusInput()
        return
    }
    
    const isANSI = /^[a-zA-Z0-9\s]*$/.test(input)
    
    if (!isANSI && input !== currentChar.value) {
        isCorrect.value = false
        setTimeout(() => {
            userInput.value = ''
            isCorrect.value = true
        }, 500)
        return
    }
    
    // 编码匹配（仅ANSI字符串）
    const cardData = currentCardData.value
    if (cardData && cardData.key) {
        // key格式: "首码 完整编码"，如 "d dklt"
        const keys = cardData.key.split(' ')
        const inputTrimmed = input.trim()
        const hasSpace = input.endsWith(' ')
        
        // 检查是否匹配任意一个编码
        const matchKey = (testInput: string) => {
            for (const k of keys) {
                if (testInput === k || testInput.startsWith(k)) {
                    return true
                }
            }
            return false
        }
        
        // 满四码：自动判定
        if (inputTrimmed.length >= 4) {
            if (matchKey(inputTrimmed)) {
                isCorrect.value = true
                userInput.value = ''
                currentIndex.value++
                if (currentIndex.value >= chars.value.length) {
                    round.value++
                    currentIndex.value = 0
                }
                focusInput()
            } else {
                isCorrect.value = false
                setTimeout(() => {
                    userInput.value = ''
                    isCorrect.value = true
                }, 500)
            }
            return
        }
        
        // 不满四码：需要空格才判定
        if (hasSpace) {
            if (keys.includes(inputTrimmed)) {
                isCorrect.value = true
                userInput.value = ''
                currentIndex.value++
                if (currentIndex.value >= chars.value.length) {
                    round.value++
                    currentIndex.value = 0
                }
                focusInput()
            } else {
                isCorrect.value = false
                setTimeout(() => {
                    userInput.value = ''
                    isCorrect.value = true
                }, 500)
            }
            return
        }
        
        // 不满四码且无空格：不清空，等待继续输入
        return
    }
    
    // 无编码数据时的处理
    if (input.length > 0 && !cardData) {
        isCorrect.value = false
        setTimeout(() => {
            userInput.value = ''
            isCorrect.value = true
        }, 500)
    }
})

function goBack() {
    if (currentIndex.value > 0) {
        currentIndex.value--
        userInput.value = ''
        isCorrect.value = true
        focusInput()
    }
}

function restart() {
    if (!confirm('重置进度需要清空数据，无法撤回，您确定继续吗？')) return
    currentIndex.value = 0
    round.value = 1
    userInput.value = ''
    isCorrect.value = true
    focusInput()
}

function exportLocalStorage() {
    const data = JSON.stringify(localStorage, null, 4)
    const blob = new Blob([data], { type: "charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'progress'
    link.click()
    link.remove()
}

function importLocalStorage() {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.addEventListener('change', (event) => {
        const file = (event.target as HTMLInputElement).files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
                try {
                    const parsedData = JSON.parse(event.target!.result as string)
                    Object.keys(parsedData).forEach(key => {
                        localStorage.setItem(key, parsedData[key])
                    })
                    alert('导入成功！')
                } catch {
                    alert('导入失败：文件格式错误！')
                }
            }
            reader.readAsText(file)
        }
    })
    fileInput.click()
}
</script>

<template>
    <div v-if="chars.length === 0" class="text-gray-600 text-center p-9">正在加载数据……</div>
    <div v-else class="md:w-2/3 w-full shadow-sm my-6 pb-20 bg-opacity-10 transition-color rounded-md"
        :class="{ 'bg-red-700': !isCorrect, 'bg-slate-500': isCorrect }">
        
        <div class="flex justify-center mb-24">
            <progress class="progress w-full" :value="progress" :max />
        </div>
        
        <template v-if="showConfetti">
            <div class="p-10 text-6xl text-center font-bold text-orange-800 font-sans tracking-widest -rotate-6">
                🎉恭喜完成第 {{ round - 1 }} 轮!</div>
            <div class="flex justify-center mt-10">
                <button class="btn btn-success" @click="showConfetti = false">继续练习</button>
            </div>
        </template>
        <template v-else>
        <div class="relative flex flex-col items-center">
            <div class="overflow-hidden">
                <div class="flex items-center justify-center gap-4 md:gap-8 select-none transition-transform duration-300"
                    :style="{ transform: `translateX(${rowOffset}px)` }">
                    <!-- 上一字 -->
                    <div class="w-12 md:w-16 text-2xl md:text-4xl text-center text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-300 heiti-Unyaa"
                        :class="{ 'opacity-0': !prevChar }"
                        @click="goBack" title="点击切换到上一字">
                        {{ prevChar }}
                    </div>

                    <!-- 当前字 -->
                    <div :key="currentIndex"
                        class="md:text-6xl text-4xl text-center align-middle heiti-Unyaa"
                        :class="{ 'text-red-400 animate__animated animate__headShake': !isCorrect,
                                  'animate-pop': slideTrigger }">
                        {{ currentChar }}
                    </div>

                    <!-- 下一字 -->
                    <div class="w-12 md:w-16 text-2xl md:text-4xl text-center text-gray-400 dark:text-gray-500 heiti-Unyaa transition-all duration-300"
                        :class="{ 'opacity-0': !nextChar }"
                        title="下一字">
                        {{ nextChar }}
                    </div>
                </div>
            </div>
            
            <div class="flex justify-center p-5">
                <input id="bcz_input" type="text" v-model="userInput" placeholder="输入对应汉字或编码"
                    :class="['input w-half max-w-xs input-bordered text-center input-sm dark:bg-slate-800 bg-white', { 'input-error': !isCorrect }]" />
            </div>
            
            <div class="relative inline-block"
                @mouseenter="hintHover = true"
                @mouseleave="hintHover = false"
                @click="hintHover = true">
                <div class="rounded-lg border dark:border-slate-700 px-4 py-2 text-sm text-center cursor-default"
                    :class="showHint ? 'bg-white dark:bg-slate-800 select-text' : 'bg-gray-50 dark:bg-slate-900 border-dashed select-none'">
                    <button v-if="showHint || hintHover" @click.stop="pinned = !pinned"
                        class="absolute top-0.5 right-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-0.5"
                        :title="pinned ? '取消固定' : '固定显示'">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                            :class="{ 'rotate-45': pinned }">
                            <path d="M12 17v5" /><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76z"/>
                        </svg>
                    </button>
                    <div v-if="currentCardData" :class="{ 'invisible': !showHint }">
                        <div class="flex items-start justify-center gap-1 mb-2" v-if="currentCardData.key">
                            <span class="font-mono text-blue-600 dark:text-blue-300">{{ currentCardData.key }}</span>
                        </div>
                        <div class="flex items-start justify-center gap-1" v-if="currentCardData.data.length > 0">
                            <ruby v-for="zk in currentCardData.data" :key="zk.zigen + zk.key" class="mx-0.5 heiti-Unyaa">
                                <span>{{ zk.zigen }}</span>
                                <rp>(</rp>
                                <rt class="font-mono text-xs text-blue-400 dark:text-blue-200">{{ zk.key }}</rt>
                                <rp>)</rp>
                            </ruby>
                        </div>
                    </div>
                    <span v-if="!currentCardData" class="text-gray-400 dark:text-gray-500 text-xs">无拆分数据</span>
                    <span v-if="!showHint && currentCardData" class="text-gray-400 dark:text-gray-500 text-xs absolute inset-0 flex items-center justify-center">查看提示</span>
                </div>
            </div>
        </div>
        </template>
    </div>
    
    <div v-if="!showConfetti" class="text-gray-500 flex flex-nowrap items-center md:justify-between overflow-x-auto gap-2 md:gap-4">
        <div class="text-gray-500 flex justify-between md:text-base text-sm gap-4">
            <span>进度：{{ progress }} / {{ max }}</span>
            <span>第 {{ round }} 轮</span>
        </div>
        <button class="md:text-sm text-xs" @click="exportLocalStorage">导出</button>
        <button class="md:text-sm text-xs" @click="importLocalStorage">导入（需要刷新）</button>
        <button class="btn btn-ghost md:text-sm text-xs font-light" @click="restart">重置</button>
    </div>
</template>

<style scoped>
.animate-pop {
    animation: bczPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes bczPop {
    0% {
        transform: scale(0.85);
        opacity: 0.5;
    }
    100% {
        transform: scale(1);
        opacity: 1;
    }
}
</style>
