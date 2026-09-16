import type { CreatureRecord } from '../core/types'
import { getCachedImage } from './image-cache'

/**
 * gen2 冻结（收尾）：QMonster v0.3 运行时已下线，旧生物只读。若某只旧生物的立绘尚未写进存档
 * 但本源 IndexedDB 里还有当年渲染的缓存，则缩到 512² 存为 data URL 补齐；缓存也没有则只能保持占位。
 * 语义特征名已随 2026-09-16 的冻结写入 qtraitNames，此处不再处理。
 */
export const FROZEN_SIZE = 512

export interface FrozenPatch {
  qimageData?: string
}

const attempted = new Set<string>()

export function needsFreeze(rec: CreatureRecord): boolean {
  return rec.kind === 'qmonster' && !rec.qimageData && !!rec.qimageKey
}

export async function freezeGen2Record(rec: CreatureRecord): Promise<FrozenPatch | null> {
  if (attempted.has(rec.id)) return null
  attempted.add(rec.id)
  const blob = rec.qimageKey ? await getCachedImage(rec.qimageKey) : null
  if (!blob) return null
  return { qimageData: await downscaleToDataUrl(blob, FROZEN_SIZE) }
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
