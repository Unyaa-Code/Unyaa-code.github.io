#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.join(__dirname, '..', 'src', 'public')

const keyMaps = {
    'Unyaa-code/chaifen.json': [
        ['comp', 'c'],
        ['key', 'k'],
    ],
    'Unyaa-code/zigen.json': [
        ['name', 'n'],
        ['key', 'k'],
        ['rel', 'r'],
        ['secondary', 's'],
        ['class', 'l'],
        ['kind', 'd'],
    ],
    'Unyaa-code/zigen2.json': [
        ['name', 'n'],
        ['key', 'k'],
        ['rel', 'r'],
        ['secondary', 's'],
        ['class', 'l'],
        ['kind', 'd'],
    ],
}

function applyKeyMap(obj, keyMap, reverse) {
    if (Array.isArray(obj)) {
        return obj.map(item => {
            if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
                return applyKeyMap(item, keyMap, reverse)
            }
            return item
        })
    }
    if (obj !== null && typeof obj === 'object') {
        const result = {}
        for (const [k, v] of Object.entries(obj)) {
            let newKey = k
            for (const [long, short] of keyMap) {
                if (reverse) {
                    if (k === short) { newKey = long; break }
                } else {
                    if (k === long) { newKey = short; break }
                }
            }
            result[newKey] = v
        }
        return result
    }
    return obj
}

function processDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            processDir(fullPath)
        } else if (entry.name.endsWith('.json') && !entry.name.endsWith('.json.gz') && entry.name !== 'data-version.json') {
            const relPath = path.relative(publicDir, fullPath).replace(/\\/g, '/')
            const keyMap = keyMaps[relPath]

            const originalContent = fs.readFileSync(fullPath, 'utf-8')
            let jsonData = JSON.parse(originalContent)

            if (keyMap) {
                jsonData = applyKeyMap(jsonData, keyMap, false)
                jsonData.$v = 1
            }

            const jsonStr = JSON.stringify(jsonData)
            const gzipBuffer = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'))
            const gzipPath = fullPath + '.gz'
            fs.writeFileSync(gzipPath, gzipBuffer)

            filesHash[relPath] = crypto.createHash('sha256').update(originalContent).digest('hex').slice(0, 12)
        }
    }
}

const filesHash = {}

processDir(publicDir)

const version = {
    files: filesHash,
}
fs.writeFileSync(path.join(publicDir, 'data-version.json'), JSON.stringify(version))

