import { hashStr, mulberry32, pick, weightedPick } from './rng'
import { addDays, daysBetween, isMonday, mondayOf } from './time'
import { gsiId, makeName } from './naming'
import { rollDestiny, rollTraitForSlot } from './draw'
import { THEMES } from '../data/themes'
import { TRAIT_MAP, TRAITS } from '../data/traits'
import { FELINE_THEMES, FELINE_THEME_MAP } from '../qmonster/feline/themes'
import { growFeline, planFeline } from '../qmonster/feline/rules'
import { FELINE_SLOTS, type StoredFelineVisual } from '../qmonster/feline/sdk'
import {
  DIFFICULTY_META,
  Q_SLOT_ORDER,
  SLOT_ORDER,
  type CreatureRecord,
  type Difficulty,
  type Egg,
  type GameEvent,
  type DueRule,
  type GameState,
  type InboxItem,
  type QIdentity,
  type SlotId,
  type Todo,
  type TodoTemplate,
} from './types'

export const HATCH_POINTS = 100
export const THRESHOLDS = [12, 24, 36, 48, 60, 72, 84, 96]
/** gen3（小猫轨）7 槽揭露阈值：花纹、表情、额顶、耳、颈、背、尾 */
export const F_THRESHOLDS = [14, 28, 42, 56, 70, 84, 98]
export const SHED_CAP = 3
export const DORMANT_MAX_WEEKS = 3

/** 风险数值（§06.2） */
export const RISK = {
  base: 3,
  cap: 85,
  overdueFirst: 4,
  overduePerDay: 2,
  overdueCapPerTodo: 12,
  abandon: 6,
  autoFail: 12,
  autoFailDays: 7,
  dormantWeekly: 8,
}

export interface TickResult {
  state: GameState
  events: GameEvent[]
}

const clone = <T,>(v: T): T => structuredClone(v)

export function revealCount(points: number): number {
  return THRESHOLDS.filter((t) => points >= t).length
}

/** 按蛋的轨别计算已揭露槽数（gen3 为 7 槽，其余 8 槽） */
export function revealCountFor(egg: Pick<Egg, 'points' | 'fseed'>): number {
  if (egg.fseed) return F_THRESHOLDS.filter((t) => egg.points >= t).length
  return revealCount(egg.points)
}

export function revealTotalFor(egg: Pick<Egg, 'fseed'>): number {
  return egg.fseed ? FELINE_SLOTS.length : SLOT_ORDER.length
}

function addRisk(egg: Egg, amount: number): void {
  egg.risk = Math.min(RISK.cap, egg.risk + amount)
}

function spawnEgg(s: GameState, day: string, events: GameEvent[]): void {
  const seed = hashStr(`${s.saveSalt}|egg|${s.seedTick}`)
  const rng = mulberry32(seed ^ 0x51ab)
  // gen3（小猫轨）：6 主题，未收集主题权重 ×2（§04）
  const collected = new Set(s.codex.map((c) => c.ftheme).filter(Boolean))
  const ftheme = weightedPick(
    rng,
    FELINE_THEMES.map((t) => ({ item: t.id, w: collected.has(t.id) ? 1 : 2 })),
  )
  const theme = FELINE_THEME_MAP[ftheme].legacyTheme
  const fseed = `f${s.saveSalt.toString(36)}-${s.seedTick}`
  const egg: Egg = {
    id: `egg-${s.seedTick}`,
    theme,
    seed,
    createdDay: day,
    points: 0,
    risk: RISK.base,
    destiny: rollDestiny(THEMES[theme], seed),
    revealed: {},
    fseed,
    ftheme,
    // 正常形态身份此刻同步掷定并存档（揭露卡取值）；破壳时按判定同 seed 重掷最终形态
    fplan: planFeline(fseed, ftheme, 'normal'),
    dormantWeeks: 0,
    fedBy: [],
  }
  s.seedTick += 1
  s.currentEgg = egg
  events.push({ type: 'eggArrived', theme, ftheme })
}

/** 变异率 = 5% 基础 + 每条困难/史诗待办 +1%，上限 15%（§06.3） */
export const MUTATION = { base: 0.05, perHard: 0.01, cap: 0.15 }

