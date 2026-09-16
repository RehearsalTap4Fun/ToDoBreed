import type { FelineThemeId } from '../qmonster/feline/themes'
import type { FelineMode, FelinePlan } from '../qmonster/feline/rules'
import type { FelineSlot, MutationSlot, StoredFelineVisual } from '../qmonster/feline/sdk'
import type { AnyMutationId } from '../qmonster/feline/mutations'

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

export type Rarity = 'N' | 'R' | 'L'

/* ── QMonster 换轨（Phase 2）：新蛋的形象与语义特征由 QMonster 生成器提供 ── */

/** QMonster 语义槽（8 个，与本作 8 槽语义一一对应），揭露顺序沿用"先形体后灵魂" */
export const Q_SLOT_ORDER = [
  'frame',
  'appendage',
  'headAndEyes',
  'mouth',
  'surface',
  'pattern',
  'personality',
  'quirk',
] as const
export type QSlotId = (typeof Q_SLOT_ORDER)[number]

export const Q_SLOT_NAMES: Record<QSlotId, string> = {
  frame: '体型骨架',
  appendage: '附肢',
  headAndEyes: '头部与眼',
  mouth: '口器',
  surface: '表皮材质',
  pattern: '纹样',
  personality: '性格气质',
  quirk: '异能怪癖',
}

export type QMode = 'normal' | 'mutation' | 'aberration'

/** 蛋的 QMonster 身份（异步解析：确定性重试收敛后回写） */
export interface QIdentity {
  /** 重试收敛后的实际 seed（qseed 或 qseed#N） */
  resolvedSeed: string
  /** 语义槽 → 语义特征 id（揭露与观察卡由此取名） */
  slots: Record<QSlotId, string>
}

export const RARITY_NAMES: Record<Rarity, string> = { N: '普通', R: '稀有', L: '传说' }

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

/**
 * 命运（蛋生成瞬间注定的部分）。
 * v0.2b 决议：8 个特征改为「揭露瞬间懒掷」并立即存档（连击加成得以生效，仍防刷新重掷），
 * 判定骰、畸变预案、变异骰、命名词根保持预掷——结局注定，过程由你。
 */
