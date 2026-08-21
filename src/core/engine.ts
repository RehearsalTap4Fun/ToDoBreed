import { hashStr, mulberry32, weightedPick } from './rng'
import { addDays, daysBetween, isMonday } from './time'
import { gsiId, makeName } from './naming'
import { rollDestiny } from './draw'
import { THEMES, THEME_IDS } from '../data/themes'
import {
  DIFFICULTY_META,
  SLOT_ORDER,
  type CreatureRecord,
  type Difficulty,
  type Egg,
  type GameEvent,
  type GameState,
  type Todo,
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
    dormantWeeks: 0,
    fedBy: [],
  }
  s.seedTick += 1
  s.currentEgg = egg
  events.push({ type: 'eggArrived', theme })
}

/** 变异率 = 5% 基础 + 每条困难/史诗待办 +1%，上限 15%（§06.3） */
export const MUTATION = { base: 0.05, perHard: 0.01, cap: 0.15 }

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
  const record: CreatureRecord = {
    id: gsiId(s.gsiCounter),
    name: makeName(THEMES[egg.theme], egg.destiny, egg.seed),
    nickname: null,
    theme: egg.theme,
    seed: egg.seed,
    traits: egg.destiny.traits,
    aberrations: aberrant ? egg.destiny.aberrations : [],
    outcome: aberrant ? 'aberrant' : 'normal',
    mutation,
    hatchedDay: day,
    riskAtHatch: Math.round(egg.risk),
    fedTodos,
    forced,
  }
  s.gsiCounter += 1
  s.codex.push(record)
  return record
}

/** 孵化台空出后的补位：先取顺延队列，再自动换上最早休眠的蛋 */
function refillTable(s: GameState, day: string, events: GameEvent[]): void {
  if (s.pendingEggs > 0) {
    s.pendingEggs -= 1
    spawnEgg(s, day, events)
  } else if (s.shed.length > 0) {
    s.currentEgg = s.shed.shift()!
  }
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

  // 2) 孵化台上未满 100 点的蛋移入休眠棚（入棚即 +8%，见 §06.5 推演示例）
  if (s.currentEgg && s.currentEgg.points < HATCH_POINTS && s.shed.length < SHED_CAP) {
    const egg = s.currentEgg
    egg.dormantWeeks = 1
    addRisk(egg, RISK.dormantWeekly)
    s.shed.push(egg)
    s.currentEgg = null
  }

  // 3) 新蛋降临；若孵化台仍被占（棚满），新蛋顺延不丢（§04）
  if (s.currentEgg === null) spawnEgg(s, day, events)
  else s.pendingEggs += 1
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
    // 逾期满 7 天自动失败，额外 +12%（§05.2）
    if (overdue >= RISK.autoFailDays) {
      todo.state = 'failed'
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
    pendingEggs: 0,
    todos: [],
    codex: [],
    lastDay: today,
    firstDay: today,
  }
  const events: GameEvent[] = []
  spawnEgg(s, today, events) // 首次进入不等周一，蛋立即降临
  return { state: s, events }
}

/** 补结算离线期间的每一天（含周一事件），打开应用与跨日时调用 */
export function processTime(state: GameState, today: string): TickResult {
  if (today <= state.lastDay) return { state, events: [] }
  const s = clone(state)
  const events: GameEvent[] = []
  let day = s.lastDay
  while (day < today) {
    day = addDays(day, 1)
    dailyTick(s, day, events)
  }
  s.lastDay = today
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

/** 完成待办：结算孵化点 → 揭露 → 可能触发孵化（§05.2） */
export function completeTodo(state: GameState, todoId: string, today: string): TickResult {
  const s = clone(state)
  const events: GameEvent[] = []
  const todo = s.todos.find((t) => t.id === todoId)
  if (!todo || todo.state !== 'open') return { state, events }
  todo.state = 'done'
  todo.doneDay = today

  const egg = s.currentEgg
  if (!egg) {
    events.push({ type: 'noEgg' })
    return { state: s, events }
  }
  egg.fedBy.push(todo.id)
  const before = revealCount(egg.points)
  egg.points = Math.min(HATCH_POINTS, egg.points + DIFFICULTY_META[todo.difficulty].points)
  const after = revealCount(egg.points)
  for (let i = before; i < after; i++) {
    const slot = SLOT_ORDER[i]
    events.push({ type: 'reveal', slot, traitId: egg.destiny.traits[slot], index: i })
  }
  if (egg.points >= HATCH_POINTS) {
    const record = hatchEgg(s, egg, today, false)
    s.currentEgg = null
    events.push({ type: 'hatch', record })
    refillTable(s, today, events)
  }
  return { state: s, events }
}

/** 主动放弃：+6% 风险（§05.2） */
export function abandonTodo(state: GameState, todoId: string): GameState {
  const s = clone(state)
  const todo = s.todos.find((t) => t.id === todoId)
  if (!todo || todo.state !== 'open') return state
  todo.state = 'abandoned'
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
  const egg = s.currentEgg
  if (!egg) return { state, events }
  const before = revealCount(egg.points)
  egg.points = Math.min(HATCH_POINTS, egg.points + points)
  const after = revealCount(egg.points)
  for (let i = before; i < after; i++) {
    const slot = SLOT_ORDER[i]
    events.push({ type: 'reveal', slot, traitId: egg.destiny.traits[slot], index: i })
  }
  if (egg.points >= HATCH_POINTS) {
    const record = hatchEgg(s, egg, today, false)
    s.currentEgg = null
    events.push({ type: 'hatch', record })
    refillTable(s, today, events)
  }
  return { state: s, events }
}