/** 按时连击：连续 3 条按时完成后，揭露稀有度加成 R×1.5 / L×2（§05.3） */
export const STREAK_ACTIVATE = 3

/** 孵化结算：判定 → 建档 → 入册。不负责从孵化台/休眠棚移除。 */
function hatchEgg(s: GameState, egg: Egg, day: string, forced: boolean): CreatureRecord {
  const aberrant = egg.destiny.judgmentRoll < egg.risk
  const fedTodos = egg.fedBy
    .map((id) => s.todos.find((t) => t.id === id))
    .filter((t): t is Todo => !!t)
    .map((t) => ({ title: t.title, difficulty: t.difficulty }))
  // 变异只属于正常孵化：畸变由拖延推高，变异由攻坚推高（§06.3）；
  // 按时连击 ≥3 额外 +2%（gen2 起连击的稀有度加成由此承接）
  const hardFed = fedTodos.filter((t) => t.difficulty === 'hard' || t.difficulty === 'epic').length
  const streakBonus = s.streak >= STREAK_ACTIVATE ? 0.02 : 0
  const mutationRate =
    Math.min(MUTATION.cap, MUTATION.base + MUTATION.perHard * hardFed) + streakBonus
  const mutated = !aberrant && egg.destiny.mutationRoll < mutationRate

  const base = {
    id: gsiId(s.gsiCounter),
    nickname: null,
    theme: egg.theme,
    seed: egg.seed,
    outcome: (aberrant ? 'aberrant' : 'normal') as CreatureRecord['outcome'],
    hatchedDay: day,
    riskAtHatch: Math.round(egg.risk),
    fedTodos,
    forced,
    growths: 0,
  }

  let record: CreatureRecord
  if (egg.fseed && egg.ftheme) {
    // gen3：最终形态按判定模式同 seed 重掷（"出生一刻的反转"），命名与稀有度即刻可知；立绘由编排层异步合成
    const fmode = aberrant ? 'aberration' : mutated ? 'mutation' : 'normal'
    const fplan = planFeline(egg.fseed, egg.ftheme, fmode)
    record = {
      ...base,
      name: fplan.name,
      kind: 'feline',
      fseed: egg.fseed,
      ftheme: egg.ftheme,
      fmode,
      fplan,
      fstatus: 'pending',
      aberrations: [],
      mutation: null,
    }
  } else if (egg.qseed) {
    // gen2：形象与语义特征由 QMonster 决定；权威 spec 由编排层异步解析后回写
    record = {
      ...base,
      name: `${egg.destiny.rootChar}·未名`,
      kind: 'qmonster',
      qseed: egg.qseed,
      qmode: aberrant ? 'aberration' : mutated ? 'mutation' : 'normal',
      qsemantic: egg.qidentity?.slots,
      qstatus: 'pending',
      aberrations: [],
      mutation: null,
    }
  } else {
    // legacy：未揭露的槽位静默补掷（不吃连击加成，§06.4）
    SLOT_ORDER.forEach((slot, i) => {
      if (!egg.revealed[slot]) {
        egg.revealed[slot] = rollTraitForSlot(THEMES[egg.theme], egg.seed, i, egg.revealed, false)
      }
    })
    const traits = egg.revealed as Record<SlotId, string>
    record = {
      ...base,
      name: makeName(THEMES[egg.theme], egg.destiny.rootChar, traits, egg.seed),
      traits,
      aberrations: aberrant ? egg.destiny.aberrations : [],
      mutation: mutated ? egg.destiny.mutationPick : null,
    }
  }
  s.gsiCounter += 1
  s.codex.push(record)
  return record
}

