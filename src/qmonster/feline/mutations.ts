import type { Rarity } from '../../core/types'
import { MUTATIONS, type Mutation, type MutationSlot } from './sdk'

/**
 * 异变登记表（孵化器侧真相）：稀有度分层 + 位置 + 命名字 + 素材状态。
 * - live：v0.10 SDK 已有素材，可直接渲染
 * - planned：已定设计、待 RandomPet 出图并进目录（规则会把它们纳入分布预演，但渲染时按可用性过滤）
 * 现有 6 件全部为"小件"（SDK 命名即 small-*），定为 N；R/L 由新素材承担。
 */
export type PlannedMutation = 'frill-neck' | 'feathered-wings' | 'flame-tail' | 'halo' | 'dragon-wings'
export type AnyMutationId = Mutation | PlannedMutation

export interface MutationDef {
  id: AnyMutationId
  slot: MutationSlot
  tier: Rarity
  name: string
  /** 命名用单字 */
  char: string
  /** 是否随花纹出 6 张（耳/颈/尾贴合毛色的件） */
  coatBound: boolean
  status: 'live' | 'planned'
  /** 给美术/提示词的一句话 */
  brief: string
}

export const MUTATION_DEFS: MutationDef[] = [
  { id: 'fin-ears', slot: 'ears', tier: 'N', name: '鳍耳', char: '鳍', coatBound: true, status: 'live', brief: '替换原耳的粉色半透明鳍耳' },
  { id: 'forked-tail-tip', slot: 'tailTip', tier: 'N', name: '分叉尾尖', char: '叉', coatBound: true, status: 'live', brief: '整条尾巴替换，尾尖分两短叉' },
  { id: 'small-lion-mane', slot: 'neck', tier: 'N', name: '小狮鬃', char: '鬃', coatBound: true, status: 'live', brief: '颈部一圈短鬃，根部藏在下巴毛后' },
  { id: 'small-wings', slot: 'back', tier: 'N', name: '小翅膀', char: '翼', coatBound: false, status: 'live', brief: '肩后一对小白翼，露出很少' },
  { id: 'dragon-horns', slot: 'crown', tier: 'N', name: '小龙角', char: '龙', coatBound: false, status: 'live', brief: '额顶一对短龙角' },
  { id: 'antlers', slot: 'crown', tier: 'N', name: '鹿角', char: '角', coatBound: false, status: 'live', brief: '额顶一对小鹿角' },
  // ── 批次 1（2026-09-15 已进目录并批准）：全部与花纹无关，各 1 张，按最终坐标制作 ──
  { id: 'frill-neck', slot: 'neck', tier: 'R', name: '伞蜥颈膜', char: '膜', coatBound: false, status: 'live', brief: '伞蜥式半透明颈膜，撑开在头后，橙粉膜色配深色骨条' },
  { id: 'feathered-wings', slot: 'back', tier: 'R', name: '羽翼', char: '羽', coatBound: false, status: 'live', brief: '一对明显高过肩线的乳白鸟翼，比小翅膀大一倍以上' },
  { id: 'flame-tail', slot: 'tailTip', tier: 'R', name: '焰尾', char: '焰', coatBound: false, status: 'live', brief: '整条尾巴替换为燃着橙金火焰的尾，占位同分叉尾' },
  { id: 'halo', slot: 'crown', tier: 'L', name: '光环', char: '环', coatBound: false, status: 'live', brief: '头顶悬浮的金色发光环，不接触身体' },
  { id: 'dragon-wings', slot: 'back', tier: 'L', name: '龙翼', char: '翔', coatBound: false, status: 'live', brief: '一对大型深色骨架+橙粉膜的龙翼，张开高过头顶' },
]

export const MUTATION_MAP: Record<AnyMutationId, MutationDef> = Object.fromEntries(
  MUTATION_DEFS.map((d) => [d.id, d]),
) as Record<AnyMutationId, MutationDef>

export const ALL_MUTATION_IDS: AnyMutationId[] = MUTATION_DEFS.map((d) => d.id)
export const LIVE_MUTATION_IDS: AnyMutationId[] = MUTATION_DEFS.filter((d) => d.status === 'live').map((d) => d.id)

export const MUTATION_NAMES: Record<AnyMutationId, string> = Object.fromEntries(
  MUTATION_DEFS.map((d) => [d.id, d.name]),
) as Record<AnyMutationId, string>
export const MUTATION_CHARS: Record<AnyMutationId, string> = Object.fromEntries(
  MUTATION_DEFS.map((d) => [d.id, d.char]),
) as Record<AnyMutationId, string>

export const TIER_ORDER: Rarity[] = ['N', 'R', 'L']
export const TIER_NAMES: Record<Rarity, string> = { N: '普通', R: '稀有', L: '传说' }

/** SDK（v0.10 + 批次 1）当前认识的异变 id：渲染前的最后一道校验 */
export function isSdkMutation(id: string): id is Mutation {
  return (MUTATIONS as readonly string[]).includes(id)
}
