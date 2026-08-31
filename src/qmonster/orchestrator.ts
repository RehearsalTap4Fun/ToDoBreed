import type { MonsterSpec } from '@qmonster/generator-core'
import { QMONSTER_RENDERER_SIZE, hatchValidSpec } from './hatch'
import { THEME_TO_Q } from './hatch'
import { loadCatalog, qmonsterAvailable } from './catalog'
import { getCachedImage, putCachedImage, specSha256 } from './image-cache'
import { loadTraitIndex, makeQName, semanticOf } from './semantics'
import type { CreatureRecord, Egg, QIdentity } from '../core/types'
import { exportCanvas } from '@qmonster/renderer-canvas'

/**
 * gen2 异步编排层：引擎保持同步纯函数，QMonster 的身份解析（生成+渲染质检）
 * 与立绘落缓存在此完成，结果通过 setEggIdentity / setRecordSpec 回写存档。
 */

function offscreen(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = QMONSTER_RENDERER_SIZE
  canvas.height = QMONSTER_RENDERER_SIZE
  return canvas
}

/** 解析蛋的正常形态身份（揭露与观察卡的数据来源） */
export async function resolveEggIdentity(egg: Egg): Promise<QIdentity> {
  if (!egg.qseed) throw new Error('NOT_GEN2')
  const catalog = await loadCatalog()
  const { spec } = await hatchValidSpec(
    egg.qseed,
    THEME_TO_Q[egg.theme],
    'normal',
    catalog,
    offscreen(),
  )
  return { resolvedSeed: spec.seed, slots: semanticOf(spec) }
}

export interface RecordResolution {
  qspec: MonsterSpec
  qsemantic: Record<string, string>
  qimageKey: string
  name: string
}

/** 解析档案的最终形态：按判定模式生成 → 渲染 → WebP/PNG 入 IndexedDB 缓存 */
export async function resolveRecord(record: CreatureRecord): Promise<RecordResolution> {
  if (record.kind !== 'qmonster' || !record.qseed || !record.qmode) throw new Error('NOT_GEN2')
  const catalog = await loadCatalog()
  const canvas = offscreen()
  const { spec } = await hatchValidSpec(
    record.qseed,
    THEME_TO_Q[record.theme],
    record.qmode,
    catalog,
    canvas,
  )

  let blob: Blob
  try {
    blob = await exportCanvas(canvas, 'image/webp')
  } catch {
    blob = await exportCanvas(canvas, 'image/png')
  }
  const sha = await specSha256(spec)
  const key = `qm:${spec.catalogVersion}:${spec.rendererVersion}:${QMONSTER_RENDERER_SIZE}:1:${sha}`
  await putCachedImage(key, blob)

  const semantic = semanticOf(spec)
  const index = await loadTraitIndex()
  return {
    qspec: spec,
    qsemantic: semantic,
    qimageKey: key,
    name: makeQName(record.name[0] ?? '怪', semantic, index),
  }
}

/** 缓存未命中时按权威 spec 重绘并回填缓存（对接指南 §6.3） */
export async function renderRecordImage(record: CreatureRecord): Promise<Blob | null> {
  if (record.kind !== 'qmonster') return null
  if (record.qimageKey) {
    const hit = await getCachedImage(record.qimageKey)
    if (hit) return hit
  }
  if (!record.qspec || !qmonsterAvailable()) return null
  const catalog = await loadCatalog()
  const canvas = offscreen()
  const { renderSpecToCanvas } = await import('./hatch')
  await renderSpecToCanvas(record.qspec as MonsterSpec, catalog, canvas, { groundShadow: true })
  let blob: Blob
  try {
    blob = await exportCanvas(canvas, 'image/webp')
  } catch {
    blob = await exportCanvas(canvas, 'image/png')
  }
  if (record.qimageKey) await putCachedImage(record.qimageKey, blob)
  return blob
}