function weeklyTick(s: GameState, day: string, events: GameEvent[]): void {
  // 1) 休眠棚结算：每满一周 +8%，休眠满 3 周强制孵化判定（§06.4）
  const remaining: Egg[] = []
  for (const egg of s.shed) {
    egg.dormantWeeks += 1
    addRisk(egg, RISK.dormantWeekly)
    if (egg.dormantWeeks > DORMANT_MAX_WEEKS) {
      const record = hatchEgg(s, egg, day, true)
      events.push({ type: 'forcedHatch', record })
    } else {
      remaining.push(egg)
    }
  }
  s.shed = remaining

  // 2) 孵化台上未满 100 点的蛋移入休眠棚（入棚即 +8%，见 §06.5 推演示例）；
  //    棚满则蛋留在台上继续孵化
  if (s.currentEgg && s.currentEgg.points < HATCH_POINTS && s.shed.length < SHED_CAP) {
    const egg = s.currentEgg
    egg.dormantWeeks = 1
    addRisk(egg, RISK.dormantWeekly)
    s.shed.push(egg)
    s.currentEgg = null
  }

  // 3) 蛋获取事件化（v0.2 修订）：入棚休眠腾出孵化台的瞬间，新蛋降临
  if (s.currentEgg === null) spawnEgg(s, day, events)
}

function dailyTick(s: GameState, day: string, events: GameEvent[]): void {
  if (isMonday(day)) weeklyTick(s, day, events)

  for (const todo of s.todos) {
    if (todo.state !== 'open' || !todo.due) continue
    const overdue = daysBetween(todo.due, day)
    if (overdue <= 0) continue
    // 逾期首日 +4%，此后每日 +2%，单条上限 +12%（§06.2）
    const inc = overdue === 1 ? RISK.overdueFirst : RISK.overduePerDay
    const applied = Math.max(0, Math.min(inc, RISK.overdueCapPerTodo - todo.riskFromOverdue))
    if (applied > 0) {
      todo.riskFromOverdue += applied
      if (s.currentEgg) addRisk(s.currentEgg, applied)
    }
    // 逾期满 7 天自动失败，额外 +12%，连击清零（§05.2）
    if (overdue >= RISK.autoFailDays) {
      todo.state = 'failed'
      s.streak = 0
      if (s.currentEgg) addRisk(s.currentEgg, RISK.autoFail)
      events.push({ type: 'autoFail', todoTitle: todo.title })
    }
  }
}

export function initState(today: string): TickResult {
  const s: GameState = {
    version: 1,
    gsiCounter: 1,
    seedTick: 1,
    saveSalt: Math.floor(Math.random() * 2 ** 31),
    currentEgg: null,
    shed: [],
    todos: [],
    templates: [...DEFAULT_TEMPLATES],
    inbox: [],
    seenSuggestions: [],
    codex: [],
    streak: 0,
    residentId: null,
    lastDay: today,
    firstDay: today,
  }
  const events: GameEvent[] = []
  spawnEgg(s, today, events) // 首次进入不等周一，蛋立即降临
  return { state: s, events }
}

/** 补结算离线期间的每一天（含周一事件），打开应用与跨日时调用；空台即领新蛋 */
export function processTime(state: GameState, today: string): TickResult {
  if (today <= state.lastDay && state.currentEgg !== null) return { state, events: [] }
  const s = clone(state)
  const events: GameEvent[] = []
  let day = s.lastDay
  while (day < today) {
    day = addDays(day, 1)
    dailyTick(s, day, events)
  }
  if (today > s.lastDay) s.lastDay = today
  // 兜底（含旧档迁移）：孵化台空着就即刻领新蛋
  if (s.currentEgg === null) spawnEgg(s, today, events)
  return { state: s, events }
}

export function addTodo(
  state: GameState,
  input: { title: string; difficulty: Difficulty; due: string | null },
  today: string,
): GameState {
  const s = clone(state)
  const todo: Todo = {
    id: `todo-${s.todos.length + 1}`,
    title: input.title.trim(),
    difficulty: input.difficulty,
    due: input.due,
    createdDay: today,
    state: 'open',
    riskFromOverdue: 0,
  }
  s.todos.push(todo)
  return s
}

