import { useCallback, useEffect, useRef, useState } from 'react'
import {
  abandonTodo,
  addTemplate,
  addTodo,
  adoptInbox,
  applyTemplate,
  completeTodo,
  devFeed,
  dismissInbox,
  importSuggestions,
  inferDueRule,
  initState,
  processTime,
  removeTemplate,
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
import { Inbox } from './ui/Inbox'
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
  const [showInbox, setShowInbox] = useState(false)
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

  // 线索信箱：拉取采集器产出的建议文件（public/gsi-inbox.json），哈希去重后入箱
  useEffect(() => {
    const pull = async () => {
      try {
        const res = await fetch('/gsi-inbox.json', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const items = Array.isArray(data?.items) ? data.items : []
        if (items.length === 0) return
        const cur = stateRef.current
        if (!cur) return
        const r = importSuggestions(cur, items)
        if (r.added > 0) {
          saveState(r.state)
          setState(r.state)
          pushToast(`信箱收到 ${r.added} 条新线索`)
        }
      } catch {
        // 无采集文件或离线，静默
      }
    }
    const first = setTimeout(pull, 2500)
    const iv = setInterval(pull, 300_000)
    return () => {
      clearTimeout(first)
      clearInterval(iv)
    }
  }, [pushToast])

  if (!state) return null

  const today = nowDay()
  const dow = WEEKDAYS[new Date(`${today}T12:00:00`).getDay()]

  const actions = {
    addTodo: (
      input: { title: string; difficulty: Difficulty; due: string | null },
      saveAsTemplate?: boolean,
    ) => {
      let s = addTodo(state, input, today)
      if (saveAsTemplate) {
        s = addTemplate(s, {
          title: input.title,
          difficulty: input.difficulty,
          dueRule: inferDueRule(input.due, today),
        })
        pushToast('已钉上黑板，并存为常用模版')
      }
      absorb(s, [])
    },
    applyTemplate: (id: string) => {
      const tpl = state.templates.find((t) => t.id === id)
      absorb(applyTemplate(state, id, today), [])
      if (tpl) pushToast(`「${tpl.title}」已钉上黑板`)
    },
    removeTemplate: (id: string) => absorb(removeTemplate(state, id), []),
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

  const inboxHandlers = {
    adopt: (hash: string, difficulty: Difficulty, due: string | null) => {
      absorb(adoptInbox(state, hash, difficulty, due, today), [])
      pushToast('已钉上黑板')
    },
    dismiss: (hash: string) => absorb(dismissInbox(state, hash), []),
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
        onOpenInbox={() => setShowInbox(true)}
        onExport={() => exportSave(state)}
        onImportClick={() => fileRef.current?.click()}
      />

      {showCodex && (
        <Codex codex={state.codex} onClose={() => setShowCodex(false)} onRename={actions.rename} />
      )}

      {showInbox && (
        <Inbox
          items={state.inbox}
          today={today}
          onAdopt={inboxHandlers.adopt}
          onDismiss={inboxHandlers.dismiss}
          onClose={() => setShowInbox(false)}
        />
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
