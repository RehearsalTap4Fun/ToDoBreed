import { useCallback, useEffect, useRef, useState } from 'react'
import {
  abandonTodo,
  addTodo,
  completeTodo,
  devFeed,
  initState,
  processTime,
  renameCreature,
  swapEgg,
} from './core/engine'
import { dayStamp } from './core/time'
import {
  clearState,
  exportSave,
  getDevOffset,
  loadState,
  parseImport,
  saveState,
  setDevOffset,
} from './core/storage'
import type { Difficulty, GameEvent, GameState } from './core/types'
import { THEMES } from './data/themes'
import { Workshop } from './ui/Workshop'
import { Codex } from './ui/Codex'
import { EventModals } from './ui/EventModals'
import { DevPanel } from './ui/DevPanel'

function nowDay(): string {
  return dayStamp(new Date(Date.now() + getDevOffset() * 86400000))
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function App() {
  const [state, setState] = useState<GameState | null>(null)
  const [queue, setQueue] = useState<GameEvent[]>([])
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([])
  const [showCodex, setShowCodex] = useState(false)
  const [devOffset, setDevOffsetState] = useState(getDevOffset)
  const toastId = useRef(1)
  const stateRef = useRef<GameState | null>(null)
  const didInit = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dev = new URLSearchParams(location.search).has('dev')

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const pushToast = useCallback((msg: string) => {
    const id = toastId.current++
    setToasts((t) => [...t, { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200)
  }, [])

  const absorb = useCallback(
    (s: GameState, events: GameEvent[]) => {
      saveState(s)
      setState(s)
      const modal: GameEvent[] = []
      for (const e of events) {
        if (e.type === 'reveal' || e.type === 'hatch') modal.push(e)
        else if (e.type === 'eggArrived') pushToast(`一枚${THEMES[e.theme].name}降临了`)
        else if (e.type === 'autoFail')
          pushToast(`「${e.todoTitle}」逾期满 7 天，已判定失败（风险 +12%）`)
        else if (e.type === 'forcedHatch')
          pushToast(`${e.record.name} 在休眠棚里自行破壳了，档案已入册`)
        else if (e.type === 'noEgg') pushToast('孵化台空着——这次完成没有喂到任何蛋')
        else if (e.type === 'streakOn')
          pushToast(`按时连击 ×${e.count}！接下来揭露的稀有度提升（稀有×1.5 / 传说×2）`)
        else if (e.type === 'streakBreak') pushToast('连击中断了……稀有度加成失效')
      }
      if (modal.length > 0) setQueue((q) => [...q, ...modal])
    },
    [pushToast],
  )

  const tick = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const r = processTime(s, nowDay())
    if (r.state !== s) absorb(r.state, r.events)
  }, [absorb])

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    const saved = loadState()
    if (saved) {
      const r = processTime(saved, nowDay())
      absorb(r.state, r.events)
    } else {
      const r = initState(nowDay())
      absorb(r.state, r.events)
    }
    const iv = setInterval(tick, 60_000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!state) return null

  const today = nowDay()
  const dow = WEEKDAYS[new Date(`${today}T12:00:00`).getDay()]

  const actions = {
    addTodo: (input: { title: string; difficulty: Difficulty; due: string | null }) =>
      absorb(addTodo(state, input, today), []),
    complete: (id: string) => {
      const r = completeTodo(state, id, today)
      absorb(r.state, r.events)
    },
    abandon: (id: string) => {
      absorb(abandonTodo(state, id), [])
      pushToast('已放弃一条待办（风险 +6%）')
    },
    swap: (i: number) => absorb(swapEgg(state, i), []),
    rename: (rid: string, nick: string) => absorb(renameCreature(state, rid, nick), []),
  }

  const onImportFile = async (f: File | null) => {
    if (!f) return
    const text = await f.text()
    const parsed = parseImport(text)
    if (!parsed) {
      pushToast('存档文件无效')
      return
    }
    const r = processTime(parsed, today)
    absorb(r.state === parsed ? parsed : r.state, r.state === parsed ? [] : r.events)
    pushToast('存档已导入')
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={(e) => {
          onImportFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />

      <Workshop
        state={state}
        today={today}
        dow={dow}
        devOffset={devOffset}
        actions={actions}
        onOpenCodex={() => setShowCodex(true)}
        onExport={() => exportSave(state)}
        onImportClick={() => fileRef.current?.click()}
      />

      {showCodex && (
        <Codex codex={state.codex} onClose={() => setShowCodex(false)} onRename={actions.rename} />
      )}

      <EventModals event={queue[0] ?? null} onNext={() => setQueue((q) => q.slice(1))} />

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.msg}
          </div>
        ))}
      </div>

      {dev && (
        <DevPanel
          offset={devOffset}
          onFeed={(pts) => {
            const r = devFeed(state, pts, today)
            absorb(r.state, r.events)
          }}
          onShiftDays={(n) => {
            const next = getDevOffset() + n
            setDevOffset(next)
            setDevOffsetState(next)
            tick()
          }}
          onResetOffset={() => {
            setDevOffset(0)
            setDevOffsetState(0)
            tick()
          }}
          onResetSave={() => {
            clearState()
            location.reload()
          }}
        />
      )}
    </>
  )
}