/** 注入孵化点：揭露（连击加成在此刻生效）→ 可能触发孵化 */
function feedPoints(s: GameState, points: number, today: string, events: GameEvent[]): void {
  const egg = s.currentEgg
  if (!egg) return
  const before = revealCountFor(egg)
  egg.points = Math.min(HATCH_POINTS, egg.points + points)
  const after = revealCountFor(egg)
  const boost = s.streak >= STREAK_ACTIVATE
  for (let i = before; i < after; i++) {
    if (egg.fseed && egg.fplan) {
      // gen3：揭露正常形态的 7 槽之一（花纹→表情→额顶→耳→颈→背→尾）
      const fslot = FELINE_SLOTS[i]
      events.push({
        type: 'freveal',
        slot: fslot,
        value: egg.fplan.selections[fslot],
        index: i,
        total: FELINE_SLOTS.length,
      })
      continue
    }
    const slot = SLOT_ORDER[i]
    if (egg.qseed) {
      // gen2：揭露 QMonster 语义槽（身份未解析时先出空卡，UI 显示"凝聚中"）
      const qtraitId = egg.qidentity?.slots[Q_SLOT_ORDER[i]] ?? ''
      events.push({ type: 'reveal', slot, traitId: '', index: i, qtraitId })
    } else {
      const traitId = rollTraitForSlot(THEMES[egg.theme], egg.seed, i, egg.revealed, boost)
      egg.revealed[slot] = traitId
      events.push({ type: 'reveal', slot, traitId, index: i })
    }
  }
  if (egg.points >= HATCH_POINTS) {
    const record = hatchEgg(s, egg, today, false)
    s.currentEgg = null
    events.push({ type: 'hatch', record })
    // 蛋获取事件化（v0.2 修订）：孵化完成即刻降临新蛋
    spawnEgg(s, today, events)
  }
}

/** 连击结算（§05.3）：按时 +1、逾期完成清零、无截止日不影响 */
function settleStreak(s: GameState, todo: Todo, today: string, events: GameEvent[]): void {
  if (!todo.due) return
  const prev = s.streak
  if (today <= todo.due) s.streak += 1
  else s.streak = 0
  if (s.streak >= STREAK_ACTIVATE && prev < STREAK_ACTIVATE) {
    events.push({ type: 'streakOn', count: s.streak })
  } else if (prev >= STREAK_ACTIVATE && s.streak === 0) {
    events.push({ type: 'streakBreak' })
  }
}

/** 完成待办：连击结算 → 孵化点 → 揭露 → 可能触发孵化（§05.2） */
export function completeTodo(state: GameState, todoId: string, today: string): TickResult {
  const s = clone(state)
  const events: GameEvent[] = []
  const todo = s.todos.find((t) => t.id === todoId)
  if (!todo || todo.state !== 'open') return { state, events }
  todo.state = 'done'
  todo.doneDay = today
  settleStreak(s, todo, today, events)

  const egg = s.currentEgg
  if (!egg) {
    events.push({ type: 'noEgg' })
    return { state: s, events }
  }
  egg.fedBy.push(todo.id)
  // 成长判定在孵化结算前——开窍的是一路看着你工作的那只，而非本次孵出的新生儿
  tryResidentGrow(s, todo, events)
  feedPoints(s, DIFFICULTY_META[todo.difficulty].points, today, events)
  return { state: s, events }
}

/** 主动放弃：+6% 风险（§05.2） */
export function abandonTodo(state: GameState, todoId: string): GameState {
  const s = clone(state)
  const todo = s.todos.find((t) => t.id === todoId)
  if (!todo || todo.state !== 'open') return state
  todo.state = 'abandoned'
  s.streak = 0
  if (s.currentEgg) addRisk(s.currentEgg, RISK.abandon)
  return s
}

/** 手动交换孵化台与休眠棚的蛋（§06.4）；孵化台为空时直接取出 */
export function swapEgg(state: GameState, shedIndex: number): GameState {
  const s = clone(state)
  const shedEgg = s.shed[shedIndex]
  if (!shedEgg) return state
  if (s.currentEgg) {
    s.shed[shedIndex] = s.currentEgg
  } else {
    s.shed.splice(shedIndex, 1)
  }
  s.currentEgg = shedEgg
  return s
}

/* ── 常用模版（重复性事务一键便签，§05） ─────────── */

export const TEMPLATE_CAP = 12

/** 首发预置模版：日常型今天截止，习惯型本周内（周日）截止 */
export const DEFAULT_TEMPLATES: TodoTemplate[] = [
  { id: 'tpl-daily-report', title: '写日报', difficulty: 'easy', dueRule: 'today' },
  { id: 'tpl-knowledge', title: '整理个人知识库', difficulty: 'normal', dueRule: 'today' },
  { id: 'tpl-workout', title: '运动健身', difficulty: 'normal', dueRule: 'today' },
  { id: 'tpl-outdoor', title: '户外活动', difficulty: 'normal', dueRule: 'this-week' },
  { id: 'tpl-reading', title: '阅读', difficulty: 'easy', dueRule: 'this-week' },
  { id: 'tpl-inbox-zero', title: '清理邮件', difficulty: 'easy', dueRule: 'this-week' },
]

