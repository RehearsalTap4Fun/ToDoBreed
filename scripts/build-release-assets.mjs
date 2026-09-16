#!/usr/bin/env node
/**
 * 生成 release/qmonster-files/：file:// 单文件形态下按需注入的 SDK 素材脚本（每个资源一份）。
 * 内容：window.__QMONSTER_FILES__[path] = { t: mime, d: base64 }；另有 manifest.js 声明运行版本与文件清单。
 * 源：qmonster-assets/hatchery/<src/qmonster/feline/sdk.ts 钉的 runtimeRevision>/（先 npm run sync:hatchery）。
 * 文件名规则与 src/qmonster/feline/offline.ts 的 scriptNameFor 一致：path 中的 "/" → "__"，再加 ".js"。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pinned = readFileSync(join(ROOT, 'src/qmonster/feline/sdk.ts'), 'utf8').match(
  /FELINE_RUNTIME_REVISION =\s*'([0-9a-f]{64})'/,
)?.[1]
if (!pinned) {
  console.error('[release-assets] 读不到 src/qmonster/feline/sdk.ts 里的 FELINE_RUNTIME_REVISION')
  process.exit(1)
}
const SRC = join(ROOT, 'qmonster-assets', 'hatchery', pinned)
if (!existsSync(join(SRC, 'snapshot.json'))) {
  console.error(`[release-assets] 未找到 ${SRC}，请先 npm run sync:hatchery`)
  process.exit(1)
}
const snapshot = JSON.parse(readFileSync(join(SRC, 'snapshot.json'), 'utf8'))
const OUT = join(ROOT, 'release', 'qmonster-files')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const MIME = { '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' }
const scriptNameFor = (path) => `${path.replace(/\//g, '__')}.js`
const files = [snapshot.catalogFile, ...snapshot.resources.map((r) => r.path)]
let total = 0
for (const path of files) {
  const bytes = readFileSync(join(SRC, path))
  const mime = MIME[extname(path)] ?? 'application/octet-stream'
  const body =
    'window.__QMONSTER_FILES__=window.__QMONSTER_FILES__||{};' +
    `window.__QMONSTER_FILES__[${JSON.stringify(path)}]={t:${JSON.stringify(mime)},d:"${bytes.toString('base64')}"};\n`
  writeFileSync(join(OUT, scriptNameFor(path)), body)
  total += body.length
}
writeFileSync(
  join(OUT, 'manifest.js'),
  `window.__QMONSTER_FILES_MANIFEST__=${JSON.stringify({ rev: pinned, catalogFile: snapshot.catalogFile, files })};\n`,
)
console.log(
  `[release-assets] 已生成 release/qmonster-files/：${files.length} 个资源脚本 + manifest.js，共 ${(total / 1048576).toFixed(1)} MB（运行版本 ${pinned.slice(0, 12)}…）`,
)
