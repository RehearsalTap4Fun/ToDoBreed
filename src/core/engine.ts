import { hashStr, mulberry32, pick, weightedPick } from './rng'
import { addDays, daysBetween, isMonday, mondayOf } from './time'
import { gsiId, makeName } from './naming'
import { rollDestiny, rollTraitForSlot } from './draw'
import { THEMES, THEME_IDS } from '../data/themes'
import { TRAIT_MAP, TRAITS } from '../data/traits'
import {
  DIFFICULTY_META,
  SLOT_ORDER,
  type CreatureRecord,
  type Difficulty,
  type Egg,
  type GameEvent,
  type DueRule,
  type GameState,
  type InboxItem,
  type SlotId,
  type Todo,
  type TodoTemplate,
} from './types'

export const HATCH_POINTS = 100
export const THRESHOLDS = [12, 24, 36, 48, 60, 72, 84, 96]
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

function addRisk(egg: Egg, amount: number): void {
  egg.risk = Math.min(RISK.cap, egg.risk + amount)
}

function spawnEgg(s: GameState, day: string, events: GameEvent[]): void {
  const seed = hashStr(`${s.saveSalt}|egg|${s.seedTick}`)
  const rng = mulberry32(seed ^ 0x51ab)
  // 未收集主题权重 ×2（§04）
  const collected = new Set(s.codex.map((c) => c.theme))
  const theme = weightedPick(
    rng,
    THEME_IDS.map((t) => ({ item: t, w: collected.has(t) ? 1 : 2 })),
  )
  const egg: Egg = {
    id: `egg-${s.seedTick}`,
    theme,
    seed,
    createdDay: day,
    points: 0,
    risk: RISK.base,
    destiny: rollDestiny(THEMES[theme], seed),
    revealed: {},
    dormantWeeks: 0,
    fedBy: [],
  }
  s.seedTick += 1
  s.currentEgg = egg
  events.push({ type: 'eggArrived', theme })
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
  // 变异只属于正常孵化：畸变由拖延推高，变异由攻坚推高（§06.3）
  const hardFed = fedTodos.filter((t) => t.difficulty === 'hard' || t.difficulty === 'epic').length
  const mutationRate = Math.min(MUTATION.cap, MUTATION.base + MUTATION.perHard * hardFed)
  const mutation = !aberrant && egg.destiny.mutationRoll < mutationRate ? egg.destiny.mutationPick : null
  // 未揭露的槽位静默补掷（不吃连击加成，§06.4）
  SLOT_ORDER.forEach((slot, i) => {
    if (!egg.revealed[slot]) {
      egg.revealed[slot] = rollTraitForSlot(THEMES[egg.theme], egg.seed, i, egg.revealed, false)
    }
  })
  const traits = egg.revealed as Record<SlotId, string>
  const record: CreatureRecord = {
    id: gsiId(s.gsiCounter),
    name: makeName(THEMES[egg.theme], egg.destiny.rootChar, traits, egg.seed),
    nickname: null,
    theme: egg.theme,
    seed: egg.seed,
    traits,
    aberrations: aberrant ? egg.destiny.aberrations : [],
    outcome: aberrant ? 'aberrant' : 'normal',
    mutation,
    hatchedDay: day,
    riskAtHatch: Math.round(egg.risk),
    fedTodos,
    forced,
    growths: 0,
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
  const before = revealCount(egg.points)
  egg.points = Math.min(HATCH_POINTS, egg.points + points)
  const after = revealCount(egg.points)
  const boost = s.streak >= STREAK_ACTIVATE
  for (let i = before; i < after; i++) {
    const slot = SLOT_ORDER[i]
    const traitId = rollTraitForSlot(THEMES[egg.theme], egg.seed, i, egg.revealed, boost)
    egg.revealed[slot] = traitId
    events.push({ type: 'reveal', slot, traitId, index: i })
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

  const upgradables = SLOT_ORDER.filter((slot) => {
    const cur = TRAIT_MAP[rec.traits[slot]]
    return TRAITS.some(
      (t) =>
        t.slot === slot &&
        RARITY_ORDER[t.rarity] > RARITY_ORDER[cur.rarity] &&
        !conflictsWith(t.id, rec.traits, slot),
    )
  })
  if (upgradables.length === 0) return

  const slot = pick(rng, upgradables)
  const cur = TRAIT_MAP[rec.traits[slot]]
  const candidates = TRAITS.filter(
    (t) =>
      t.slot === slot &&
      RARITY_ORDER[t.rarity] > RARITY_ORDER[cur.rarity] &&
      !conflictsWith(t.id, rec.traits, slot),
  )
  const picked = weightedPick(
    rng,
    candidates.map((t) => ({
      item: t,
      w: RARITY_ORDER[t.rarity] === RARITY_ORDER[cur.rarity] + 1 ? 70 : 30,
    })),
  )
  const fromId = rec.traits[slot]
  rec.traits[slot] = picked.id
  rec.growths += 1
  events.push({
    type: 'residentGrow',
    record: structuredClone(rec),
    slot,
    fromId,
    toId: picked.id,
  })
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
