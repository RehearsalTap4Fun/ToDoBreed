import { useCallback, useEffect, useRef, useState } from 'react'
import {
  abandonTodo,
  addTemplate,
  setEggIdentity,
  setRecordFelineVisual,
  setRecordSpec,
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
  setResident,
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
import { qmonsterAvailable } from './qmonster/catalog'
import { resolveEggIdentity, resolveRecord } from './qmonster/orchestrator'
import { felineAvailable } from './qmonster/feline/sdk'
import { ensureOfflineRuntime } from './qmonster/feline/offline'
import { resolveFelineRecord } from './qmonster/feline/orchestrator'
import { FELINE_THEME_MAP } from './qmonster/feline/themes'
import { Workshop } from './ui/Workshop'
import { Codex } from './ui/Codex'
import { Inbox, type InboxFeed } from './ui/Inbox'
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
  const [feed, setFeed] = useState<InboxFeed>({ status: 'unknown', generatedAt: null })
  const toastId = useRef(1)
  const stateRef = useRef<GameState | null>(null)
  const didInit = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dev = new URLSearchParams(location.search).has('dev')

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // 同源多标签防互踩：别的标签页写了存档，本页立即以之为准（storage 事件不会由本页写入触发）
  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== 'gsi-save-v1' || ev.newValue === null) return
      const s = loadState()
      if (s) {
        stateRef.current = s
        setState(s)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const pushToast = useCallback((msg: string) => {
    const id = toastId.current++
    setToasts((t) => [...t, { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200)
  }, [])

  const absorb = useCallback(
    (s: GameState, events: GameEvent[]) => {
      stateRef.current = s
      saveState(s)
      setState(s)
      const modal: GameEvent[] = []
      for (const e of events) {
        if (e.type === 'reveal' || e.type === 'freveal' || e.type === 'hatch' || e.type === 'residentGrow')
          modal.push(e)
        else if (e.type === 'eggArrived')
          pushToast(`一枚${e.ftheme ? FELINE_THEME_MAP[e.ftheme].eggName : THEMES[e.theme].name}降临了`)
        else if (e.type === 'autoFail')
          pushToast(`「${e.todoTitle}」逾期满 7 天，已判定失败（风险 +12%）`)
        else if (e.type === 'forcedHatch')
          pushToast(`${e.record.name} 在休眠棚里自行破壳了，档案已入册`)
        else if (e.type === 'noEgg') pushToast('孵化台空着——这次完成没有喂到任何蛋')
        else if (e.type === 'streakOn')
          pushToast(`按时连击 ×${e.count}！孵化变异率 +2%（旧蛋另享揭露稀有度加成）`)
        else if (e.type === 'streakBreak') pushToast('连击中断了……加成失效')
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

  // file://（或 ?offline=1）形态：拉起旁置素材通道；就绪后触发一次编排扫描
  const [felineReady, setFelineReady] = useState(false)
  useEffect(() => {
    ensureOfflineRuntime().then(setFelineReady)
  }, [])

  // gen2/gen3 编排：扫描未解析的蛋身份 / 待渲染档案，异步解析后回写存档
  const inflight = useRef(new Set<string>())
  useEffect(() => {
    if (!state) return
    if (felineAvailable()) {
      for (const rec of state.codex) {
        if (rec.kind !== 'feline' || rec.fstatus !== 'pending') continue
        const key = `frec:${rec.id}`
        if (inflight.current.has(key)) continue
        inflight.current.add(key)
        resolveFelineRecord(rec)
          .then((patch) => {
            const cur = stateRef.current
            if (cur) absorb(setRecordFelineVisual(cur, rec.id, patch), [])
          })
          .catch((e) => console.warn('[gen3] 小猫形象合成失败', e))
          .finally(() => inflight.current.delete(key))
      }
    }
    if (!qmonsterAvailable()) return
    const eggs = [state.currentEgg, ...state.shed].filter(
      (e): e is NonNullable<typeof e> => !!e && !!e.qseed && !e.qidentity,
    )
    for (const egg of eggs) {
      const key = `egg:${egg.id}`
      if (inflight.current.has(key)) continue
      inflight.current.add(key)
      resolveEggIdentity(egg)
        .then((identity) => {
          const cur = stateRef.current
          if (cur) absorb(setEggIdentity(cur, egg.id, identity), [])
        })
        .catch((e) => console.warn('[gen2] 蛋身份解析失败', e))
        .finally(() => inflight.current.delete(key))
    }
    for (const rec of state.codex) {
      if (rec.kind !== 'qmonster' || rec.qstatus !== 'pending') continue
      const key = `rec:${rec.id}`
      if (inflight.current.has(key)) continue
      inflight.current.add(key)
      resolveRecord(rec)
        .then((patch) => {
          const cur = stateRef.current
          if (cur) absorb(setRecordSpec(cur, rec.id, patch), [])
        })
        .catch((e) => console.warn('[gen2] 档案解析失败', e))
        .finally(() => inflight.current.delete(key))
    }
  }, [state, absorb, felineReady])

  // 线索信箱：拉取采集器产出的建议。http 下 fetch gsi-inbox.json；
  // file://（纯单机单文件形态）下 fetch 被浏览器禁用，改为注入 gsi-inbox.js 读全局变量。
  // feed 记录采集产出是否存在——不存在时信箱显示配置引导（AI agent 提示词）。
  useEffect(() => {
    type Payload = { items?: unknown[]; generatedAt?: string }
    const loadViaScript = (): Promise<Payload | null> =>
      new Promise((resolve) => {
        const w = window as unknown as { __GSI_INBOX__?: Payload }
        if (w.__GSI_INBOX__) {
          resolve(w.__GSI_INBOX__)
          return
        }
        const el = document.createElement('script')
        el.src = 'gsi-inbox.js'
        el.onload = () => resolve(w.__GSI_INBOX__ ?? null)
        el.onerror = () => {
          el.remove()
          resolve(null)
        }
        document.head.appendChild(el)
      })

    const pull = async () => {
      let payload: Payload | null = null
      if (location.protocol === 'file:') {
        payload = await loadViaScript()
      } else {
        try {
          const res = await fetch('/gsi-inbox.json', { cache: 'no-store' })
          if (res.ok) payload = (await res.json()) as Payload
        } catch {
          payload = null
        }
      }
      if (!payload) {
        setFeed({ status: 'missing', generatedAt: null })
        return
      }
      setFeed({ status: 'ok', generatedAt: payload.generatedAt ?? null })
      const items = Array.isArray(payload.items) ? payload.items : []
      if (items.length === 0) return
      const cur = stateRef.current
      if (!cur) return
      const r = importSuggestions(cur, items as Parameters<typeof importSuggestions>[1])
      if (r.added > 0) {
        saveState(r.state)
        setState(r.state)
        pushToast(`信箱收到 ${r.added} 条新线索`)
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
    setResident: (rid: string | null) => absorb(setResident(state, rid), []),
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
        <Codex
          codex={state.codex}
          residentId={state.residentId}
          onClose={() => setShowCodex(false)}
          onRename={actions.rename}
          onSetResident={actions.setResident}
        />
      )}

      {showInbox && (
        <Inbox
          items={state.inbox}
          feed={feed}
          today={today}
          onAdopt={inboxHandlers.adopt}
          onDismiss={inboxHandlers.dismiss}
          onClose={() => setShowInbox(false)}
        />
      )}

      <EventModals
        event={queue[0] ?? null}
        liveRecord={(id) => state.codex.find((c) => c.id === id)}
        onNext={() => setQueue((q) => q.slice(1))}
      />

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
