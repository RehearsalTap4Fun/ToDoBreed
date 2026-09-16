#!/usr/bin/env node
/**
 * 同步 QMonster v0.10 孵化 SDK 产物（dist/hatchery：qmonster.js + snapshot.json + 目录 + 39 张 PNG，约 49MB）
 * 到 qmonster-assets/hatchery/<runtimeRevision>/（已 gitignore），经 /qmonster/ 静态托管。
 * 源：$QMONSTER_HATCHERY_SRC，或 ../RandomPet-master/dist/hatchery（RandomPet master 工作树 `npm ci && npm run build` 产出）。
 */
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(ROOT, process.env.QMONSTER_HATCHERY_SRC ?? '../RandomPet-master/dist/hatchery')

if (!existsSync(join(SRC, 'snapshot.json'))) {
  console.error(
    `[sync-hatchery] 未找到 ${SRC}/snapshot.json\n` +
      '  请在 RandomPet master 工作树执行 npm ci && npm run build（产出 dist/hatchery），或设置 QMONSTER_HATCHERY_SRC',
  )
  process.exit(1)
}
const snapshot = JSON.parse(readFileSync(join(SRC, 'snapshot.json'), 'utf8'))
const rev = snapshot.runtimeRevision
const catalogSha = createHash('sha256').update(readFileSync(join(SRC, snapshot.catalogFile))).digest('hex')
if (catalogSha !== snapshot.catalogSha256) {
  console.error('[sync-hatchery] 目录字节哈希与 snapshot.json 不符，拒绝同步（产物可能损坏或被改写）')
  process.exit(1)
}
const DST = join(ROOT, 'qmonster-assets', 'hatchery', rev)
mkdirSync(DST, { recursive: true })
cpSync(SRC, DST, { recursive: true })
console.log(`[sync-hatchery] 已同步 runtimeRevision ${rev.slice(0, 12)}… → qmonster-assets/hatchery/`)

const pinned = readFileSync(join(ROOT, 'src/qmonster/feline/sdk.ts'), 'utf8').match(
  /FELINE_RUNTIME_REVISION =\s*'([0-9a-f]{64})'/,
)?.[1]
if (pinned === rev) {
  // SDK 静态内联进应用：钉版一致时同步 vendor 副本（单文件形态也靠它）
  cpSync(join(SRC, 'qmonster.js'), join(ROOT, 'src/qmonster/feline/vendor/qmonster.js'))
  console.log('[sync-hatchery] 已刷新 src/qmonster/feline/vendor/qmonster.js')
}
if (pinned && pinned !== rev) {
  console.warn(
    `[sync-hatchery] 注意：src/qmonster/feline/sdk.ts 钉的是 ${pinned.slice(0, 12)}…，与本次产物不同；` +
      '更新常量后应用才会加载新版本（旧版本目录保留供旧存档回放）',
  )
}
