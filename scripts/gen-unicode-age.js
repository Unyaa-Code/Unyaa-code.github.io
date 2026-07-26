#!/usr/bin/env node
/**
 * 从 Unicode 官方源拉取 DerivedAge.txt，解析为紧凑的区间数据，
 * 供拆分查询页面展示字符的 Unicode 版本号。
 *
 * 输出：src/public/data/unicode-age.json
 *   {
 *     source:  官方地址
 *     generated: 生成日期
 *     ranges: [[startCodePoint, endCodePoint, "版本号"], ...]   // 仅含已分配字符
 *   }
 *
 * 由于 unicode.org 未开启 CORS，浏览器无法在运行时直连，
 * 因此在构建阶段拉取最新数据并打包；配合 CI 定时重新构建即可保持始终最新。
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.join(__dirname, '..', 'src', 'public')
const outPath = path.join(publicDir, 'data', 'unicode-age.json')

const SOURCE = 'https://www.unicode.org/Public/UCD/latest/ucd/DerivedAge.txt'

async function main() {
  let text
  try {
    const resp = await fetch(SOURCE)
    if (!resp.ok) throw new Error('HTTP ' + resp.status)
    text = await resp.text()
  } catch (e) {
    console.warn('[gen-unicode-age] 无法从 Unicode 官方源下载 DerivedAge.txt：', e.message)
    if (fs.existsSync(outPath)) {
      console.warn('[gen-unicode-age] 保留已有的 unicode-age.json，构建继续进行')
      process.exit(0)
    }
    // 没有任何基础数据时写入空数据，避免构建失败
    fs.writeFileSync(outPath, JSON.stringify({
      source: SOURCE,
      generated: new Date().toISOString().slice(0, 10),
      ranges: [],
    }))
    console.warn('[gen-unicode-age] 已写入空的 unicode-age.json（无网络）')
    process.exit(0)
  }

  /** @type {[number, number, string][]} */
  const ranges = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const sepIdx = line.indexOf(';')
    if (sepIdx < 0) continue
    const rangePart = line.slice(0, sepIdx).trim()
    // 去掉行尾注释（如 "13.0 # [xxx] ..."），只保留版本号
    const version = line.slice(sepIdx + 1).split('#')[0].trim()
    // 跳过尚未分配的区段（如 "Unassigned"）
    if (!/^\d/.test(version)) continue

    let start, end
    if (rangePart.includes('..')) {
      const [s, e] = rangePart.split('..')
      start = parseInt(s, 16)
      end = parseInt(e, 16)
    } else {
      start = end = parseInt(rangePart, 16)
    }
    if (Number.isNaN(start) || Number.isNaN(end)) continue
    ranges.push([start, end, version])
  }
  ranges.sort((a, b) => a[0] - b[0])

  const data = {
    source: SOURCE,
    generated: new Date().toISOString().slice(0, 10),
    ranges,
  }
  fs.writeFileSync(outPath, JSON.stringify(data))
  console.log(`[gen-unicode-age] 已生成 ${ranges.length} 条 Unicode 版本区间 -> ${path.relative(process.cwd(), outPath)}`)
}

main()
