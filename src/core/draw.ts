import { mulberry32, pick, shuffle, weightedPick } from './rng'
import { SLOT_ORDER, type Destiny, type SlotId, type ThemeDef } from './types'
import { ABERRATIONS, TRAITS } from '../data/traits'

const RARITY_WEIGHT = { N: 70, R: 25 } as const
/** 主题池命中概率（§07.1：70% 主题池 / 30% 全量池） */
const THEME_POOL_CHANCE = 0.7

/**
 * 蛋生成瞬间掷出全部命运（§13.1）：8 个特征、孵化判定骰、畸变预案、命名词根。
 * 同一 seed 的结果完全可复现，刷新不能重掷。
 */
export function rollDestiny(theme: ThemeDef, seed: number): Destiny {
  const rng = mulberry32(seed)
  const chosen = {} as Record<SlotId, string>
  const excluded = new Set<string>()
  const boosts: Record<string, number> = {}

  for (const slot of SLOT_ORDER) {
    const candidates = TRAITS.filter((t) => t.slot === slot && !excluded.has(t.id))
    const themePool = (theme.pools[slot] ?? []).filter((id) => candidates.some((c) => c.id === id))
    const useThemePool = themePool.length > 0 && rng() < THEME_POOL_CHANCE
    const pool = useThemePool ? candidates.filter((c) => themePool.includes(c.id)) : candidates

    const picked = weightedPick(
      rng,
      pool.map((t) => ({ item: t, w: RARITY_WEIGHT[t.rarity] * (boosts[t.id] ?? 1) })),
    )
    chosen[slot] = picked.id
    for (const e of picked.excludes ?? []) excluded.add(e)
    for (const [id, m] of Object.entries(picked.boosts ?? {})) boosts[id] = (boosts[id] ?? 1) * m
  }

  const judgmentRoll = rng() * 100

  const abCount = rng() < 0.6 ? 1 : 2
  const abSlots = shuffle(rng, SLOT_ORDER).slice(0, abCount)
  const aberrations = abSlots.map((slot) => ({ slot, ab: pick(rng, ABERRATIONS).id }))

  const rootChar = pick(rng, theme.nameRoots)

  return { traits: chosen, judgmentRoll, aberrations, rootChar }
}
