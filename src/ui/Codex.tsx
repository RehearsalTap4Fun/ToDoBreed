import { useState } from 'react'
import { SLOT_ORDER, type CreatureRecord, type ThemeId } from '../core/types'
import { ABERRATION_MAP, TRAIT_MAP, TRAITS } from '../data/traits'
import { THEMES, THEME_IDS } from '../data/themes'
import { Creature } from '../render/Creature'

type Tab = 'all' | ThemeId | 'aberrant'

export function Codex({
  codex,
  onClose,
  onRename,
}: {
  codex: CreatureRecord[]
  onClose: () => void
  onRename: (rid: string, nick: string) => void
}) {
  const [tab, setTab] = useState<Tab>('all')

  const seenTraits = new Set(codex.flatMap((r) => Object.values(r.traits)))
  const aberrantCount = codex.filter((r) => r.outcome === 'aberrant').length

  const shown = codex
    .filter((r) => {
      if (tab === 'all') return true
      if (tab === 'aberrant') return r.outcome === 'aberrant'
      return r.theme === tab
    })
    .slice()
    .reverse()

  return (
    <div className="codex-overlay">
      <div className="codex">
        <div className="codex-head">
          <h2>怪奇图鉴</h2>
          <div className="codex-stats">
            <span>
              入册 <b>{codex.length}</b>
            </span>
            <span>
              特征收集 <b>{seenTraits.size}</b>/{TRAITS.length}
            </span>
            <span>
              标本室 <b>{aberrantCount}</b>
            </span>
          </div>
          <span style={{ flex: 1 }} />
          <button className="tbtn" onClick={onClose}>
            合上图鉴
          </button>
        </div>

        <div className="codex-tabs">
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>
            全部
          </button>
          {THEME_IDS.map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {THEMES[t].name} · {codex.filter((r) => r.theme === t).length}
            </button>
          ))}
          <button className={tab === 'aberrant' ? 'on' : ''} onClick={() => setTab('aberrant')}>
            标本室 · {aberrantCount}
          </button>
        </div>

        {shown.length === 0 ? (
          <div className="codex-empty">
            {tab === 'aberrant'
              ? '标本室还空着——愿它一直空着，或者别。'
              : '这一册还没有记录。完成待办，孵出第一只。'}
          </div>
        ) : (
          <div className="codex-grid">
            {shown.map((r) => (
              <CreatureCard key={r.id} record={r} onRename={onRename} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CreatureCard({
  record: r,
  onRename,
}: {
  record: CreatureRecord
  onRename: (rid: string, nick: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [nick, setNick] = useState(r.nickname ?? '')
  const hardFed = r.fedTodos.filter((t) => t.difficulty === 'hard' || t.difficulty === 'epic').length

  return (
    <div className={`creature-card${r.outcome === 'aberrant' ? ' aberrant' : ''}`}>
      <span className="cc-id">{r.id}</span>
      <div className="cc-fig">
        <Creature
          traits={r.traits}
          theme={r.theme}
          aberrations={r.aberrations}
          seed={r.seed}
          size={150}
          idle={false}
        />
      </div>
      <h4>
        {r.nickname ?? r.name}
        {r.nickname && <small style={{ fontWeight: 400, fontSize: '0.7em' }}>（{r.name}）</small>}
      </h4>
      <div className="cc-sub">
        <span>{THEMES[r.theme].name}</span>
        <span>{r.hatchedDay}</span>
        <span className={`oc-pill ${r.outcome === 'aberrant' ? 'ab' : 'ok'}`}>
          {r.outcome === 'aberrant' ? '畸变' : '正常'}
        </span>
        {r.forced && <span className="oc-pill ab">自行破壳</span>}
        {!editing ? (
          <button className="cc-edit" onClick={() => setEditing(true)} title="起昵称">
            ✎
          </button>
        ) : null}
      </div>
      {editing && (
        <div className="cc-rename">
          <input
            value={nick}
            maxLength={12}
            placeholder="起个昵称"
            onChange={(e) => setNick(e.target.value)}
            autoFocus
          />
          <button
            onClick={() => {
              onRename(r.id, nick)
              setEditing(false)
            }}
          >
            保存
          </button>
        </div>
      )}
      <div className="cc-traits">
        {SLOT_ORDER.map((slot) => {
          const t = TRAIT_MAP[r.traits[slot]]
          const ab = r.aberrations.find((a) => a.slot === slot)
          return (
            <span key={slot} className={ab ? 'abt' : t.rarity === 'R' ? 'hr' : ''}>
              {t.name}
              {ab ? `·${ABERRATION_MAP[ab.ab].name}` : ''}
            </span>
          )
        })}
      </div>
      <div className="cc-fed">
        由 {r.fedTodos.length} 条待办喂大{hardFed > 0 && `，其中 ${hardFed} 条是硬仗`}。
        {r.fedTodos.length > 0 && (
          <>
            <br />
            {r.fedTodos
              .slice(0, 3)
              .map((t) => `「${t.title}」`)
              .join(' ')}
            {r.fedTodos.length > 3 && ' ……'}
          </>
        )}
      </div>
    </div>
  )
}
