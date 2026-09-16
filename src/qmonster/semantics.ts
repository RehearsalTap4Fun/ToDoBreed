import type { CreatureRecord, QSlotId, Rarity } from '../core/types'

/**
 * gen2（QMonster v0.3 语义特征）只读展示。运行时已于 2026-09-16 下线：
 * 特征展示名在冻结时写入 record.qtraitNames，此处不再查目录。
 */

/** v0.3.0 目录的语义特征总数（图鉴收集分母，历史常量） */
export const Q_TRAIT_TOTAL = 61

export function qTraitDisplay(
  rec: Pick<CreatureRecord, 'qtraitNames'>,
  slot: QSlotId,
): { name: string; rarity: Rarity } | undefined {
  return rec.qtraitNames?.[slot]
}
