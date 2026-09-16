import { useState } from 'react'
import { GROW } from '../core/engine'
import { Q_SLOT_NAMES, Q_SLOT_ORDER, SLOT_ORDER, type CreatureRecord } from '../core/types'
import { ABERRATION_MAP, MUTATION_MAP, TRAIT_MAP, TRAITS } from '../data/traits'
import { Creature } from '../render/Creature'
import { QCreatureImg } from './QCreatureImg'
import { Q_TRAIT_TOTAL, qTraitDisplay } from '../qmonster/semantics'
import {
  COAT_NAMES,
  EXPRESSION_NAMES,
  FELINE_THEMES,
  themeDisplayName,
  type FelineThemeId,
} from '../qmonster/feline/themes'
import { MUTATION_DEFS, MUTATION_MAP as F_MUTATION_MAP, TIER_NAMES } from '../qmonster/feline/mutations'
import { COATS } from '../qmonster/feline/sdk'

type Tab = 'all' | FelineThemeId | 'legacy' | 'aberrant'

export function Codex({
  codex,
  residentId,
  onClose,
  onRename,
  onSetResident,
}: {
  codex: CreatureRecord[]
  residentId: string | null
  onClose: () => void
  onRename: (rid: string, nick: string) => void
  onSetResident: (rid: string | null) => void
}) {
  const [tab, setTab] = useState<Tab>('all')

  const seenTraits = new Set(codex.flatMap((r) => (r.traits ? Object.values(r.traits) : [])))
  const seenQTraits = new Set(
    codex.flatMap((r) => (r.qsemantic ? Object.values(r.qsemantic) : [])).filter(Boolean),
  )
  const felines = codex.filter((r) => r.kind === 'feline' && r.fplan)
  const seenCoats = new Set(felines.map((r) => r.fplan!.selections.coat))
  const seenMutations = new Set(felines.flatMap((r) => r.fplan!.mutations))
  const legacyCount = codex.filter((r) => r.kind !== 'feline').length
  const aberrantCount = codex.filter((r) => r.outcome === 'aberrant').length
  const mutatedCount = codex.filter((r) => r.mutation || r.qmode === 'mutation' || r.fmode === 'mutation').length
  const legendCount = felines.filter((r) => r.outcome !== 'aberrant' && r.fplan!.rarity === 'L').length
  const maxedCount = codex.filter((r) => r.growths >= GROW.cap).length

  const shown = codex
    .filter((r) => {
      if (tab === 'all') return true
      if (tab === 'aberrant') return r.outcome === 'aberrant'
      if (tab === 'legacy') return r.kind !== 'feline'
      return r.ftheme === tab
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
              花纹 <b>{seenCoats.size}</b>/{COATS.length}
            </span>
            <span>
              异变 <b>{seenMutations.size}</b>/{MUTATION_DEFS.length}
            </span>
            <span>
              传说 <b>{legendCount}</b>
            </span>
            <span>
              变异 <b>{mutatedCount}</b>
            </span>
            {legacyCount > 0 && (
              <>
                <span>
                  古典特征 <b>{seenTraits.size}</b>/{TRAITS.length}
                </span>
                <span>
                  语义特征 <b>{seenQTraits.size}</b>/{Q_TRAIT_TOTAL}
                </span>
                <span>
                  圆满 <b>{maxedCount}</b>
                </span>
              </>
            )}
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
          {FELINE_THEMES.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.name} · {codex.filter((r) => r.ftheme === t.id).length}
            </button>
          ))}
          {legacyCount > 0 && (
            <button className={tab === 'legacy' ? 'on' : ''} onClick={() => setTab('legacy')}>
              旧谱系 · {legacyCount}
            </button>
          )}
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
              <CreatureCard
                key={r.id}
                record={r}
                isResident={residentId === r.id}
                onRename={onRename}
                onSetResident={onSetResident}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CreatureCard({
  record: r,
  isResident,
  onRename,
  onSetResident,
}: {
  record: CreatureRecord
  isResident: boolean
  onRename: (rid: string, nick: string) => void
  onSetResident: (rid: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [nick, setNick] = useState(r.nickname ?? '')
  const hardFed = r.fedTodos.filter((t) => t.difficulty === 'hard' || t.difficulty === 'epic').length
  const bitmap = r.kind === 'qmonster' || r.kind === 'feline'
  const mutated = r.mutation !== null || r.qmode === 'mutation' || r.fmode === 'mutation'

  return (
    <div className={`creature-card${r.outcome === 'aberrant' ? ' aberrant' : ''}`}>
      <span className="cc-id">{r.id}</span>
      <div className="cc-fig">
        {bitmap ? (
          <QCreatureImg record={r} size={150} />
        ) : (
          <Creature
            traits={r.traits!}
            theme={r.theme}
            aberrations={r.aberrations}
            mutation={r.mutation}
            seed={r.seed}
            size={150}
            idle={false}
          />
        )}
      </div>
      <h4>
        {r.nickname ?? r.name}
        {r.nickname && <small style={{ fontWeight: 400, fontSize: '0.7em' }}>（{r.name}）</small>}
      </h4>
      <div className="cc-sub">
        <span>{themeDisplayName(r)}</span>
        <span>{r.hatchedDay}</span>
        {r.kind === 'feline' && r.fplan && r.outcome !== 'aberrant' ? (
          <span className={`oc-pill rar-${r.fplan.rarity}`}>{TIER_NAMES[r.fplan.rarity]}</span>
        ) : (
          <span className={`oc-pill ${r.outcome === 'aberrant' ? 'ab' : 'ok'}`}>
            {r.outcome === 'aberrant' ? '畸变' : '正常'}
          </span>
        )}
        {r.mutation && <span className="oc-pill mut">✦ {MUTATION_MAP[r.mutation].name}</span>}
        {!r.mutation && mutated && <span className="oc-pill mut">✦ 变异</span>}
        {r.growths >= GROW.cap ? (
          <span className="oc-pill grown" title={`成长已圆满（${GROW.cap}/${GROW.cap}），驻场不会再升品——换一只小家伙上岗吧`}>
            ✧ 圆满
          </span>
        ) : r.growths > 0 ? (
          <span className="oc-pill grow" title={`驻场期间完成待办触发的特征升品，还可成长 ${GROW.cap - r.growths} 次`}>
            ↑成长 {r.growths}/{GROW.cap}
          </span>
        ) : null}
        {r.forced && <span className="oc-pill ab">自行破壳</span>}
        {isResident ? (
          <button
            className="oc-pill res on"
            title="取消指定，恢复跟随最新孵化"
            onClick={() => onSetResident(null)}
          >
            ★ 驻场中
          </button>
        ) : (
          <button className="oc-pill res" title="让它到工作间驻场" onClick={() => onSetResident(r.id)}>
            驻场
          </button>
        )}
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
        {r.kind === 'feline' && r.fplan ? (
          <>
            <span>{COAT_NAMES[r.fplan.selections.coat]}</span>
            <span>{EXPRESSION_NAMES[r.fplan.selections.expression]}</span>
            {r.fplan.mutations.map((m) => {
              const def = F_MUTATION_MAP[m]
              return (
                <span key={m} className={def.tier === 'L' ? 'hl' : def.tier === 'R' ? 'hr' : ''}>
                  {def.name}
                </span>
              )
            })}
            {r.fplan.mutations.length === 0 && <span>无异变</span>}
          </>
        ) : r.kind === 'qmonster' ? (
          Q_SLOT_ORDER.map((slot) => {
            const info = qTraitDisplay(r, slot)
            return (
              <span key={slot} className={info?.rarity === 'L' ? 'hl' : info?.rarity === 'R' ? 'hr' : ''}>
                {info?.name ?? Q_SLOT_NAMES[slot]}
              </span>
            )
          })
        ) : (
          SLOT_ORDER.map((slot) => {
            const t = TRAIT_MAP[r.traits![slot]]
            const ab = r.aberrations.find((a) => a.slot === slot)
            return (
              <span key={slot} className={ab ? 'abt' : t.rarity === 'L' ? 'hl' : t.rarity === 'R' ? 'hr' : ''}>
                {t.name}
                {ab ? `·${ABERRATION_MAP[ab.ab].name}` : ''}
              </span>
            )
          })
        )}
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
