import type { CreatureRecord } from '../../core/types'
import { getCachedImage, putCachedImage } from '../image-cache'
import { toSdkSelections } from './rules'
import { felineAvailable, loadFelineHatchery, type StoredFelineVisual } from './sdk'

/**
 * gen3 异步编排层：引擎在破壳时已同步定下最终形态（fplan）；这里只负责让 SDK 合成立绘、
 * 把 WebP 存进 IndexedDB，并把 SDK 的形象身份（StoredFelineVisual）回写存档。
 * 缓存丢失时按存档里的 fvisual restore，重绘结果字节一致（SDK 契约）。
 */
export interface FelineResolution {
  fvisual: StoredFelineVisual
  fimageKey: string
}

export async function resolveFelineRecord(record: CreatureRecord): Promise<FelineResolution> {
  if (record.kind !== 'feline' || !record.fseed || !record.fplan) throw new Error('NOT_GEN3')
  const hatchery = await loadFelineHatchery()
  const result = await hatchery.hatch(record.fseed, toSdkSelections(record.fplan))
  await putCachedImage(result.image.cacheKey, result.image.blob)
  return { fvisual: result.visual, fimageKey: result.image.cacheKey }
}

/** 取立绘：IndexedDB 命中 → 直接返回；未命中 → 按 fvisual restore（或按 fplan 重新 hatch）并回填缓存 */
export async function renderFelineImage(record: CreatureRecord): Promise<Blob | null> {
  if (record.kind !== 'feline') return null
  if (record.fimageKey) {
    const hit = await getCachedImage(record.fimageKey)
    if (hit) return hit
  }
  if (!felineAvailable()) return null
  const hatchery = await loadFelineHatchery()
  const result = record.fvisual
    ? await hatchery.restore(record.fvisual)
    : record.fseed && record.fplan
      ? await hatchery.hatch(record.fseed, toSdkSelections(record.fplan))
      : null
  if (!result) return null
  await putCachedImage(result.image.cacheKey, result.image.blob)
  return result.image.blob
}
