import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, isMonday, mondayOf } from '../src/core/time'
import { rollDestiny, rollTraitForSlot } from '../src/core/draw'
import { makeName } from '../src/core/naming'
import {
  abandonTodo,
  addTodo,
  completeTodo,
  initState,
  processTime,
  revealCount,
  swapEgg,
} from '../src/core/engine'
import { SLOT_ORDER, type SlotId, type GameState } from '../src/core/types'
import { THEMES, THEME_IDS } from '../src/data/themes'
import { TRAIT_MAP } from '../src/data/traits'

// 2026-08-21 是周五
const FRI = '2026-08-21'
const TUE = '2026-08-18'

function fresh(day: string): GameState {
  return initState(day).state
}

/** 按槽位顺序掷满 8 特征（模拟完整揭露） */
function rollAll(themeId: (typeof THEME_IDS)[number], seed: number, boost = false) {
  const chosen: Partial<Record<SlotId, string>> = {}
  SLOT_ORDER.forEach((slot, i) => {
    chosen[slot] = rollTraitForSlot(THEMES[themeId], seed, i, chosen, boost)
  })
  return chosen as Record<SlotId, string>
}

describe('time', () => {
  it('mondayOf / isMonday / daysBetween / addDays', () => {
    expect(mondayOf(FRI)).toBe('2026-08-17')
    expect(isMonday('2026-08-17')).toBe(true)
    expect(isMonday(FRI)).toBe(false)
    expect(daysBetween('2026-08-01', FRI)).toBe(20)
    expect(addDays(FRI, 3)).toBe('2026-08-24')
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  })
})

describe('特征掷定（揭露时懒掷）', () => {
  it('8 槽合法、可复现、互斥生效', () => {
    for (const themeId of THEME_IDS) {
      for (let seed = 1; seed <= 300; seed++) {
        const traits = rollAll(themeId, seed)
        for (const slot of SLOT_ORDER) {
          const t = TRAIT_MAP[traits[slot]]
          expect(t, `seed=${seed} slot=${slot}`).toBeTruthy()
          expect(t.slot).toBe(slot)
        }
        if (traits.frame === 'frame_float') {
          expect(['limb_stub', 'limb_webbed']).not.toContain(traits.limbs)
        }
      }
      expect(rollAll(themeId, 42)).toEqual(rollAll(themeId, 42))
    }
  })

  it('传说级可被抽中，连击加成显著提高 L 频率', () => {
    let base = 0
    let boosted = 0
    for (let seed = 1; seed <= 1500; seed++) {
      const chosen: Partial<Record<SlotId, string>> = {}
      if (TRAIT_MAP[rollTraitForSlot(THEMES.deepsea, seed, 0, chosen, false)].rarity === 'L') base++
      if (TRAIT_MAP[rollTraitForSlot(THEMES.deepsea, seed, 0, chosen, true)].rarity === 'L') boosted++
    }
    expect(base).toBeGreaterThan(0)
    expect(boosted).toBeGreaterThan(base * 1.3)
  })

  it('命运预掷字段完备', () => {
    const d = rollDestiny(THEMES.shadow, 7)
    expect(d.judgmentRoll).toBeGreaterThanOrEqual(0)
    expect(d.judgmentRoll).toBeLessThan(100)
    expect(d.aberrations.length).toBeGreaterThanOrEqual(1)
    expect(d.aberrations.length).toBeLessThanOrEqual(2)
    expect(d.mutationRoll).toBeGreaterThanOrEqual(0)
    expect(d.mutationRoll).toBeLessThan(1)
    expect(d.mutationPick).toMatch(/^mut_/)
    expect(rollDestiny(THEMES.shadow, 7)).toEqual(d)
  })
})

describe('naming', () => {
  it('主题词根 + 特征命名字，不撞字', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const d = rollDestiny(THEMES.shadow, seed)
      const name = makeName(THEMES.shadow, d.rootChar, rollAll('shadow', seed), seed)
      expect(name).toHaveLength(2)
      expect(THEMES.shadow.nameRoots).toContain(name[0])
      expect(name[0]).not.toBe(name[1])
    }
  })
})

