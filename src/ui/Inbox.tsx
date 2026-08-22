import { useState } from 'react'
import { DIFFICULTY_META, type Difficulty, type InboxItem } from '../core/types'

/** 线索信箱：审阅采集器送来的待办建议——采纳（钉上黑板）或忽略 */
export function Inbox({
  items,
  today,
  onAdopt,
  onDismiss,
  onClose,
}: {
  items: InboxItem[]
  today: string
  onAdopt(hash: string, difficulty: Difficulty, due: string | null): void
  onDismiss(hash: string): void
  onClose(): void
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="inbox-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inbox-head">
          <h3>线索信箱</h3>
          <span className="inbox-sub">
            采集自你的 git 提交与 AI 会话 · 采纳后才会钉上黑板
          </span>
        </div>
        {items.length === 0 ? (
          <div className="inbox-empty">
            信箱空空。在项目目录运行 <code>npm run collect</code> 采集线索，
            或配一个每日定时任务替你跑腿。
          </div>
        ) : (
          <div className="inbox-list">
            {items.map((it) => (
              <InboxRow key={it.hash} item={it} today={today} onAdopt={onAdopt} onDismiss={onDismiss} />
            ))}
          </div>
        )}
        <button className="inbox-close" onClick={onClose}>
          合上信箱
        </button>
      </div>
    </div>
  )
}

function InboxRow({
  item,
  today,
  onAdopt,
  onDismiss,
}: {
  item: InboxItem
  today: string
  onAdopt(hash: string, difficulty: Difficulty, due: string | null): void
  onDismiss(hash: string): void
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>(item.difficulty)
  const [due, setDue] = useState('')
  return (
    <div className="inbox-row">
      <div className="ir-main">
        <div className="ir-title">{item.title}</div>
        <span className="ir-source">{item.source}</span>
      </div>
      <div className="ir-controls">
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
          {(Object.keys(DIFFICULTY_META) as Difficulty[]).map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_META[d].name} +{DIFFICULTY_META[d].points}
            </option>
          ))}
        </select>
        <input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} title="截止日（可选）" />
        <button className="ir-adopt" onClick={() => onAdopt(item.hash, difficulty, due || null)}>
          钉上黑板
        </button>
        <button className="ir-dismiss" onClick={() => onDismiss(item.hash)}>
          忽略
        </button>
      </div>
    </div>
  )
}
