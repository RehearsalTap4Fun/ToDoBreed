import type { Egg, GameState } from './types'
import { mulberry32 } from './rng'
import { MUTATIONS } from '../data/traits'

const KEY = 'gsi-save-v1'
const DEV_OFFSET_KEY = 'gsi-dev-day-offset'

/** 向后兼容：给 v0.2 之前的存档补齐变异字段（种子派生，保持确定性） */
function migrate(s: GameState): GameState {
  const fixEgg = (egg: Egg | null) => {
    if (!egg || egg.destiny.mutationRoll !== undefined) return
    const r = mulberry32(egg.seed ^ 0xbeef)
    egg.destiny.mutationRoll = r()
    egg.destiny.mutationPick = MUTATIONS[Math.floor(r() * MUTATIONS.length)].id
  }
  fixEgg(s.currentEgg)
  s.shed?.forEach(fixEgg)
  s.codex?.forEach((c) => {
    if (c.mutation === undefined) c.mutation = null
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
