import { mulberry32, pick } from './rng'
import type { SlotId, ThemeDef } from './types'
import { TRAIT_MAP } from '../data/traits'

/**
 * 命名（§09）：主题词根 + 特征中稀有度最高一条的命名字（L > R > N）。
 * 若撞字（如「噬噬」），换用主题的其他词根。
 */
export function makeName(
  theme: ThemeDef,
  rootCharPicked: string,
  traits: Record<SlotId, string>,
  seed: number,
): string {
  const rng = mulberry32(seed ^ 0x9e3779b9)
  const defs = Object.values(traits).map((id) => TRAIT_MAP[id])
  const legends = defs.filter((t) => t.rarity === 'L')
  const rares = defs.filter((t) => t.rarity === 'R')
  const source = legends.length > 0 ? legends : rares.length > 0 ? rares : defs
  const trait = pick(rng, source)

  let root = rootCharPicked
  if (root === trait.nameChar) {
    const alt = theme.nameRoots.filter((c) => c !== trait.nameChar)
    root = alt.length > 0 ? pick(rng, alt) : root
  }
  return root + trait.nameChar
}

export function gsiId(counter: number): string {
  return `GSI-${String(counter).padStart(3, '0')}`
}
