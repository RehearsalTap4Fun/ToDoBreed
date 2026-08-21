import { useState } from 'react'
import { daysBetween } from '../core/time'
import { DIFFICULTY_META, type Difficulty, type Todo } from '../core/types'
import type { Actions } from './Workshop'

export function TodoBoard({
  todos,
  today,
  actions,
  hasEgg,
}: {
  todos: Todo[]
  today: string
  actions: Actions
  hasEgg: boolean
}) {
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [due, setDue] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  const open = todos
    .filter((t) => t.state === 'open')
    .sort((a, b) => {
      const oa = a.due ? daysBetween(a.due, today) : -999
      const ob = b.due ? daysBetween(b.due, today) : -999
      if (oa !== ob) return ob - oa // 逾期最久的排最前
      return (a.due ?? '9999').localeCompare(b.due ?? '9999')
    })
  const closed = todos
    .filter((t) => t.state !== 'open')
    .sort((a, b) => (b.doneDay ?? b.createdDay).localeCompare(a.doneDay ?? a.createdDay))
    .slice(0, 12)

  const submit = () => {
    const v = title.trim()
    if (!v) return
    actions.addTodo({ title: v, difficulty, due: due || null })
    setTitle('')
    setDue('')
  }

  return (
    <div className="todo-board">
      <div className="todo-form">
        <input
          type="text"
          placeholder="要做什么？（真实的事）"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <div className="row">
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            {(Object.keys(DIFFICULTY_META) as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_META[d].name} +{DIFFICULTY_META[d].points}（{DIFFICULTY_META[d].hint}）
              </option>
            ))}
          </select>
          <input
            type="date"
            value={due}
            min={today}
            onChange={(e) => setDue(e.target.value)}
            title="截止日（可选）"
          />
        </div>
        <button onClick={submit}>钉上待办板</button>
      </div>

      {!hasEgg && open.length > 0 && (
        <div className="todo-empty">⚠ 孵化台空着，现在完成待办不会喂到任何蛋</div>
      )}

      <div className="todo-list">
        {open.length === 0 && (
          <div className="todo-empty">板上空空如也。把真实要做的事钉上来，喂给台上的蛋。</div>
        )}
        {open.map((t) => {
          const overdue = t.due ? daysBetween(t.due, today) : 0
          return (
            <div key={t.id} className={`todo-note${overdue > 0 ? ' overdue' : ''}`}>
              <div className="t-title">{t.title}</div>
              <div className="t-meta">
                <span className={`diff-tag diff-${t.difficulty}`}>
                  {DIFFICULTY_META[t.difficulty].name} +{DIFFICULTY_META[t.difficulty].points}
                </span>
                {t.due && overdue <= 0 && <span>截止 {t.due}</span>}
                {overdue > 0 && <span className="t-overdue-badge">逾期 {overdue} 天</span>}
              </div>
              <div className="t-actions">
                <button className="btn-done" onClick={() => actions.complete(t.id)}>
                  ✓ 完成
                </button>
                {confirming === t.id ? (
                  <button
                    className="btn-drop confirming"
                    onClick={() => {
                      actions.abandon(t.id)
                      setConfirming(null)
                    }}
                    onBlur={() => setConfirming(null)}
                  >
                    确认放弃？风险 +6%
                  </button>
                ) : (
                  <button className="btn-drop" onClick={() => setConfirming(t.id)}>
                    放弃
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {closed.length > 0 && (
        <details className="todo-done-fold">
          <summary>最近结束的 {closed.length} 条</summary>
          <ul>
            {closed.map((t) => (
              <li key={t.id}>
                <span className={t.state === 'done' ? 'st-done' : 'st-bad'}>
                  {t.state === 'done' ? '✓' : t.state === 'failed' ? '✕ 失败' : '— 放弃'}
                </span>{' '}
                {t.title}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
