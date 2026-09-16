import { SLOT_ORDER, type Egg, type GameState, type SlotId } from './types'
import { mulberry32 } from './rng'
import { DEFAULT_TEMPLATES, revealCount } from './engine'
import { MUTATIONS } from '../data/traits'
import { planFeline } from '../qmonster/feline/rules'
import type { FelineThemeId } from '../qmonster/feline/themes'

/** gen2 蛋换轨 gen3 时的主题映射（菌沼 → 林苔） */
const LEGACY_TO_FELINE: Record<GameState['codex'][number]['theme'], FelineThemeId> = {
  deepsea: 'deepsea',
  fungal: 'forest',
  shadow: 'shadow',
}

const KEY = 'gsi-save-v1'
const DEV_OFFSET_KEY = 'gsi-dev-day-offset'

/** 向后兼容：给旧版存档补齐变异字段（v0.2a）、揭露记录与连击（v0.2b） */
function migrate(s: GameState): GameState {
  if (s.streak === undefined) s.streak = 0
  if (s.inbox === undefined) s.inbox = []
  if (s.seenSuggestions === undefined) s.seenSuggestions = []
  if (s.templates === undefined) s.templates = [...DEFAULT_TEMPLATES]
  if (s.residentId === undefined) s.residentId = null
  const fixEgg = (egg: Egg | null) => {
    if (!egg) return
    // 2026-09-16：QMonster v0.3 运行时下线，台上/棚里的 gen2 蛋换成小猫蛋（进度、风险、喂养记录保留）
    if (egg.qseed && !egg.fseed) {
      const ftheme = LEGACY_TO_FELINE[egg.theme]
      const fseed = `f${s.saveSalt.toString(36)}-${egg.id}`
      egg.fseed = fseed
      egg.ftheme = ftheme
      egg.fplan = planFeline(fseed, ftheme, 'normal')
      delete egg.qseed
      delete egg.qidentity
    }
    if (egg.destiny.mutationRoll === undefined) {
      const r = mulberry32(egg.seed ^ 0xbeef)
      egg.destiny.mutationRoll = r()
      egg.destiny.mutationPick = MUTATIONS[Math.floor(r() * MUTATIONS.length)].id
    }
    if (egg.revealed === undefined) {
      // 旧档特征在 destiny 上预掷：已揭露的部分照单全收，未揭露的交给懒掷
      egg.revealed = {}
      const legacy = (egg.destiny as unknown as { traits?: Record<SlotId, string> }).traits
      if (legacy) {
        for (const slot of SLOT_ORDER.slice(0, revealCount(egg.points))) {
          egg.revealed[slot] = legacy[slot]
        }
      }
      delete (egg.destiny as unknown as { traits?: unknown }).traits
    }
  }
  fixEgg(s.currentEgg)
  s.shed?.forEach(fixEgg)
  s.codex?.forEach((c) => {
    if (c.mutation === undefined) c.mutation = null
    if (c.growths === undefined) c.growths = 0
  })
  return s
}

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GameState
    if (parsed.version !== 1) return null
    return migrate(parsed)
  } catch {
    return null
  }
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // 存储失败（隐私模式等）不阻断游玩
  }
}

export function clearState(): void {
  localStorage.removeItem(KEY)
}

export function exportSave(state: GameState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gsi-save-${state.lastDay}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseImport(text: string): GameState | null {
  try {
    const parsed = JSON.parse(text) as GameState
    if (parsed.version !== 1 || typeof parsed.gsiCounter !== 'number') return null
    return migrate(parsed)
  } catch {
    return null
  }
}

/** 开发面板的虚拟时钟偏移（天） */
export function getDevOffset(): number {
  const v = Number(localStorage.getItem(DEV_OFFSET_KEY) ?? '0')
  return Number.isFinite(v) ? v : 0
}

export function setDevOffset(days: number): void {
  localStorage.setItem(DEV_OFFSET_KEY, String(days))
}
