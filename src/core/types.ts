export type SlotId =
  | 'frame'
  | 'limbs'
  | 'head'
  | 'mouth'
  | 'surface'
  | 'pattern'
  | 'temperament'
  | 'quirk'

/** 揭露顺序：先形体、再表面、后灵魂（设计文档 §06.1） */
export const SLOT_ORDER: SlotId[] = [
  'frame',
  'limbs',
  'head',
  'mouth',
  'surface',
  'pattern',
  'temperament',
  'quirk',
]

export const SLOT_NAMES: Record<SlotId, string> = {
  frame: '体型骨架',
  limbs: '附肢',
  head: '头部与眼',
  mouth: '口器',
  surface: '表皮材质',
  pattern: '纹样',
  temperament: '性格气质',
  quirk: '异能怪癖',
}

export type Rarity = 'N' | 'R'

export interface TraitDef {
  id: string
  slot: SlotId
  name: string
  rarity: Rarity
  flavor: string
  /** 命名词根（§09） */
  nameChar: string
  /** 与后续槽位特征的互斥（§07.1） */
  excludes?: string[]
  /** 对后续槽位特征的联动权重倍率（§07.1） */
  boosts?: Record<string, number>
}

export type ThemeId = 'deepsea' | 'fungal' | 'shadow'

export interface ThemeDef {
  id: ThemeId
  name: string
  eggDesc: string
  /** [主色, 辅色, 点缀色] */
  palette: [string, string, string]
  pools: Partial<Record<SlotId, string[]>>
  nameRoots: string[]
}

export interface AberrationDef {
  id: string
  name: string
  desc: string
}

export interface Destiny {
  /** 蛋生成瞬间已注定的 8 个特征（§13.1 固定种子） */
  traits: Record<SlotId, string>
  /** 孵化判定的骰值 0–100，孵化时与风险值比较 */
  judgmentRoll: number
  /** 若判定为畸变时套用的畸变（1–2 条） */
  aberrations: { slot: SlotId; ab: string }[]
  /** 命名用主题词根 */
  rootChar: string
}

export type Difficulty = 'easy' | 'normal' | 'hard' | 'epic'

export const DIFFICULTY_META: Record<Difficulty, { name: string; points: number; hint: string }> = {
  easy: { name: '轻松', points: 5, hint: '15 分钟内' },
  normal: { name: '普通', points: 10, hint: '一小时级 / 单日' },
  hard: { name: '困难', points: 20, hint: '多日攻坚' },
  epic: { name: '史诗', points: 35, hint: '周级大事' },
}

export interface Egg {
  id: string
  theme: ThemeId
  seed: number
  createdDay: string
  points: number
  /** 畸变风险，百分数 3–85 */
  risk: number
  destiny: Destiny
  dormantWeeks: number
  /** 喂养此蛋的待办 id */
  fedBy: string[]
}

export type TodoState = 'open' | 'done' | 'abandoned' | 'failed'

export interface Todo {
  id: string
  title: string
  difficulty: Difficulty
  /** YYYY-MM-DD 或 null（无截止） */
  due: string | null
  createdDay: string
  state: TodoState
  doneDay?: string
  /** 该待办已累积的逾期风险（上限 12，§06.2） */
  riskFromOverdue: number
}

export type Outcome = 'normal' | 'aberrant'

export interface FedTodoSnapshot {
  title: string
  difficulty: Difficulty
}

export interface CreatureRecord {
  id: string
  name: string
  nickname: string | null
  theme: ThemeId
  seed: number
  traits: Record<SlotId, string>
  aberrations: { slot: SlotId; ab: string }[]
  outcome: Outcome
  hatchedDay: string
  riskAtHatch: number
  fedTodos: FedTodoSnapshot[]
  /** 休眠强制孵化时为 true（未揭露槽位静默补全） */
  forced: boolean
}

export interface GameState {
  version: 1
  gsiCounter: number
  seedTick: number
  /** 存档级随机盐，保证不同存档的蛋命运不同 */
  saveSalt: number
  currentEgg: Egg | null
  shed: Egg[]
  pendingEggs: number
  todos: Todo[]
  codex: CreatureRecord[]
  /** 上次结算到的自然日 */
  lastDay: string
  firstDay: string
}

export type GameEvent =
  | { type: 'reveal'; slot: SlotId; traitId: string; index: number }
  | { type: 'hatch'; record: CreatureRecord }
  | { type: 'eggArrived'; theme: ThemeId }
  | { type: 'autoFail'; todoTitle: string }
  | { type: 'forcedHatch'; record: CreatureRecord }
  | { type: 'noEgg' }
