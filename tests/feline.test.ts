import { describe, expect, it } from 'vitest'
import {
  FELINE_MODE_COUNTS,
  FELINE_RULES_VERSION,
  FULL_AVAILABILITY,
  LIVE_AVAILABILITY,
  countTier,
  planFeline,
  rarityOf,
  tierOf,
  toSdkSelections,
  type FelineMode,
} from '../src/qmonster/feline/rules'
import { FELINE_THEMES } from '../src/qmonster/feline/themes'
import {
  ALL_MUTATION_IDS,
  LIVE_MUTATION_IDS,
  MUTATION_CHARS,
  MUTATION_DEFS,
  MUTATION_MAP,
} from '../src/qmonster/feline/mutations'
import { COATS, MUTATIONS, MUTATION_SLOT } from '../src/qmonster/feline/sdk'
import { OFFLINE_BASE, isOfflineMode, scriptNameFor } from '../src/qmonster/feline/offline'

const MODES: FelineMode[] = ['normal', 'mutation', 'aberration']
const seeds = (n: number) => Array.from({ length: n }, (_, i) => `t-${i}`)
const SLOTS = ['crown', 'ears', 'neck', 'back', 'tailTip'] as const

describe('gen3 小猫组合规则 v2（分层异变）', () => {
  it('同 seed+主题+判定 确定性复现；换判定结果不同', () => {
    const a = planFeline('egg-1', 'deepsea', 'normal')
    const b = planFeline('egg-1', 'deepsea', 'normal')
    expect(b).toEqual(a)
    const many = MODES.map((m) => JSON.stringify(planFeline('egg-1', 'ember', m).selections))
    expect(new Set(many).size).toBeGreaterThan(1)
    expect(FELINE_RULES_VERSION).toBe('feline-rules-v2')
  })

  it('异变处数落在各判定区间内（目录实际与登记表全量两种可用性）', () => {
    for (const available of [LIVE_AVAILABILITY, FULL_AVAILABILITY]) {
      for (const mode of MODES) {
        const allowed = new Set(FELINE_MODE_COUNTS[mode].counts)
        for (const t of FELINE_THEMES) {
          for (const s of seeds(150)) {
            const plan = planFeline(s, t.id, mode, available)
            expect(allowed.has(plan.mutations.length), `${mode}/${t.id}/${s}`).toBe(true)
          }
        }
      }
    }
  })

  it('同位置互斥：selections 与 mutations 一致，同一位置只有一件', () => {
    for (const mode of MODES) {
      for (const t of FELINE_THEMES) {
        for (const s of seeds(120)) {
          const plan = planFeline(s, t.id, mode, FULL_AVAILABILITY)
          const fromSlots = SLOTS.map((slot) => plan.selections[slot]).filter((v) => v !== 'none')
          expect([...fromSlots].sort()).toEqual([...plan.mutations].sort())
          const slots = plan.mutations.map((m) => MUTATION_MAP[m].slot)
          expect(new Set(slots).size).toBe(slots.length)
        }
      }
    }
  })

  it('可用性过滤：默认只出目录已有的件，toSdkSelections 通过；按花纹缺件时不会抽到', () => {
    const live = new Set<string>(LIVE_MUTATION_IDS)
    for (const t of FELINE_THEMES) {
      for (const mode of MODES) {
        for (const s of seeds(80)) {
          const plan = planFeline(s, t.id, mode)
          for (const m of plan.mutations) expect(live.has(m)).toBe(true)
          expect(() => toSdkSelections(plan)).not.toThrow()
        }
      }
    }
    // 不在 SDK 枚举里的 id 会被拒绝
    const bogus = { ...planFeline('x', 'sky', 'normal'), selections: { ...planFeline('x', 'sky', 'normal').selections, back: 'jet-pack' } }
    expect(() => toSdkSelections(bogus)).toThrow(/FELINE_SDK_UNKNOWN_MUTATION/)
    // 按花纹的可用性：某花纹缺件时不会抽到
    const onlyCrown = () => new Set(['dragon-horns', 'antlers'])
    for (const s of seeds(50)) {
      const plan = planFeline(s, 'ember', 'mutation', onlyCrown)
      expect(plan.mutations.length).toBeLessThanOrEqual(1)
    }
  })

  it('花纹只来自主题花纹池；正常态单处异变以标志异变为主', () => {
    for (const t of FELINE_THEMES) {
      const pool = new Set(t.coats.map((c) => c.item))
      let single = 0
      let signature = 0
      let zero = 0
      for (const s of seeds(600)) {
        const plan = planFeline(s, t.id, 'normal', FULL_AVAILABILITY)
        expect(pool.has(plan.selections.coat)).toBe(true)
        expect(COATS).toContain(plan.selections.coat)
        if (plan.mutations.length === 0) zero += 1
        if (plan.mutations.length === 1) {
          single += 1
          if (plan.mutations[0] === t.signature) signature += 1
        }
      }
      expect(zero).toBeGreaterThan(120)
      expect(signature / single).toBeGreaterThan(0.65)
    }
  })

  it('变异态必含标志异变；畸变态压低本主题件', () => {
    for (const t of FELINE_THEMES) {
      let aberrantWithSignature = 0
      for (const s of seeds(300)) {
        expect(planFeline(s, t.id, 'mutation', FULL_AVAILABILITY).mutations).toContain(t.signature)
        if (planFeline(s, t.id, 'aberration', FULL_AVAILABILITY).mutations.includes(t.signature)) {
          aberrantWithSignature += 1
        }
      }
      expect(aberrantWithSignature / 300).toBeLessThan(0.7)
    }
  })

  it('分层生效：正常态会出少量 R/L，变异/畸变更多，且 R/L 件更常落到亲和主题', () => {
    const rare = { normal: 0, mutation: 0, aberration: 0 }
    let skyHalo = 0
    let forestHalo = 0
    for (const mode of MODES) {
      for (const t of FELINE_THEMES) {
        for (const s of seeds(300)) {
          const plan = planFeline(s, t.id, mode, FULL_AVAILABILITY)
          if (plan.tier !== 'N') rare[mode] += 1
          if (plan.mutations.includes('halo')) {
            if (t.id === 'sky') skyHalo += 1
            if (t.id === 'forest') forestHalo += 1
          }
        }
      }
    }
    const total = FELINE_THEMES.length * 300
    expect(rare.normal / total).toBeGreaterThan(0.05)
    expect(rare.normal / total).toBeLessThan(0.3)
    expect(rare.mutation / total).toBeGreaterThan(rare.normal / total)
    expect(rare.aberration / total).toBeGreaterThan(rare.normal / total)
    expect(skyHalo).toBeGreaterThan(forestHalo)
    // 只给 6 件原始件（全 N）时，正常态不会出 R/L
    const originals = () => new Set(['fin-ears', 'forked-tail-tip', 'small-lion-mane', 'small-wings', 'dragon-horns', 'antlers'])
    for (const t of FELINE_THEMES) {
      for (const s of seeds(200)) expect(planFeline(s, t.id, 'normal', originals).rarity).toBe('N')
    }
  })

  it('稀有度 = max(最高异变层, 处数层)', () => {
    expect([0, 1, 2, 3, 5].map(countTier)).toEqual(['N', 'N', 'R', 'L', 'L'])
    expect(tierOf([])).toBe('N')
    expect(tierOf(['fin-ears', 'halo'])).toBe('L')
    expect(rarityOf(['halo'])).toBe('L')
    expect(rarityOf(['fin-ears', 'antlers'])).toBe('R')
    expect(rarityOf(['frill-neck'])).toBe('R')
    expect(rarityOf(['fin-ears', 'antlers', 'small-wings'])).toBe('L')
    for (const mode of MODES) {
      for (const s of seeds(60)) {
        const plan = planFeline(s, 'sky', mode, FULL_AVAILABILITY)
        expect(plan.rarity).toBe(rarityOf(plan.mutations))
        expect(plan.aberrant).toBe(mode === 'aberration')
      }
    }
  })

  it('命名 = 词根 (+最高层异变字) + 喵，词根不与异变字重复', () => {
    const chars = new Set(Object.values(MUTATION_CHARS))
    for (const t of FELINE_THEMES) {
      for (const mode of MODES) {
        for (const s of seeds(80)) {
          const plan = planFeline(s, t.id, mode, FULL_AVAILABILITY)
          expect(plan.name.endsWith('喵')).toBe(true)
          expect(t.nameRoots).toContain(plan.name[0])
          if (plan.mutations.length >= 2) {
            expect(plan.name).toHaveLength(3)
            expect(chars.has(plan.name[1])).toBe(true)
            expect(plan.name[0]).not.toBe(plan.name[1])
            const top = plan.tier
            expect(MUTATION_MAP[plan.mutations.find((m) => MUTATION_CHARS[m] === plan.name[1])!].tier).toBe(top)
          } else {
            expect(plan.name).toHaveLength(2)
          }
        }
      }
    }
  })

  it('登记表：live 件与 SDK 枚举一致；6 件原始件全为 N，批次 1 为 R×3/L×2；标志异变全为 N 级且各主题唯一', () => {
    const live = MUTATION_DEFS.filter((d) => d.status === 'live').map((d) => d.id)
    expect([...live].sort()).toEqual([...MUTATIONS].sort())
    const originals = ['fin-ears', 'forked-tail-tip', 'small-lion-mane', 'small-wings', 'dragon-horns', 'antlers']
    for (const id of originals) expect(MUTATION_MAP[id as keyof typeof MUTATION_MAP].tier).toBe('N')
    const batch1 = MUTATION_DEFS.filter((d) => !originals.includes(d.id))
    expect(batch1.filter((d) => d.tier === 'R').map((d) => d.id).sort()).toEqual(['feathered-wings', 'flame-tail', 'frill-neck'])
    expect(batch1.filter((d) => d.tier === 'L').map((d) => d.id).sort()).toEqual(['dragon-wings', 'halo'])
    for (const d of MUTATION_DEFS) expect(MUTATION_SLOT[d.id as (typeof MUTATIONS)[number]]).toBe(d.slot)
    expect(new Set(ALL_MUTATION_IDS).size).toBe(MUTATION_DEFS.length)
    expect(new Set(Object.values(MUTATION_CHARS)).size).toBe(MUTATION_DEFS.length)
    const signatures = FELINE_THEMES.map((t) => t.signature)
    expect(new Set(signatures).size).toBe(FELINE_THEMES.length)
    for (const t of FELINE_THEMES) {
      expect(MUTATION_MAP[t.signature].tier).toBe('N')
      expect(t.secondary).not.toContain(t.signature)
      for (const id of [...t.secondary, ...t.affinity]) expect(MUTATION_MAP[id]).toBeDefined()
    }
  })

  it('离线通道：资源路径 → 旁置脚本名与构建脚本规则一致；node 环境视为非离线', () => {
    expect(scriptNameFor('packages/asset-catalog/assets/v0.10.0/halo.png')).toBe(
      'packages__asset-catalog__assets__v0.10.0__halo.png.js',
    )
    expect(scriptNameFor('packages/asset-catalog/catalog/v0.10.0/catalog.json')).toBe(
      'packages__asset-catalog__catalog__v0.10.0__catalog.json.js',
    )
    expect(OFFLINE_BASE.endsWith('/')).toBe(true)
    expect(isOfflineMode()).toBe(false)
  })
})