/** 期限规则 → 实际截止日（this-week = 本周日） */
export function resolveDueRule(rule: DueRule, today: string): string | null {
  switch (rule) {
    case 'today':
      return today
    case 'tomorrow':
      return addDays(today, 1)
    case 'this-week':
      return addDays(mondayOf(today), 6)
    default:
      return null
  }
}

/** 从实际截止日归纳期限规则（存为模版时用） */
export function inferDueRule(due: string | null, today: string): DueRule {
  if (!due) return 'none'
  if (due === today) return 'today'
  if (due === addDays(today, 1)) return 'tomorrow'
  if (due > today && due <= addDays(mondayOf(today), 6)) return 'this-week'
  return 'none'
}

/** 一键钉上：按模版规则生成待办 */
export function applyTemplate(state: GameState, templateId: string, today: string): GameState {
  const tpl = state.templates.find((t) => t.id === templateId)
  if (!tpl) return state
  return addTodo(state, { title: tpl.title, difficulty: tpl.difficulty, due: resolveDueRule(tpl.dueRule, today) }, today)
}

/** 存为模版（同名覆盖，上限 12 条） */
export function addTemplate(
  state: GameState,
  input: { title: string; difficulty: Difficulty; dueRule: DueRule },
): GameState {
  const title = input.title.trim().slice(0, 30)
  if (!title) return state
  const s = clone(state)
  s.templates = s.templates.filter((t) => t.title !== title)
  if (s.templates.length >= TEMPLATE_CAP) s.templates.shift()
  s.templates.push({
    id: `tpl-${Math.random().toString(36).slice(2, 8)}`,
    title,
    difficulty: input.difficulty,
    dueRule: input.dueRule,
  })
  return s
}

export function removeTemplate(state: GameState, templateId: string): GameState {
  if (!state.templates.some((t) => t.id === templateId)) return state
  const s = clone(state)
  s.templates = s.templates.filter((t) => t.id !== templateId)
  return s
}

/* ── 线索信箱（外部待办建议） ─────────────────────── */

const INBOX_CAP = 20
const SEEN_CAP = 500
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'epic']

export interface SuggestionInput {
  hash?: string
  title?: string
  source?: string
  difficulty?: string
  due?: string | null
}

/** 导入采集器产出的建议：按哈希去重（含历史采纳/忽略），只进信箱不上黑板 */
export function importSuggestions(
  state: GameState,
  items: SuggestionInput[],
): { state: GameState; added: number } {
  const seen = new Set(state.seenSuggestions)
  const fresh: InboxItem[] = []
  for (const raw of items) {
    const title = (raw.title ?? '').trim().slice(0, 60)
    const hash = (raw.hash ?? '').trim()
    if (!title || !hash || seen.has(hash)) continue
    seen.add(hash)
    const due = /^\d{4}-\d{2}-\d{2}$/.test(raw.due ?? '') ? (raw.due as string) : null
    fresh.push({
      hash,
      title,
      source: (raw.source ?? '外部').trim().slice(0, 20) || '外部',
      difficulty: DIFFICULTIES.includes(raw.difficulty as Difficulty)
        ? (raw.difficulty as Difficulty)
        : 'normal',
      due,
    })
    if (state.inbox.length + fresh.length >= INBOX_CAP) break
  }
  if (fresh.length === 0) return { state, added: 0 }
  const s = clone(state)
  s.inbox.push(...fresh)
  s.seenSuggestions.push(...fresh.map((f) => f.hash))
  if (s.seenSuggestions.length > SEEN_CAP) {
    s.seenSuggestions = s.seenSuggestions.slice(-SEEN_CAP)
  }
  return { state: s, added: fresh.length }
}