export interface Destiny {
  /** 孵化判定的骰值 0–100，孵化时与风险值比较 */
  judgmentRoll: number
  /** 若判定为畸变时套用的畸变（1–2 条） */
  aberrations: { slot: SlotId; ab: string }[]
  /** 变异判定骰 0–1，正常孵化时与变异率比较（§06.3） */
  mutationRoll: number
  /** 若变异命中时揭晓的变异 id */
  mutationPick: string
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
  /** 已揭露的特征（legacy 蛋：揭露瞬间掷定并立即存档） */
  revealed: Partial<Record<SlotId, string>>
  /** QMonster 基础种子（有此字段 = gen2 蛋，形象与特征由 QMonster 提供） */
  qseed?: string
  /** QMonster 身份（正常形态），由编排层异步解析后回写 */
  qidentity?: QIdentity
  /** gen3（小猫轨）种子：有此字段 = gen3 蛋，形象由 QMonster v0.10 小猫组合 SDK 合成 */
  fseed?: string
  /** gen3 主题（6 主题之一）；theme 字段仅供旧代码路径回退 */
  ftheme?: FelineThemeId
  /** gen3 正常形态身份：生成瞬间同步掷定并存档（揭露卡由此取值，防刷新重掷） */
  fplan?: FelinePlan
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

/** 模版期限规则：钉上时换算为实际截止日 */
export type DueRule = 'none' | 'today' | 'tomorrow' | 'this-week'

export const DUE_RULE_NAMES: Record<DueRule, string> = {
  none: '无期限',
  today: '今天',
  tomorrow: '明天',
  'this-week': '本周内',
}

/** 常用模版：重复性事务的一键便签（§05） */
export interface TodoTemplate {
  id: string
  title: string
  difficulty: Difficulty
  dueRule: DueRule
}

/** 线索信箱条目：采集脚本从 git/AI 会话中提炼的待办建议，需人工采纳才上黑板 */
export interface InboxItem {
  /** 采集器生成的去重哈希 */
  hash: string
  title: string
  /** 来源简述，如 "git:incubator" / "claude会话" / "jira:PROJ" */
  source: string
  difficulty: Difficulty
  /** 建议截止日（如 Jira duedate 透传），采纳时预填可改 */
  due?: string | null
}

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
  /** legacy（SVG 参数化）生物的 8 槽特征；gen2 生物无此字段 */
  traits?: Record<SlotId, string>
  /** 'qmonster' = gen2 生物（QMonster 位图立绘）；'feline' = gen3 小猫轨；缺省 = legacy SVG */
  kind?: 'qmonster' | 'feline'
  /** gen2：QMonster 基础种子 */
  qseed?: string
  /** gen2：生成模式（由孵化判定映射：畸变→aberration，变异→mutation） */
  qmode?: QMode
  /** gen2：语义槽 → 语义特征 id */
  qsemantic?: Record<QSlotId, string>
  /** gen2：权威 MonsterSpec（JSON），解析完成后回写 */
  qspec?: unknown
  /** gen2：形象解析状态 */
  qstatus?: 'pending' | 'ready'
  /** gen2：IndexedDB 图像缓存键 */
  qimageKey?: string
  /** gen2 冻结：512² 立绘 data URL（QMonster v0.3 运行时下线后旧生物只读展示，随存档携带） */
  qimageData?: string
  /** gen2 冻结：语义槽 → 展示名与稀有度 */
  qtraitNames?: Partial<Record<QSlotId, { name: string; rarity: Rarity }>>
  /** gen3：小猫轨种子 */
  fseed?: string
  /** gen3：主题 */
  ftheme?: FelineThemeId
  /** gen3：判定模式（畸变→aberration，变异→mutation） */
  fmode?: FelineMode
  /** gen3：最终形态（破壳时按判定同 seed 重掷，命名/稀有度即刻可知） */
  fplan?: FelinePlan
  /** gen3：SDK 形象身份（首次合成后回写；缓存丢失时据此 restore） */
  fvisual?: StoredFelineVisual
  /** gen3：IndexedDB 图像缓存键（SDK cacheKey，绑定目录哈希+运行版本+规格哈希） */
  fimageKey?: string
  /** gen3：形象合成状态 */
  fstatus?: 'pending' | 'ready'
  aberrations: { slot: SlotId; ab: string }[]
  outcome: Outcome
  /** 变异 id；正常孵化才可能非 null（§06.3） */
  mutation: string | null
  hatchedDay: string
  riskAtHatch: number
  fedTodos: FedTodoSnapshot[]
  /** 休眠强制孵化时为 true（未揭露槽位静默补全） */
  forced: boolean
  /** 驻场成长次数（完成待办时概率升品特征，上限 3） */
  growths: number
}

export interface GameState {
  version: 1
  gsiCounter: number
  seedTick: number
  /** 存档级随机盐，保证不同存档的蛋命运不同 */
  saveSalt: number
  currentEgg: Egg | null
  shed: Egg[]
  todos: Todo[]
  /** 常用模版 */
  templates: TodoTemplate[]
  /** 线索信箱（待审阅的待办建议） */
  inbox: InboxItem[]
  /** 已见过的建议哈希（去重，含已采纳/已忽略），保留最近 500 条 */
  seenSuggestions: string[]
  codex: CreatureRecord[]
  /** 按时连击：连续按时完成的待办数，≥3 时揭露稀有度加成（§05.3） */
  streak: number
  /** 指定驻场生物的档案 id；null = 跟随最新孵化 */
  residentId: string | null
  /** 上次结算到的自然日 */
  lastDay: string
  firstDay: string
}

export type GameEvent =
  | { type: 'reveal'; slot: SlotId; traitId: string; index: number }
  /** gen3 揭露：7 槽之一（value 为花纹/表情/异变 id 或 'none'） */
  | { type: 'freveal'; slot: FelineSlot; value: string; index: number; total: number }
  | { type: 'hatch'; record: CreatureRecord }
  | { type: 'eggArrived'; theme: ThemeId; ftheme?: FelineThemeId }
  | { type: 'autoFail'; todoTitle: string }
  | { type: 'forcedHatch'; record: CreatureRecord }
  | { type: 'noEgg' }
  | { type: 'streakOn'; count: number }
  | { type: 'streakBreak' }
  | { type: 'residentGrow'; record: CreatureRecord; slot: SlotId; fromId: string; toId: string }
  /** gen3 驻场成长：长出（from=null）或升品 */
  | {
      type: 'fgrow'
      record: CreatureRecord
      slot: MutationSlot
      from: AnyMutationId | null
      to: AnyMutationId
      rarityFrom: Rarity
      rarityTo: Rarity
    }
