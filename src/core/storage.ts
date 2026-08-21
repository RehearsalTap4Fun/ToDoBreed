import type { GameState } from './types'

const KEY = 'gsi-save-v1'
const DEV_OFFSET_KEY = 'gsi-dev-day-offset'

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GameState
    if (parsed.version !== 1) return null
    return parsed
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
    return parsed
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
