import { hashStr, mulberry32, pick, weightedPick, type Rng } from '../../core/rng'
import type { Coat, Expression, FelineSelections, MutationSlot } from './sdk'
import {
  ALL_MUTATION_IDS,
  LIVE_MUTATION_IDS,
  MUTATION_CHARS,
  MUTATION_DEFS,
  MUTATION_MAP,
  TIER_ORDER,
  isSdkMutation,
  type AnyMutationId,
  type MutationDef,
} from './mutations'
import { FELINE_THEME_MAP, type FelineTheme, type FelineThemeId } from './themes'
import type { Rarity } from '../../core/types'

/**
 * gen3 孵化规则 v2（孵化器侧版本化；SDK 不管稀有度/主题/判定）：
 * - 判定 → 异变处数：正常 0–1、变异 2–3、畸变 3–5（同 v1）
 * - 异变分层：登记表给每件 N/R/L；每次抽取先按判定掷层，再在层内按主题亲和加权
 *   （标志 ×6、次级/亲和 ×3、其他 ×1；畸变反过来压低本主题件）
 * - 每次抽取先掷层；正常态掷到 N 层时首件 80% 直接给标志异变（掷到 R/L 即惊喜）；变异态首件必为标志
 * - 稀有度 = max(所选异变最高层, 处数层)，处数层 0–1 N / 2 R / ≥3 L（v1 规则作为下限）
 * - 素材可用性按花纹过滤（待素材的 R/L 件不会被渲染到，但可进分布预演）
 * - 全部从 seed 确定性派生，同 seed+主题+判定+可用性 永远同一只
 */
export const FELINE_RULES_VERSION = 'feline-rules-v2'

export type FelineMode = 'normal' | 'mutation' | 'aberration'

export const FELINE_MODE_COUNTS: Record<FelineMode, { counts: number[]; weights: number[] }> = {
  normal: { counts: [0, 1], weights: [35, 65] },
  mutation: { counts: [2, 3], weights: [60, 40] },
  aberration: { counts: [3, 4, 5], weights: [40, 40, 20] },
}

/** 正常态首件直接给标志异变的概率 */
export const SIGNATURE_CHANCE = 0.8

/** 每次抽取的层权重 */
export const TIER_WEIGHTS: Record<FelineMode, Record<Rarity, number>> = {
  normal: { N: 82, R: 15, L: 3 },
  mutation: { N: 45, R: 40, L: 15 },
  aberration: { N: 30, R: 40, L: 30 },
}

/** 层内主题亲和权重 */
export const AFFINITY_WEIGHTS = { signature: 6, secondary: 3, affinity: 3, other: 1 } as const
/** 畸变态：本主题相关件的权重压到这个倍数（非本主题件为 1） */
export const ABERRANT_THEME_WEIGHT = 0.25

/** 可用性：某花纹下可渲染的异变 id 集合 */
export type Availability = (coat: Coat) => ReadonlySet<string>
const LIVE_SET: ReadonlySet<string> = new Set(LIVE_MUTATION_IDS)
const ALL_SET: ReadonlySet<string> = new Set(ALL_MUTATION_IDS)
export const LIVE_AVAILABILITY: Availability = () => LIVE_SET
export const FULL_AVAILABILITY: Availability = () => ALL_SET

export interface PlanSelections {
  coat: Coat
  expression: Expression
  crown: string
  ears: string
  neck: string
  back: string
  tailTip: string
}

export interface FelinePlan {
  theme: FelineThemeId
  mode: FelineMode
  seed: string
  selections: PlanSelections
  mutations: AnyMutationId[]
  /** 所选异变中的最高层（无异变为 N） */
  tier: Rarity
  rarity: Rarity
  aberrant: boolean
  name: string
}

const tierIndex = (t: Rarity) => TIER_ORDER.indexOf(t)
const maxTier = (a: Rarity, b: Rarity): Rarity => (tierIndex(a) >= tierIndex(b) ? a : b)

function rollCount(rng: Rng, mode: FelineMode): number {
  const { counts, weights } = FELINE_MODE_COUNTS[mode]
  return weightedPick(
    rng,
    counts.map((c, i) => ({ item: c, w: weights[i] })),
  )
}

function rollTier(rng: Rng, mode: FelineMode): Rarity {
  const w = TIER_WEIGHTS[mode]
  return weightedPick(
    rng,
    TIER_ORDER.map((t) => ({ item: t, w: w[t] })),
  )
}

