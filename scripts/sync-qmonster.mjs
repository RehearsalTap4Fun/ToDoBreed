#!/usr/bin/env node
/** 同步 QMonster v0.3.0 目录与部件资源到 qmonster-assets/（约 180MB，已 gitignore）。
 *  源：../RandomPet（git@github.com:RehearsalTap4Fun/RandomPet.git 的本地克隆）。 */
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(ROOT, '../RandomPet/packages/asset-catalog')
const DST = join(ROOT, 'qmonster-assets')
const VER = 'v0.3.0'

if (!existsSync(SRC)) {
  console.error('[sync-qmonster] 未找到 ../RandomPet，请先克隆 RandomPet 仓库到 ~/Demo/RandomPet')
  process.exit(1)
}
mkdirSync(join(DST, 'catalog'), { recursive: true })
mkdirSync(join(DST, 'assets'), { recursive: true })
cpSync(join(SRC, 'catalog', VER), join(DST, 'catalog', VER), { recursive: true })
cpSync(join(SRC, 'assets', VER), join(DST, 'assets', VER), { recursive: true })
console.log(`[sync-qmonster] 已同步 ${VER} 目录与资源 → qmonster-assets/`)