/** 采纳建议：从信箱移除并钉上黑板（可调难度与截止日） */
export function adoptInbox(
  state: GameState,
  hash: string,
  difficulty: Difficulty,
  due: string | null,
  today: string,
): GameState {
  const item = state.inbox.find((i) => i.hash === hash)
  if (!item) return state
  const s = clone(state)
  s.inbox = s.inbox.filter((i) => i.hash !== hash)
  s.todos.push({
    id: `todo-${s.todos.length + 1}`,
    title: item.title,
    difficulty,
    due,
    createdDay: today,
    state: 'open',
    riskFromOverdue: 0,
  })
  return s
}

/** 忽略建议：移出信箱（哈希已入 seen，不会再送来） */
export function dismissInbox(state: GameState, hash: string): GameState {
  if (!state.inbox.some((i) => i.hash === hash)) return state
  const s = clone(state)
  s.inbox = s.inbox.filter((i) => i.hash !== hash)
  return s
}

/* ── 驻场成长（完成待办时概率升品特征） ─────────── */

/** 成长概率按难度：攻坚更容易让驻场的小家伙开窍；每只上限 3 次 */
export const GROW = {
  chance: { easy: 0.02, normal: 0.04, hard: 0.08, epic: 0.14 } as Record<Difficulty, number>,
  cap: 3,
}

const RARITY_ORDER = { N: 0, R: 1, L: 2 } as const

/** 候选特征与生物现有其他特征是否互斥（双向检查） */
function conflictsWith(candidateId: string, traits: Record<SlotId, string>, exceptSlot: SlotId): boolean {
  const cand = TRAIT_MAP[candidateId]
  for (const slot of SLOT_ORDER) {
    if (slot === exceptSlot) continue
    const other = TRAIT_MAP[traits[slot]]
    if (cand.excludes?.includes(other.id)) return true
    if (other.excludes?.includes(cand.id)) return true
  }
  return false
}

/**
 * 驻场成长判定：种子来自存档盐+待办 id，掷出即入档（刷新无法重掷）。
 * 命中时随机一个可升品槽位，换成同槽更高稀有度的特征（升一档为主，小概率跳档）。
 */
function tryResidentGrow(s: GameState, todo: Todo, events: GameEvent[]): void {
  const rec = residentOf(s)
  if (!rec || rec.growths >= GROW.cap) return
  const rng = mulberry32(hashStr(`${s.saveSalt}|grow|${todo.id}`))
  if (rng() >= GROW.chance[todo.difficulty]) return
  if (rec.kind === 'feline') {
    tryFelineGrow(rec, rng, events)
    return
  }
  // gen2 旧生物已冻结只读，不再成长
  if (rec.kind === 'qmonster' || !rec.traits) return

  const traits = rec.traits
  const upgradables = SLOT_ORDER.filter((slot) => {
    const cur = TRAIT_MAP[traits[slot]]
    return TRAITS.some(
      (t) =>
        t.slot === slot &&
        RARITY_ORDER[t.rarity] > RARITY_ORDER[cur.rarity] &&
        !conflictsWith(t.id, traits, slot),
    )
  })
  if (upgradables.length === 0) return

  const slot = pick(rng, upgradables)
  const cur = TRAIT_MAP[traits[slot]]
  const candidates = TRAITS.filter(
    (t) =>
      t.slot === slot &&
      RARITY_ORDER[t.rarity] > RARITY_ORDER[cur.rarity] &&
      !conflictsWith(t.id, traits, slot),
  )
  const picked = weightedPick(
    rng,
    candidates.map((t) => ({
      item: t,
      w: RARITY_ORDER[t.rarity] === RARITY_ORDER[cur.rarity] + 1 ? 70 : 30,
    })),
  )
  const fromId = traits[slot]
  traits[slot] = picked.id
  rec.growths += 1
  events.push({
    type: 'residentGrow',
    record: structuredClone(rec),
    slot,
    fromId,
    toId: picked.id,
  })
}

/** gen3 成长：先长齐再升品（规则见 feline/rules.ts growFeline）；形象置为待重新合成 */
function tryFelineGrow(rec: CreatureRecord, rng: ReturnType<typeof mulberry32>, events: GameEvent[]): void {
  if (!rec.fplan) return
  const grown = growFeline(rng, rec.fplan)
  if (!grown) return
  const rarityFrom = rec.fplan.rarity
  rec.fplan = grown.plan
  rec.growths += 1
  rec.fstatus = 'pending'
  delete rec.fvisual
  delete rec.fimageKey
  events.push({
    type: 'fgrow',
    record: structuredClone(rec),
    slot: grown.growth.slot,
    from: grown.growth.from,
    to: grown.growth.to,
    rarityFrom,
    rarityTo: grown.plan.rarity,
  })
}

