// https://vitepress.dev/guide/custom-theme
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme-without-fonts'
import Download from "./components/Download.vue";
import type { EnhanceAppContext } from 'vitepress'
import { useMediumZoomProvider } from '../hooks'
import './style.css'
import './fonts.css'
import './animate.css'

/**
 * 修复移动端PUA字体渲染竞赛问题
 *
 * 问题：移动端浏览器在自定义字体加载完成前就完成了首帧绘制，
 * 导致PUA字符（如 ）显示为豆腐块。即使字体加载完成，
 * 部分浏览器也不会主动重新评估已绘制文本的字体匹配。
 *
 * 解决：字体加载完成后，通过修改letter-spacing触发浏览器
 * 重新布局所有文本，强制重新评估字体匹配，确保PUA字符正确渲染。
 */
function initPuaFontFix() {
  if (typeof window === 'undefined') return
  if (!('fonts' in document)) return

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  if (!isMobile) return

  document.fonts.load('1em Unyaaa-codePUA').finally(() => {
    // 字体加载完成（无论成功失败），强制浏览器重新评估文本渲染
    // 通过临时修改letter-spacing触发全局重排，解决PUA字符不更新的问题
    const style = document.createElement('style')
    style.id = 'pua-repaint-fix'
    style.textContent = 'body{letter-spacing:0.001em}'
    document.head.appendChild(style)
    // 双重rAF确保浏览器完成重排后再恢复，避免视觉闪烁
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById('pua-repaint-fix')
        if (el) el.remove()
      })
    })
  })
}

export default {
  extends: DefaultTheme,

  enhanceApp({ app, router, siteData }) {
    // 注册全局组件
    app.component('Download', Download)
    useMediumZoomProvider(app, router)
    // 修复移动端PUA字体渲染问题
    initPuaFontFix()
  }
} satisfies Theme