/** 掷到的层没有候选时的回退顺序 */
function fallbackTiers(t: Rarity): Rarity[] {
  if (t === 'L') return ['L', 'R', 'N']
  if (t === 'R') return ['R', 'N', 'L']
  return ['N', 'R', 'L']
}

type Relation = keyof typeof AFFINITY_WEIGHTS

function relationOf(theme: FelineTheme, id: AnyMutationId): Relation {
  if (id === theme.signature) return 'signature'
  if (theme.secondary.includes(id)) return 'secondary'
  if (theme.affinity.includes(id)) return 'affinity'
  return 'other'
}

function affinityWeight(theme: FelineTheme, mode: FelineMode, id: AnyMutationId): number {
  const rel = relationOf(theme, id)
  if (mode === 'aberration') return rel === 'other' ? 1 : ABERRANT_THEME_WEIGHT
  return AFFINITY_WEIGHTS[rel]
}

function pickInTier(
  rng: Rng,
  theme: FelineTheme,
  mode: FelineMode,
  tier: Rarity,
  candidates: MutationDef[],
): MutationDef | null {
  const pool = candidates.filter((d) => d.tier === tier)
  if (pool.length === 0) return null
  return weightedPick(
    rng,
    pool.map((d) => ({ item: d, w: affinityWeight(theme, mode, d.id) })),
  )
}

export function countTier(mutationCount: number): Rarity {
  if (mutationCount >= 3) return 'L'
  if (mutationCount === 2) return 'R'
  return 'N'
}

export function tierOf(mutations: AnyMutationId[]): Rarity {
  return mutations.reduce<Rarity>((acc, id) => maxTier(acc, MUTATION_DEFS.find((d) => d.id === id)?.tier ?? 'N'), 'N')
}

/** 稀有度 = max(最高异变层, 处数层) */
export function rarityOf(mutations: AnyMutationId[]): Rarity {
  return maxTier(tierOf(mutations), countTier(mutations.length))
}

export function felineName(rng: Rng, theme: FelineTheme, mutations: AnyMutationId[]): string {
  let root = pick(rng, theme.nameRoots)
  if (mutations.length < 2) return `${root}喵`
  const top = tierOf(mutations)
  const tops = mutations.filter((m) => (MUTATION_DEFS.find((d) => d.id === m)?.tier ?? 'N') === top)
  const lead = tops.includes(theme.signature) ? theme.signature : tops[0]
  const ch = MUTATION_CHARS[lead]
  if (root === ch) {
    const alt = theme.nameRoots.filter((c) => c !== ch)
    if (alt.length > 0) root = pick(rng, alt)
  }
  return `${root}${ch}喵`
}

/** 由 seed + 主题 + 判定（+ 可用性）确定性生成一只猫的完整选项与命名 */
export function planFeline(
  seed: string,
  themeId: FelineThemeId,
  mode: FelineMode,
  available: Availability = LIVE_AVAILABILITY,
): FelinePlan {
  const theme = FELINE_THEME_MAP[themeId]
  const rng = mulberry32(hashStr(`${seed}|${themeId}|${mode}|${FELINE_RULES_VERSION}`))
  const coat = weightedPick(rng, theme.coats)
  const expression = weightedPick(rng, theme.expressions)
  const count = rollCount(rng, mode)

  const avail = available(coat)
  let candidates = MUTATION_DEFS.filter((d) => avail.has(d.id))
  const taken: AnyMutationId[] = []
  const take = (d: MutationDef) => {
    taken.push(d.id)
    candidates = candidates.filter((c) => c.slot !== d.slot)
  }

  while (taken.length < count && candidates.length > 0) {
    const first = taken.length === 0
    const sig = candidates.find((c) => c.id === theme.signature)
    // 变异态：首件必为标志异变（主题辨识度）
    if (first && mode === 'mutation' && sig) {
      take(sig)
      continue
    }
    const rolled = rollTier(rng, mode)
    // 正常态：掷到 N 层时首件 80% 直接给标志异变；掷到 R/L 就是这颗蛋的惊喜
    if (first && mode === 'normal' && rolled === 'N' && sig && rng() < SIGNATURE_CHANCE) {
      take(sig)
      continue
    }
    let picked: MutationDef | null = null
    for (const t of fallbackTiers(rolled)) {
      picked = pickInTier(rng, theme, mode, t, candidates)
      if (picked) break
    }
    if (!picked) break
    take(picked)
  }

  const selections: PlanSelections = {
    coat,
    expression,
    crown: 'none',
    ears: 'none',
    neck: 'none',
    back: 'none',
    tailTip: 'none',
  }
  for (const id of taken) {
    const slot = (MUTATION_DEFS.find((d) => d.id === id) as MutationDef).slot
    selections[slot] = id
  }

  return {
    theme: themeId,
    mode,
    seed,
    selections,
    mutations: taken,
    tier: tierOf(taken),
    rarity: rarityOf(taken),
    aberrant: mode === 'aberration',
    name: felineName(rng, theme, taken),
  }
}