/** 回写 gen2 冻结信息（立绘 data URL / 语义特征名），任一缺失时可分次补齐 */
export function setRecordFrozen(
  state: GameState,
  recordId: string,
  patch: { qimageData?: string; qtraitNames?: CreatureRecord['qtraitNames'] },
): GameState {
  const rec = state.codex.find((c) => c.id === recordId)
  if (!rec || rec.kind !== 'qmonster') return state
  if (!patch.qimageData && !patch.qtraitNames) return state
  const s = clone(state)
  const target = s.codex.find((c) => c.id === recordId)!
  if (patch.qimageData) target.qimageData = patch.qimageData
  if (patch.qtraitNames) target.qtraitNames = patch.qtraitNames
  return s
}

/** 回写蛋的 QMonster 身份（编排层异步解析后调用） */
export function setEggIdentity(state: GameState, eggId: string, identity: QIdentity): GameState {
  const find = (st: GameState) =>
    st.currentEgg?.id === eggId ? st.currentEgg : st.shed.find((e) => e.id === eggId)
  const target = find(state)
  if (!target || !target.qseed || target.qidentity) return state
  const s = clone(state)
  find(s)!.qidentity = identity
  return s
}

/** 回写档案的权威 MonsterSpec 与最终信息（编排层解析+渲染完成后调用） */
export function setRecordSpec(
  state: GameState,
  recordId: string,
  patch: {
    qspec: unknown
    qsemantic: Record<string, string>
    qimageKey: string
    name?: string
  },
): GameState {
  const rec = state.codex.find((c) => c.id === recordId)
  if (!rec || rec.kind !== 'qmonster') return state
  const s = clone(state)
  const target = s.codex.find((c) => c.id === recordId)!
  target.qspec = patch.qspec
  target.qsemantic = patch.qsemantic as CreatureRecord['qsemantic']
  target.qimageKey = patch.qimageKey
  target.qstatus = 'ready'
  if (patch.name && target.nickname === null) target.name = patch.name
  return s
}

/** 回写 gen3 档案的形象身份与缓存键（编排层合成完成后调用） */
export function setRecordFelineVisual(
  state: GameState,
  recordId: string,
  patch: { fvisual: StoredFelineVisual; fimageKey: string },
): GameState {
  const rec = state.codex.find((c) => c.id === recordId)
  if (!rec || rec.kind !== 'feline') return state
  const s = clone(state)
  const target = s.codex.find((c) => c.id === recordId)!
  target.fvisual = patch.fvisual
  target.fimageKey = patch.fimageKey
  target.fstatus = 'ready'
  return s
}

/** 当前驻场生物：显式指定优先，否则跟随最新孵化；指定失效（导档等）时回退最新 */
export function residentOf(state: GameState): CreatureRecord | null {
  if (state.residentId) {
    const chosen = state.codex.find((c) => c.id === state.residentId)
    if (chosen) return chosen
  }
  return state.codex[state.codex.length - 1] ?? null
}

/** 指定/取消指定驻场生物（null = 恢复跟随最新孵化） */
export function setResident(state: GameState, recordId: string | null): GameState {
  if (recordId !== null && !state.codex.some((c) => c.id === recordId)) return state
  if (state.residentId === recordId) return state
  const s = clone(state)
  s.residentId = recordId
  return s
}

export function renameCreature(state: GameState, recordId: string, nickname: string): GameState {
  const s = clone(state)
  const rec = s.codex.find((c) => c.id === recordId)
  if (rec) rec.nickname = nickname.trim() || null
  return s
}

/** 仅供开发面板：直接注入孵化点 */
export function devFeed(state: GameState, points: number, today: string): TickResult {
  const s = clone(state)
  const events: GameEvent[] = []
  if (!s.currentEgg) return { state, events }
  feedPoints(s, points, today, events)
  return { state: s, events }
}