describe('孵化点与揭露', () => {
  it('完成待办按难度给点、按阈值揭露并即时入档', () => {
    let s = fresh(FRI)
    s = addTodo(s, { title: '写周报', difficulty: 'hard', due: null }, FRI)
    const r = completeTodo(s, 'todo-1', FRI)
    expect(r.state.currentEgg!.points).toBe(20)
    const reveals = r.events.filter((e) => e.type === 'reveal')
    expect(reveals).toHaveLength(1) // 跨过 12
    expect(reveals[0]).toMatchObject({ slot: 'frame', index: 0 })
    expect(r.state.currentEgg!.revealed.frame).toBeTruthy()
    expect(r.state.todos[0].state).toBe('done')
    expect(r.state.currentEgg!.fedBy).toEqual(['todo-1'])
  })

  it('revealCount 阈值', () => {
    expect(revealCount(0)).toBe(0)
    expect(revealCount(12)).toBe(1)
    expect(revealCount(95)).toBe(7)
    expect(revealCount(96)).toBe(8)
  })
})

describe('按时连击', () => {
  it('按时 +1、满 3 触发事件；逾期完成清零；无截止日不影响', () => {
    let s = fresh(FRI)
    for (let i = 1; i <= 3; i++) {
      s = addTodo(s, { title: `准时${i}`, difficulty: 'easy', due: FRI }, FRI)
    }
    s = addTodo(s, { title: '无截止', difficulty: 'easy', due: null }, FRI)
    s = addTodo(s, { title: '迟到的', difficulty: 'easy', due: '2026-08-20' }, FRI)

    let r = completeTodo(s, 'todo-1', FRI)
    r = completeTodo(r.state, 'todo-2', FRI)
    expect(r.state.streak).toBe(2)
    r = completeTodo(r.state, 'todo-3', FRI)
    expect(r.state.streak).toBe(3)
    expect(r.events.some((e) => e.type === 'streakOn')).toBe(true)

    r = completeTodo(r.state, 'todo-4', FRI) // 无截止日：不加不断
    expect(r.state.streak).toBe(3)

    r = completeTodo(r.state, 'todo-5', FRI) // 逾期完成：清零
    expect(r.state.streak).toBe(0)
    expect(r.events.some((e) => e.type === 'streakBreak')).toBe(true)
  })

  it('放弃待办清零连击', () => {
    let s = fresh(FRI)
    s = addTodo(s, { title: 'a', difficulty: 'easy', due: FRI }, FRI)
    s = addTodo(s, { title: 'b', difficulty: 'easy', due: FRI }, FRI)
    s = completeTodo(s, 'todo-1', FRI).state
    expect(s.streak).toBe(1)
    s = abandonTodo(s, 'todo-2')
    expect(s.streak).toBe(0)
  })
})

describe('孵化判定', () => {
  it('判定骰 ≥ 风险 → 正常；< 风险 → 畸变；档案 8 槽齐全', () => {
    let s = fresh(FRI)
    s = addTodo(s, { title: '大扫除', difficulty: 'normal', due: null }, FRI)
    s.currentEgg!.points = 90
    s.currentEgg!.risk = 10
    s.currentEgg!.destiny.judgmentRoll = 50
    let r = completeTodo(s, 'todo-1', FRI)
    let hatch = r.events.find((e) => e.type === 'hatch')
    expect(hatch && hatch.type === 'hatch' && hatch.record.outcome).toBe('normal')
    expect(r.state.codex).toHaveLength(1)
    expect(Object.keys(r.state.codex[0].traits)).toHaveLength(8)
    expect(r.state.codex[0].aberrations).toEqual([])
    expect(r.state.codex[0].fedTodos.map((t) => t.title)).toEqual(['大扫除'])

    s = fresh(FRI)
    s = addTodo(s, { title: '大扫除', difficulty: 'normal', due: null }, FRI)
    s.currentEgg!.points = 90
    s.currentEgg!.risk = 60
    s.currentEgg!.destiny.judgmentRoll = 5
    r = completeTodo(s, 'todo-1', FRI)
    hatch = r.events.find((e) => e.type === 'hatch')
    expect(hatch && hatch.type === 'hatch' && hatch.record.outcome).toBe('aberrant')
    expect(r.state.codex[0].aberrations.length).toBeGreaterThanOrEqual(1)
  })
})

