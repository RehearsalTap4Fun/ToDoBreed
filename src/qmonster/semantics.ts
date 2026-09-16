import { useEffect, useState } from 'react'
import type { Catalog } from '@qmonster/generator-core'
import type { MonsterSpec } from '@qmonster/generator-core'
import { Q_SLOT_ORDER, type CreatureRecord, type QIdentity, type QSlotId, type Rarity } from '../core/types'
import { loadCatalog, qmonsterAvailable } from './catalog'

export interface QTraitInfo {
  id: string
  displayName: string
  flavorText: string
  rarity: Rarity
  semanticSlotId: string
}

/** 语义特征索引：traitId → 展示信息（displayName/flavorText/rarity 均以 catalog 为准） */
export function buildTraitIndex(catalog: Catalog): Map<string, QTraitInfo> {
  return new Map(
    catalog.semanticTraits.map((t) => [
      t.id,
      {
        id: t.id,
        displayName: t.displayName,
        flavorText: t.flavorText,
        rarity: t.rarity,
        semanticSlotId: t.semanticSlotId,
      },
    ]),
  )
}

let indexPromise: Promise<Map<string, QTraitInfo>> | null = null

export function loadTraitIndex(): Promise<Map<string, QTraitInfo>> {
  if (indexPromise === null) {
    indexPromise = loadCatalog()
      .then(buildTraitIndex)
      .catch((error) => {
        indexPromise = null
        throw error
      })
  }
  return indexPromise
}

/** UI 用：语义特征索引 Hook（file:// 或加载失败时返回 null，界面降级显示占位） */
export function useTraitIndex(): Map<string, QTraitInfo> | null {
  const [index, setIndex] = useState<Map<string, QTraitInfo> | null>(null)
  useEffect(() => {
    if (!qmonsterAvailable()) return
    let cancelled = false
    loadTraitIndex()
      .then((idx) => {
        if (!cancelled) setIndex(idx)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return index
}

/** gen2 语义特征展示：冻结名优先，其次目录索引（运行时下线后只剩前者） */
export function qTraitDisplay(
  rec: Pick<CreatureRecord, 'qsemantic' | 'qtraitNames'>,
  slot: QSlotId,
  index: Map<string, QTraitInfo> | null,
): { name: string; rarity: Rarity } | undefined {
  const frozen = rec.qtraitNames?.[slot]
  if (frozen) return frozen
  const id = rec.qsemantic?.[slot]
  const info = id ? index?.get(id) : undefined
  return info ? { name: info.displayName, rarity: info.rarity } : undefined
}

/** spec → 语义槽映射 */
export function semanticOf(spec: MonsterSpec): QIdentity['slots'] {
  return Object.fromEntries(
    Q_SLOT_ORDER.map((slot) => [slot, spec.semanticTraits[slot]?.primaryTraitId ?? '']),
  ) as QIdentity['slots']
}

/** gen2 命名：主题词根 + 最高稀有度语义特征 displayName 首字（L > R > N） */
export function makeQName(
  rootChar: string,
  semantic: Record<QSlotId, string>,
  index: Map<string, QTraitInfo>,
): string {
  const order: Record<Rarity, number> = { N: 0, R: 1, L: 2 }
  let best: QTraitInfo | null = null
  for (const slot of Q_SLOT_ORDER) {
    const info = index.get(semantic[slot])
    if (!info) continue
    if (best === null || order[info.rarity] > order[best.rarity]) best = info
  }
  const char = best?.displayName.trim()[0]
  if (!char || char === rootChar) return `${rootChar}${best?.displayName.trim()[1] ?? '灵'}`
  return `${rootChar}${char}`
}
