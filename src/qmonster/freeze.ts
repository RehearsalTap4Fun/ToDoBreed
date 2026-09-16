import { Q_SLOT_ORDER, type CreatureRecord, type QSlotId, type Rarity } from '../core/types'
import { getCachedImage } from './image-cache'
import { renderRecordImage } from './orchestrator'
import { loadTraitIndex } from './semantics'
import { qmonsterAvailable } from './catalog'

/**
 * gen2 冻结：QMonster v0.3 运行时（源码别名 + 181MB 素材）下线前，把旧生物的可见信息写进存档——
 * 立绘缩到 512² 存为 data URL、语义特征 id 解析为展示名。此后旧生物只读、不再重绘，
 * 也随导出/导入跨源携带。图优先取 IndexedDB 缓存，缓存丢失且运行时仍在时重绘一次。
 */
export const FROZEN_SIZE = 512

export interface FrozenPatch {
  qimageData?: string
  qtraitNames?: Partial<Record<QSlotId, { name: string; rarity: Rarity }>>
}

const attempted = new Set<string>()

export function needsFreeze(rec: CreatureRecord): boolean {
  if (rec.kind !== 'qmonster') return false
  if (!rec.qimageData) return true
  return !!rec.qsemantic && !rec.qtraitNames
}

export async function freezeGen2Record(rec: CreatureRecord): Promise<FrozenPatch | null> {
  const key = `${rec.id}:${rec.qimageData ? 1 : 0}:${rec.qtraitNames ? 1 : 0}`
  if (attempted.has(key)) return null
  attempted.add(key)
  const patch: FrozenPatch = {}

  if (!rec.qimageData) {
    let blob = rec.qimageKey ? await getCachedImage(rec.qimageKey) : null
    if (!blob && qmonsterAvailable()) {
      try {
        blob = await renderRecordImage(rec)
      } catch {
        blob = null
      }
    }
    if (blob) patch.qimageData = await downscaleToDataUrl(blob, FROZEN_SIZE)
  }

  if (rec.qsemantic && !rec.qtraitNames && qmonsterAvailable()) {
    try {
      const index = await loadTraitIndex()
      const names: FrozenPatch['qtraitNames'] = {}
      for (const slot of Q_SLOT_ORDER) {
        const info = index.get(rec.qsemantic[slot])
        if (info) names[slot] = { name: info.displayName, rarity: info.rarity }
      }
      if (Object.keys(names).length > 0) patch.qtraitNames = names
    } catch {
      // 目录不可用：名字留待下次
    }
  }
  return Object.keys(patch).length > 0 ? patch : null
}

async function downscaleToDataUrl(blob: Blob, size: number): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('FREEZE_NO_CONTEXT')
  ctx.drawImage(bitmap, 0, 0, size, size)
  bitmap.close()
  const webp = canvas.toDataURL('image/webp', 0.85)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
}