describe('变异判定', () => {
  function hatchWith(mutationRoll: number, judgmentRoll: number, risk: number) {
    let s = fresh(FRI)
    s = addTodo(s, { title: '收尾', difficulty: 'normal', due: null }, FRI)
    s.currentEgg!.points = 90
    s.currentEgg!.risk = risk
    s.currentEgg!.destiny.judgmentRoll = judgmentRoll
    s.currentEgg!.destiny.mutationRoll = mutationRoll
    return completeTodo(s, 'todo-1', FRI).state.codex[0]
  }

  it('基础变异率 5%：骰值低于命中，高于落空', () => {
    expect(hatchWith(0.04, 50, 3).mutation).toBeTruthy()
    expect(hatchWith(0.2, 50, 3).mutation).toBeNull()
  })

  it('畸变孵化不参与变异', () => {
    const rec = hatchWith(0.001, 1, 60)
    expect(rec.outcome).toBe('aberrant')
    expect(rec.mutation).toBeNull()
  })

  it('困难待办提升变异率（5% + 每条 1%）', () => {
    let s = fresh(FRI)
    for (let i = 0; i < 5; i++) {
      s = addTodo(s, { title: `硬仗${i + 1}`, difficulty: 'hard', due: null }, FRI)
    }
    s.currentEgg!.destiny.judgmentRoll = 99
    s.currentEgg!.destiny.mutationRoll = 0.09 // 5 条困难 → 10% 变异率
    let r = { state: s, events: [] as unknown[] }
    for (let i = 1; i <= 5; i++) r = completeTodo(r.state, `todo-${i}`, FRI)
    const rec = r.state.codex[0]
    expect(rec.outcome).toBe('normal')
    expect(rec.mutation).toBeTruthy()
    expect(rec.fedTodos).toHaveLength(5)
  })
})

describe('逾期风险', () => {
  it('首日 +4、此后每日 +2、单条上限 12', () => {
    let s = fresh(TUE)
    s = addTodo(s, { title: '约牙医', difficulty: 'easy', due: TUE }, TUE)
    const baseRisk = s.currentEgg!.risk
    const r = processTime(s, '2026-08-23')
    const todo = r.state.todos[0]
    expect(todo.riskFromOverdue).toBe(12) // 4+2+2+2+2
    expect(todo.state).toBe('open')
    expect(r.state.currentEgg!.risk).toBe(baseRisk + 12)
  })

  it('逾期满 7 天自动失败并额外 +12，连击清零', () => {
    let s = fresh(TUE)
    s = addTodo(s, { title: '约牙医', difficulty: 'easy', due: TUE }, TUE)
    s.streak = 4
    const r = processTime(s, '2026-08-25')
    expect(r.state.todos[0].state).toBe('failed')
    expect(r.events.some((e) => e.type === 'autoFail')).toBe(true)
    expect(r.state.streak).toBe(0)
    expect(r.state.currentEgg!.risk).toBe(15)
  })

  it('主动放弃 +6', () => {
    let s = fresh(FRI)
    s = addTodo(s, { title: '算了', difficulty: 'easy', due: null }, FRI)
    const before = s.currentEgg!.risk
    const s2 = abandonTodo(s, 'todo-1')
    expect(s2.todos[0].state).toBe('abandoned')
    expect(s2.currentEgg!.risk).toBe(before + 6)
  })
})

describe('周循环与休眠', () => {
  it('周一：台上蛋入棚 +8，新蛋降临', () => {
    const s = fresh(TUE)
    const eggId = s.currentEgg!.id
    const r = processTime(s, '2026-08-24')
    expect(r.state.shed).toHaveLength(1)
    expect(r.state.shed[0].id).toBe(eggId)
    expect(r.state.shed[0].dormantWeeks).toBe(1)
    expect(r.state.shed[0].risk).toBe(3 + 8)
    expect(r.state.currentEgg).toBeTruthy()
    expect(r.state.currentEgg!.id).not.toBe(eggId)
    expect(r.events.some((e) => e.type === 'eggArrived')).toBe(true)
  })

  it('休眠满 3 周强制孵化入册（8 槽补齐）', () => {
    const s = fresh(TUE)
    const eggId = s.currentEgg!.id
    const r = processTime(s, '2026-09-14')
    expect(r.state.codex).toHaveLength(1)
    expect(r.state.codex[0].forced).toBe(true)
    expect(Object.keys(r.state.codex[0].traits)).toHaveLength(8)
    expect(r.events.some((e) => e.type === 'forcedHatch')).toBe(true)
    expect(r.state.shed.every((e) => e.id !== eggId)).toBe(true)
  })

  it('手动交换孵化台与休眠棚', () => {
    const s = fresh(TUE)
    const first = s.currentEgg!.id
    const monday = processTime(s, '2026-08-24').state
    const second = monday.currentEgg!.id
    const swapped = swapEgg(monday, 0)
    expect(swapped.currentEgg!.id).toBe(first)
    expect(swapped.shed[0].id).toBe(second)
  })
})
