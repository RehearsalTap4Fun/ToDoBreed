import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, isMonday, mondayOf } from '../src/core/time'
import { rollDestiny, rollTraitForSlot } from '../src/core/draw'
import { makeName } from '../src/core/naming'
import {
  abandonTodo,
  addTemplate,
  setEggIdentity,
  setRecordSpec,
  addTodo,
  adoptInbox,
  applyTemplate,
  completeTodo,
  dismissInbox,
  importSuggestions,
  inferDueRule,
  initState,
  processTime,
  removeTemplate,
  residentOf,
  resolveDueRule,
  revealCount,
  setResident,
  swapEgg,
} from '../src/core/engine'
import { Q_SLOT_ORDER, SLOT_ORDER, type SlotId, type GameState } from '../src/core/types'
import { THEMES, THEME_IDS } from '../src/data/themes'
import { TRAIT_MAP } from '../src/data/traits'

// 2026-08-21 是周五
const FRI = '2026-08-21'
const TUE = '2026-08-18'

function fresh(day: string): GameState {
  return initState(day).state
}

/** 把当前蛋降级为 legacy（模拟换轨前的旧蛋，仍走 77 特征库管线） */
function legacy(s: GameState): GameState {
  delete s.currentEgg!.qseed
  return s
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
  it('完成待办按难度给点、按阈值揭露并即时入档（legacy 蛋）', () => {
    let s = legacy(fresh(FRI))
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

describe('gen2 换轨（QMonster）', () => {
  it('新蛋携带 qseed；揭露不掷旧特征、事件带 qtraitId', () => {
    let s = fresh(FRI)
    expect(s.currentEgg!.qseed).toMatch(/^q/)
    s = addTodo(s, { title: '写周报', difficulty: 'hard', due: null }, FRI)
    const r = completeTodo(s, 'todo-1', FRI)
    const reveals = r.events.filter((e) => e.type === 'reveal')
    expect(reveals).toHaveLength(1)
    expect(reveals[0].type === 'reveal' && reveals[0].qtraitId).toBe('') // 身份未解析 → 空卡
    expect(Object.keys(r.state.currentEgg!.revealed)).toHaveLength(0) // 不走旧特征库
  })

  it('身份回写后揭露事件携带语义特征 id', () => {
    let s = fresh(FRI)
    const eggId = s.currentEgg!.id
    const slots = Object.fromEntries(Q_SLOT_ORDER.map((q) => [q, `sem_${q}`])) as Record<
      (typeof Q_SLOT_ORDER)[number],
      string
    >
    s = setEggIdentity(s, eggId, { resolvedSeed: 'q-x#2', slots })
    expect(s.currentEgg!.qidentity!.resolvedSeed).toBe('q-x#2')
    s = addTodo(s, { title: '任务', difficulty: 'hard', due: null }, FRI)
    const r = completeTodo(s, 'todo-1', FRI)
    const reveal = r.events.find((e) => e.type === 'reveal')
    expect(reveal && reveal.type === 'reveal' && reveal.qtraitId).toBe('sem_frame')
  })

  it('孵化判定映射 qmode：畸变→aberration，变异→mutation，档案待渲染', () => {
    // 畸变
    let s = fresh(FRI)
    s = addTodo(s, { title: 'a', difficulty: 'normal', due: null }, FRI)
    s.currentEgg!.points = 90
    s.currentEgg!.risk = 60
    s.currentEgg!.destiny.judgmentRoll = 5
    let rec = completeTodo(s, 'todo-1', FRI).state.codex[0]
    expect(rec.kind).toBe('qmonster')
    expect(rec.qmode).toBe('aberration')
    expect(rec.outcome).toBe('aberrant')
    expect(rec.qstatus).toBe('pending')
    expect(rec.traits).toBeUndefined()
    // 变异
    s = fresh(FRI)
    s = addTodo(s, { title: 'b', difficulty: 'normal', due: null }, FRI)
    s.currentEgg!.points = 90
    s.currentEgg!.destiny.judgmentRoll = 99
    s.currentEgg!.destiny.mutationRoll = 0.04
    rec = completeTodo(s, 'todo-1', FRI).state.codex[0]
    expect(rec.qmode).toBe('mutation')
    expect(rec.outcome).toBe('normal')
    // 正常
    s = fresh(FRI)
    s = addTodo(s, { title: 'c', difficulty: 'normal', due: null }, FRI)
    s.currentEgg!.points = 90
    s.currentEgg!.destiny.judgmentRoll = 99
    s.currentEgg!.destiny.mutationRoll = 0.9
    rec = completeTodo(s, 'todo-1', FRI).state.codex[0]
    expect(rec.qmode).toBe('normal')
  })

  it('连击 ≥3 时孵化变异率 +2%', () => {
    const run = (streak: number) => {
      let s = fresh(FRI)
      s.streak = streak
      s = addTodo(s, { title: 'x', difficulty: 'normal', due: null }, FRI)
      s.currentEgg!.points = 90
      s.currentEgg!.destiny.judgmentRoll = 99
      s.currentEgg!.destiny.mutationRoll = 0.06 // 基础 5% 落空，+2% 后命中
      return completeTodo(s, 'todo-1', FRI).state.codex[0].qmode
    }
    expect(run(0)).toBe('normal')
    expect(run(3)).toBe('mutation')
  })

  it('setRecordSpec 回写权威 spec 并置 ready，昵称不被覆盖', () => {
    let s = fresh(FRI)
    s = addTodo(s, { title: 'a', difficulty: 'normal', due: null }, FRI)
    s.currentEgg!.points = 90
    s.currentEgg!.destiny.judgmentRoll = 99
    s = completeTodo(s, 'todo-1', FRI).state
    const id = s.codex[0].id
    const semantic = Object.fromEntries(Q_SLOT_ORDER.map((q) => [q, `sem_${q}`]))
    s = setRecordSpec(s, id, {
      qspec: { seed: 'q-1#3' },
      qsemantic: semantic,
      qimageKey: 'qm:test',
      name: '汐圆',
    })
    const rec = s.codex[0]
    expect(rec.qstatus).toBe('ready')
    expect(rec.qimageKey).toBe('qm:test')
    expect(rec.name).toBe('汐圆')
  })
})

describe('孵化判定', () => {
  it('判定骰 ≥ 风险 → 正常；< 风险 → 畸变；档案 8 槽齐全（legacy 蛋）', () => {
    let s = legacy(fresh(FRI))
    s = addTodo(s, { title: '大扫除', difficulty: 'normal', due: null }, FRI)
    s.currentEgg!.points = 90
    s.currentEgg!.risk = 10
    s.currentEgg!.destiny.judgmentRoll = 50
    let r = completeTodo(s, 'todo-1', FRI)
    let hatch = r.events.find((e) => e.type === 'hatch')
    expect(hatch && hatch.type === 'hatch' && hatch.record.outcome).toBe('normal')
    expect(r.state.codex).toHaveLength(1)
    expect(Object.keys(r.state.codex[0].traits!)).toHaveLength(8)
    expect(r.state.codex[0].aberrations).toEqual([])
    expect(r.state.codex[0].fedTodos.map((t) => t.title)).toEqual(['大扫除'])

    s = legacy(fresh(FRI))
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
    let s = legacy(fresh(FRI))
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
    let s = legacy(fresh(FRI))
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

describe('驻场生物', () => {
  it('默认跟随最新孵化；指定后固定；取消/失效回退最新', () => {
    let s = fresh(FRI)
    // 孵出两只
    for (const n of [1, 2]) {
      s = addTodo(s, { title: `任务${n}`, difficulty: 'normal', due: null }, FRI)
      s.currentEgg!.points = 90
      s.currentEgg!.destiny.judgmentRoll = 99
      s = completeTodo(s, `todo-${n}`, FRI).state
    }
    expect(s.codex).toHaveLength(2)
    expect(residentOf(s)!.id).toBe('GSI-002') // 默认最新
    s = setResident(s, 'GSI-001')
    expect(residentOf(s)!.id).toBe('GSI-001') // 指定固定
    s = setResident(s, null)
    expect(residentOf(s)!.id).toBe('GSI-002') // 取消回默认
    s = setResident(s, 'GSI-001')
    s.codex = s.codex.filter((c) => c.id !== 'GSI-001') // 模拟指定失效
    expect(residentOf(s)!.id).toBe('GSI-002')
    expect(setResident(s, 'GSI-999')).toBe(s) // 不存在的 id 拒绝
  })
})

describe('驻场成长', () => {
  it('概率升品：稀有度只升不降、尊重互斥、上限 3 次（legacy 生物）', () => {
    let s = legacy(fresh(FRI))
    s.saveSalt = 12345 // 固定盐保证确定性
    // 孵出一只并指定驻场
    s = addTodo(s, { title: '开荒', difficulty: 'normal', due: null }, FRI)
    s.currentEgg!.points = 90
    s.currentEgg!.destiny.judgmentRoll = 99
    s = completeTodo(s, 'todo-1', FRI).state
    s = setResident(s, 'GSI-001')
    const original = { ...s.codex[0].traits! }
    const order = { N: 0, R: 1, L: 2 } as const

    let growEvents = 0
    for (let i = 0; i < 60; i++) {
      s = addTodo(s, { title: `硬仗${i}`, difficulty: 'epic', due: null }, FRI)
      const r = completeTodo(s, `todo-${s.todos.length}`, FRI)
      growEvents += r.events.filter((e) => e.type === 'residentGrow').length
      s = r.state
    }
    const rec = s.codex.find((c) => c.id === 'GSI-001')!
    expect(rec.growths).toBeGreaterThanOrEqual(1) // 14%×60 次，未命中概率 ~0.01%
    const traits = rec.traits!
    expect(rec.growths).toBeLessThanOrEqual(3)
    expect(growEvents).toBe(rec.growths)
    let strictlyHigher = 0
    for (const slot of SLOT_ORDER) {
      const before = TRAIT_MAP[original[slot]]
      const after = TRAIT_MAP[traits[slot]]
      expect(after.slot).toBe(slot)
      expect(order[after.rarity]).toBeGreaterThanOrEqual(order[before.rarity])
      if (order[after.rarity] > order[before.rarity]) strictlyHigher++
    }
    expect(strictlyHigher).toBeGreaterThanOrEqual(1)
    // 互斥双向校验
    for (const slot of SLOT_ORDER) {
      const t = TRAIT_MAP[traits[slot]]
      for (const other of SLOT_ORDER) {
        if (other === slot) continue
        const o = TRAIT_MAP[traits[other]]
        expect(t.excludes ?? []).not.toContain(o.id)
        expect(o.excludes ?? []).not.toContain(t.id)
      }
    }
  })
})

describe('常用模版', () => {
  it('期限规则换算与归纳（FRI=周五）', () => {
    expect(resolveDueRule('today', FRI)).toBe(FRI)
    expect(resolveDueRule('tomorrow', FRI)).toBe('2026-08-22')
    expect(resolveDueRule('this-week', FRI)).toBe('2026-08-23') // 本周日
    expect(resolveDueRule('none', FRI)).toBeNull()
    expect(inferDueRule(FRI, FRI)).toBe('today')
    expect(inferDueRule('2026-08-22', FRI)).toBe('tomorrow')
    expect(inferDueRule('2026-08-23', FRI)).toBe('this-week')
    expect(inferDueRule(null, FRI)).toBe('none')
    expect(inferDueRule('2026-09-10', FRI)).toBe('none')
  })

  it('预置模版存在，一键钉上生成正确待办', () => {
    const s = fresh(FRI)
    expect(s.templates.map((t) => t.title)).toContain('写日报')
    const s2 = applyTemplate(s, 'tpl-outdoor', FRI)
    const todo = s2.todos.find((t) => t.title === '户外活动')!
    expect(todo.due).toBe('2026-08-23') // 本周日
    expect(todo.difficulty).toBe('normal')
  })

  it('存为模版：同名覆盖、可删除', () => {
    let s = fresh(FRI)
    const before = s.templates.length
    s = addTemplate(s, { title: '给猫铲屎', difficulty: 'easy', dueRule: 'today' })
    expect(s.templates.length).toBe(before + 1)
    s = addTemplate(s, { title: '给猫铲屎', difficulty: 'hard', dueRule: 'none' })
    expect(s.templates.length).toBe(before + 1) // 同名覆盖
    const tpl = s.templates.find((t) => t.title === '给猫铲屎')!
    expect(tpl.difficulty).toBe('hard')
    s = removeTemplate(s, tpl.id)
    expect(s.templates.some((t) => t.title === '给猫铲屎')).toBe(false)
  })
})

describe('线索信箱', () => {
  const sug = (hash: string, title: string) => ({ hash, title, source: 'git:test', difficulty: 'hard' })

  it('导入去重：同哈希只进一次，忽略后也不再送来', () => {
    let s = fresh(FRI)
    let r = importSuggestions(s, [sug('h1', '修复登录超时'), sug('h2', '补齐周报')])
    expect(r.added).toBe(2)
    expect(r.state.inbox).toHaveLength(2)
    // 重复导入
    r = importSuggestions(r.state, [sug('h1', '修复登录超时'), sug('h3', '整理会议纪要')])
    expect(r.added).toBe(1)
    expect(r.state.inbox).toHaveLength(3)
    // 忽略 h2 后再导入 h2 → 不进
    s = dismissInbox(r.state, 'h2')
    expect(s.inbox).toHaveLength(2)
    r = importSuggestions(s, [sug('h2', '补齐周报')])
    expect(r.added).toBe(0)
  })

  it('采纳：移出信箱并按所选难度/截止钉上黑板', () => {
    let s = fresh(FRI)
    s = importSuggestions(s, [sug('h1', '修复登录超时')]).state
    s = adoptInbox(s, 'h1', 'epic', '2026-08-25', FRI)
    expect(s.inbox).toHaveLength(0)
    const todo = s.todos.find((t) => t.title === '修复登录超时')!
    expect(todo.state).toBe('open')
    expect(todo.difficulty).toBe('epic')
    expect(todo.due).toBe('2026-08-25')
  })

  it('非法条目被过滤，难度非法时回退普通', () => {
    const s = fresh(FRI)
    const r = importSuggestions(s, [
      { hash: '', title: '没哈希' },
      { hash: 'h9', title: '' },
      { hash: 'h10', title: '难度非法', difficulty: 'legendary' },
    ])
    expect(r.added).toBe(1)
    expect(r.state.inbox[0].difficulty).toBe('normal')
  })

  it('建议截止日透传（Jira duedate），非法日期置空', () => {
    const s = fresh(FRI)
    const r = importSuggestions(s, [
      { hash: 'j1', title: '[K1-88] 修复副本掉线', source: 'jira:K1', difficulty: 'hard', due: '2026-08-28' },
      { hash: 'j2', title: '[K1-89] 无期限', source: 'jira:K1', due: 'not-a-date' },
    ])
    expect(r.added).toBe(2)
    expect(r.state.inbox[0].due).toBe('2026-08-28')
    expect(r.state.inbox[1].due).toBeNull()
    // 采纳时沿用建议截止日
    const s2 = adoptInbox(r.state, 'j1', 'hard', r.state.inbox[0].due!, FRI)
    expect(s2.todos.find((t) => t.title.includes('K1-88'))!.due).toBe('2026-08-28')
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

  it('休眠满 3 周强制孵化入册（gen2 → 待渲染档案）', () => {
    const s = fresh(TUE)
    const eggId = s.currentEgg!.id
    const r = processTime(s, '2026-09-14')
    expect(r.state.codex).toHaveLength(1)
    expect(r.state.codex[0].forced).toBe(true)
    expect(r.state.codex[0].kind).toBe('qmonster')
    expect(r.state.codex[0].qstatus).toBe('pending')
    expect(r.events.some((e) => e.type === 'forcedHatch')).toBe(true)
    expect(r.state.shed.every((e) => e.id !== eggId)).toBe(true)
  })

  it('蛋获取事件化：孵化完成即刻降临新蛋', () => {
    let s = fresh(FRI)
    s = addTodo(s, { title: '收尾', difficulty: 'normal', due: null }, FRI)
    const oldId = s.currentEgg!.id
    s.currentEgg!.points = 90
    s.currentEgg!.destiny.judgmentRoll = 99
    const r = completeTodo(s, 'todo-1', FRI)
    expect(r.state.codex).toHaveLength(1)
    expect(r.state.currentEgg).toBeTruthy()
    expect(r.state.currentEgg!.id).not.toBe(oldId)
    expect(r.state.currentEgg!.points).toBe(0)
    expect(r.events.some((e) => e.type === 'eggArrived')).toBe(true)
  })

  it('棚满时周一蛋留台上继续孵化，不生新蛋', () => {
    const s = fresh(TUE)
    const tableId = s.currentEgg!.id
    s.shed = [1, 2, 3].map((n) => ({
      ...structuredClone(s.currentEgg!),
      id: `shed-${n}`,
      dormantWeeks: 1,
    }))
    const r = processTime(s, '2026-08-24')
    expect(r.state.currentEgg!.id).toBe(tableId)
    expect(r.state.shed).toHaveLength(3)
    expect(r.state.shed.every((e) => e.dormantWeeks === 2)).toBe(true)
    expect(r.events.some((e) => e.type === 'eggArrived')).toBe(false)
  })

  it('空台兜底：旧档孵化台为空时即刻领新蛋', () => {
    const s = fresh(FRI)
    s.currentEgg = null
    const r = processTime(s, FRI)
    expect(r.state.currentEgg).toBeTruthy()
    expect(r.events.some((e) => e.type === 'eggArrived')).toBe(true)
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
