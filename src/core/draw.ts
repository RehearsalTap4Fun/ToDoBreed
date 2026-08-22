import { hashStr, mulberry32, pick, shuffle, weightedPick } from './rng'
import { SLOT_ORDER, type Destiny, type SlotId, type ThemeDef } from './types'
import { ABERRATIONS, MUTATIONS, TRAIT_MAP, TRAITS } from '../data/traits'

/** 稀有度基础权重 N70 / R25 / L5（§07.1） */
const RARITY_WEIGHT = { N: 70, R: 25, L: 5 } as const
/** 连击加成：稀有 ×1.5、传说 ×2（§05.3） */
const STREAK_BOOST = { N: 1, R: 1.5, L: 2 } as const
/** 主题池命中概率（§07.1：70% 主题池 / 30% 全量池） */
const THEME_POOL_CHANCE = 0.7

/**
 * 蛋生成瞬间掷出的命运（v0.2b 起不含特征）：
 * 孵化判定骰、畸变预案、变异骰、命名词根。同一 seed 完全可复现。
 */
export function rollDestiny(theme: ThemeDef, seed: number): Destiny {
  const rng = mulberry32(seed)

  const judgmentRoll = rng() * 100

  const abCount = rng() < 0.6 ? 1 : 2
  const abSlots = shuffle(rng, SLOT_ORDER).slice(0, abCount)
  const aberrations = abSlots.map((slot) => ({ slot, ab: pick(rng, ABERRATIONS).id }))

  const mutationRoll = rng()
  const mutationPick = pick(rng, MUTATIONS).id

  const rootChar = pick(rng, theme.nameRoots)

  return { judgmentRoll, aberrations, mutationRoll, mutationPick, rootChar }
}

/**
 * 揭露瞬间掷定一个特征槽（v0.2b 决议）：
 * 结果由 (蛋种子, 槽位, 是否连击) 决定，掷出即入档——刷新不能重掷。
 * 互斥与联动从已揭露特征即时重算。
 */
export function rollTraitForSlot(
  theme: ThemeDef,
  eggSeed: number,
  slotIndex: number,
  chosen: Partial<Record<SlotId, string>>,
  rarityBoost: boolean,
): string {
  const slot = SLOT_ORDER[slotIndex]
  const rng = mulberry32(hashStr(`${eggSeed}|${slot}|${rarityBoost ? 'b' : 'n'}`))

  const excluded = new Set<string>()
  const boosts: Record<string, number> = {}
  for (const id of Object.values(chosen)) {
    if (!id) continue
    const t = TRAIT_MAP[id]
    for (const e of t.excludes ?? []) excluded.add(e)
    for (const [k, v] of Object.entries(t.boosts ?? {})) boosts[k] = (boosts[k] ?? 1) * v
  }

  const candidates = TRAITS.filter((t) => t.slot === slot && !excluded.has(t.id))
  const themePool = (theme.pools[slot] ?? []).filter((id) => candidates.some((c) => c.id === id))
  const useThemePool = themePool.length > 0 && rng() < THEME_POOL_CHANCE
  const pool = useThemePool ? candidates.filter((c) => themePool.includes(c.id)) : candidates

  const picked = weightedPick(
    rng,
    pool.map((t) => ({
      item: t,
      w: RARITY_WEIGHT[t.rarity] * (rarityBoost ? STREAK_BOOST[t.rarity] : 1) * (boosts[t.id] ?? 1),
    })),
  )
  return picked.id
}