const MUTATION_SLOTS: MutationSlot[] = ['crown', 'ears', 'neck', 'back', 'tailTip']

/** 渲染前最后一道校验：计划里的异变必须是 SDK 认识的 id */
export function toSdkSelections(plan: FelinePlan): FelineSelections {
  for (const slot of MUTATION_SLOTS) {
    const v = plan.selections[slot]
    if (v !== 'none' && !isSdkMutation(v)) throw new Error(`FELINE_SDK_UNKNOWN_MUTATION:${v}`)
  }
  return plan.selections as unknown as FelineSelections
}

/* ── 驻场成长（gen3） ─────────────────────────── */

export interface FelineGrowth {
  slot: MutationSlot
  from: AnyMutationId | null
  to: AnyMutationId
  kind: 'fill' | 'upgrade'
}

/** 升品时"只升一档"权重 70、跳档 30（与古典轨一致） */
export const GROW_STEP_WEIGHTS = { next: 70, jump: 30 } as const

/**
 * 驻场成长，每次一处："先长齐，再升品"：
 * - 异变少于 2 处且有空位 → 在空位长出一件 N 级（按主题亲和加权）
 * - 否则若某位置可向上换层 → 升品（同位置换更高层，只升一档为主）
 * - 否则若仍有空位 → 长出；都没有 → null（不消耗成长次数）
 * 命名不变（身份延续），层与稀有度按新异变重算；形象需由编排层按新选项重新合成。
 */
export function growFeline(
  rng: Rng,
  plan: FelinePlan,
  available: Availability = LIVE_AVAILABILITY,
): { plan: FelinePlan; growth: FelineGrowth } | null {
  const theme = FELINE_THEME_MAP[plan.theme]
  const avail = available(plan.selections.coat)
  const defs = MUTATION_DEFS.filter((d) => avail.has(d.id))
  const occupied = new Map<MutationSlot, MutationDef>()
  for (const id of plan.mutations) occupied.set(MUTATION_MAP[id].slot, MUTATION_MAP[id])
  const upgradable = [...occupied.entries()].filter(([slot, cur]) =>
    defs.some((d) => d.slot === slot && tierIndex(d.tier) > tierIndex(cur.tier)),
  )
  const fills = defs.filter((d) => d.tier === 'N' && !occupied.has(d.slot))

  const fill = (): FelineGrowth => {
    const picked = weightedPick(
      rng,
      fills.map((d) => ({ item: d, w: affinityWeight(theme, 'normal', d.id) })),
    )
    return { slot: picked.slot, from: null, to: picked.id, kind: 'fill' }
  }
  const upgrade = (): FelineGrowth => {
    const [slot, cur] = pick(rng, upgradable)
    const cands = defs.filter((d) => d.slot === slot && tierIndex(d.tier) > tierIndex(cur.tier))
    const picked = weightedPick(
      rng,
      cands.map((d) => ({
        item: d,
        w: tierIndex(d.tier) === tierIndex(cur.tier) + 1 ? GROW_STEP_WEIGHTS.next : GROW_STEP_WEIGHTS.jump,
      })),
    )
    return { slot, from: cur.id, to: picked.id, kind: 'upgrade' }
  }

  let growth: FelineGrowth
  if (plan.mutations.length < 2 && fills.length > 0) growth = fill()
  else if (upgradable.length > 0) growth = upgrade()
  else if (fills.length > 0) growth = fill()
  else return null

  const selections: PlanSelections = { ...plan.selections, [growth.slot]: growth.to }
  const mutations =
    growth.kind === 'upgrade'
      ? plan.mutations.map((m) => (m === growth.from ? growth.to : m))
      : [...plan.mutations, growth.to]
  return {
    plan: { ...plan, selections, mutations, tier: tierOf(mutations), rarity: rarityOf(mutations) },
    growth,
  }
}
