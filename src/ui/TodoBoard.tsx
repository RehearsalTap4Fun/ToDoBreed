import { useState } from 'react'
import { daysBetween } from '../core/time'
import { DIFFICULTY_META, type Difficulty, type Todo } from '../core/types'
import type { Actions } from './Workshop'

/** 黑板：便签纸列表 + 粉笔连击 + 空白便签（写新待办） */
export function TodoBoard({
  todos,
  today,
  actions,
  hasEgg,
  streak,
}: {
  todos: Todo[]
  today: string
  actions: Actions
  hasEgg: boolean
  streak: number
}) {
  const [showForm, setShowForm] = useState(false)
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

  return (
    <>
      <div className="todo-board">
        <div className="chalk-head">
          待办 · {open.length} 条
          {streak > 0 && (
            <span className={`chalk-streak${streak >= 3 ? ' on' : ''}`}>
              　连击×{streak}
              {streak >= 3 ? ' ✦稀有度加成' : ''}
            </span>
          )}
        </div>

        <button className="note-stack" onClick={() => setShowForm(true)} title="写一张新便签">
          ＋
        </button>

        {!hasEgg && open.length > 0 && (
          <div className="todo-empty">⚠ 孵化舱空着，现在完成不会喂到蛋</div>
        )}

        <div className="todo-list">
          {open.length === 0 && (
            <div className="todo-empty">板上空空如也。点右上角的空白便签，把真实要做的事钉上来。</div>
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
        <div className="board-ledge" />
      </div>

      {showForm && (
        <NoteForm
          today={today}
          onAdd={(input) => {
            actions.addTodo(input)
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  )
}

/** 写便签：一张放大的便签纸 */
function NoteForm({
  today,
  onAdd,
  onClose,
}: {
  today: string
  onAdd(input: { title: string; difficulty: Difficulty; due: string | null }): void
  onClose(): void
}) {
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [due, setDue] = useState('')

  const submit = () => {
    const v = title.trim()
    if (!v) return
    onAdd({ title: v, difficulty, due: due || null })
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="note-modal" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          placeholder="要做什么？（真实的事）"
          value={title}
          maxLength={60}
          autoFocus
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
        <div className="note-actions">
          <button className="pin-btn" onClick={submit}>
            钉上黑板
          </button>
          <button className="cancel-btn" onClick={onClose}>
            算了
          </button>
        </div>
      </div>
    </div>
  )
}
