<script setup lang="ts">
import { getSchemaNameFromRoute } from "../search/share";
import { useLocalStorage } from "@vueuse/core";
import { watch, ref, nextTick } from "vue";
//@ts-expect-error
import { startConfette } from "./startConfette.js";


const p = defineProps<{
    /** 方案名称, 省略会自动推断 */
    id?: string
    /** 当前的练习进度 */
    progress: number
    /** 全部进度 */
    max: number
    /** 当前题目的回答是否正确 */
    isCorrect: boolean
}>()

defineEmits(['restart'])

const id = p.id || getSchemaNameFromRoute()
const alreadyShowConfetti = useLocalStorage(`yima_${id}-complete`, false)

// 烟花特效
const showConfetti = ref(false)
watch(() => p.progress, async (newV, oldV) => {
    if (!alreadyShowConfetti.value && newV === p.max && newV > oldV) {
        alreadyShowConfetti.value = true
        showConfetti.value = true
        await nextTick()
        startConfette()
    }
})

function exportLocalStorage() {
    let data = JSON.stringify(localStorage,null, 4);    
    let blob = new Blob([data], {type: "charset=utf-8"});  
    let url = URL.createObjectURL(blob);  
  
    let link = document.createElement('a');  
    link.href = url;  
    link.download = 'progress'; // 你可以设置任何你想要的下载文件名  
    link.click();
    link.remove()
}

function importLocalStorage() {
    
const fileInput = document.createElement('input');
fileInput.type = 'file';
 
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    
    if (file) {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const contents = event.target.result;
            
            // 2. 将文件内容解析为 JSON 数据并写入 localStorage
            try {
                const parsedData = JSON.parse(contents);
                Object.keys(parsedData).forEach(key => {
                    localStorage.setItem(key, parsedData[key]);
                });
                alert('导入成功！');
            } catch (error) {
                alert('导入失败：文件格式错误！');
            }
        };
        
        reader.readAsText(file);
    }
});
 
fileInput.click();
}

</script>

<template>
    <div
        :class="['md:w-2/3 w-full shadow-sm my-6 pb-20 bg-opacity-10 transition-color rounded-md', { 'bg-red-700': !isCorrect, 'bg-slate-500': isCorrect }]">
        <div class="flex justify-center mb-24">
            <progress class="progress w-full" :value="progress" :max />
        </div>
        <template v-if="showConfetti">
            <div class="p-10 text-6xl text-center font-bold text-orange-800 font-sans tracking-widest -rotate-6">
                🎉恭喜完成练习!!</div>
            <div class="flex justify-center mt-10">
                <button class="btn btn-success" @click="_ => showConfetti = false">继续练习</button>
            </div>
        </template>
        <template v-else>
            <slot />
        </template>
    </div>

    <div v-if="!showConfetti" class="text-gray-500 flex flex-nowrap items-center md:justify-between overflow-x-auto gap-2 md:gap-4">
        <div class="text-gray-500 flex justify-between md:text-base text-sm">进度： {{ progress }} / {{ max }}</div>
        <button class="md:text-sm text-xs" @click="exportLocalStorage">导出</button>
        <button class="md:text-sm text-xs" @click="importLocalStorage">导入（需要刷新）</button>
        <button class="btn btn-ghost md:text-sm text-xs font-light" @click="$emit('restart')">重置</button>
    </div>
</template>