import { useEffect, useMemo, useState } from 'react'
import {
  RARITY_NAMES,
  SLOT_NAMES,
  SLOT_ORDER,
  type CreatureRecord,
  type Egg,
  type GameEvent,
} from '../core/types'
import { ABERRATION_MAP, MUTATION_MAP, TRAIT_MAP } from '../data/traits'
import { THEMES } from '../data/themes'
import { Creature } from '../render/Creature'
import { EggView } from '../render/Egg'

export function EventModals({ event, onNext }: { event: GameEvent | null; onNext: () => void }) {
  if (!event) return null
  if (event.type === 'reveal') {
    const t = TRAIT_MAP[event.traitId]
    return (
      <div className="overlay" role="dialog" aria-modal="true">
        <div className="modal-card">
          <div className="eyebrow">特征揭露 · {SLOT_NAMES[event.slot]}</div>
          <h3>{t.name}</h3>
          <span className={`rarity-chip rarity-${t.rarity}`}>{RARITY_NAMES[t.rarity]}</span>
          <p className="flavor">{t.flavor}</p>
          <button className="primary" onClick={onNext} autoFocus>
            收下
          </button>
          <div className="reveal-count">第 {event.index + 1} / 8 项特征</div>
        </div>
      </div>
    )
  }
  if (event.type === 'hatch') {
    return <HatchCard record={event.record} onNext={onNext} />
  }
  if (event.type === 'residentGrow') {
    const from = TRAIT_MAP[event.fromId]
    const to = TRAIT_MAP[event.toId]
    const rec = event.record
    return (
      <div className="overlay" role="dialog" aria-modal="true">
        <div className="modal-card">
          <div className="eyebrow">驻场成长 · {SLOT_NAMES[event.slot]}</div>
          <Creature
            traits={rec.traits}
            theme={rec.theme}
            aberrations={rec.aberrations}
            mutation={rec.mutation}
            seed={rec.seed}
            size={150}
          />
          <h3>{to.name}</h3>
          <span className={`rarity-chip rarity-${to.rarity}`}>{RARITY_NAMES[to.rarity]}</span>
          <p className="flavor">
            {rec.nickname ?? rec.name} 看着你把事情做完，忽然开窍了——
            {SLOT_NAMES[event.slot]}由「{from.name}」长成了「{to.name}」。
            <br />
            {to.flavor}
          </p>
          <button className="primary" onClick={onNext} autoFocus>
            好耶
          </button>
          <div className="reveal-count">成长 {rec.growths} / 3</div>
        </div>
      </div>
    )
  }
  return null
}

function HatchCard({ record, onNext }: { record: CreatureRecord; onNext: () => void }) {
  const aberrant = record.outcome === 'aberrant'
  const hardFed = record.fedTodos.filter((t) => t.difficulty === 'hard' || t.difficulty === 'epic').length

  // 破壳演出（§08）：蓄力抖动 → 白光迸发 → 生物登场；可点击跳过，尊重减动效偏好
  const reduced = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    [],
  )
  const [stage, setStage] = useState<'charge' | 'flash' | 'reveal'>(reduced ? 'reveal' : 'charge')
  useEffect(() => {
    if (stage === 'charge') {
      const t = setTimeout(() => setStage('flash'), 1700)
      return () => clearTimeout(t)
    }
    if (stage === 'flash') {
      const t = setTimeout(() => setStage('reveal'), 480)
      return () => clearTimeout(t)
    }
  }, [stage])

  if (stage !== 'reveal') {
    const displayEgg = {
      theme: record.theme,
      points: 100,
      risk: record.riskAtHatch,
    } as unknown as Egg
    return (
      <div
        className="overlay hatch-stage"
        role="dialog"
        aria-modal="true"
        onClick={() => setStage('reveal')}
      >
        <div className={stage === 'charge' ? 'hatch-egg-charging' : undefined}>
          <EggView egg={displayEgg} size={250} />
        </div>
        {stage === 'flash' && <div className="hatch-flash" />}
        <p className="hatch-hint">破壳中……（点击跳过）</p>
      </div>
    )
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal-card hatch-card">
        <div className="eyebrow">
          破壳 · {THEMES[record.theme].name} · {record.id}
        </div>
        <Creature
          traits={record.traits}
          theme={record.theme}
          aberrations={record.aberrations}
          mutation={record.mutation}
          seed={record.seed}
          size={200}
        />
        <h3>{record.name}</h3>
        <p className="outcome">
          {aberrant ? (
            <span className="oc-ab">畸变孵化 · 判定 {record.riskAtHatch}% 风险命中</span>
          ) : (
            <span className="oc-normal">正常孵化 · 安然越过 {record.riskAtHatch}% 风险</span>
          )}
        </p>
        {aberrant && (
          <div className="ab-note">
            它破壳时有点不知所措——工作间的灯为它调暗了一档。
            <br />
            畸变：
            {record.aberrations
              .map((a) => `${ABERRATION_MAP[a.ab].name}（${SLOT_NAMES[a.slot]}）`)
              .join('、')}
          </div>
        )}
        {record.mutation && (
          <div className="mut-note">
            ✦ 变异降临：{MUTATION_MAP[record.mutation].name}——{MUTATION_MAP[record.mutation].desc}
          </div>
        )}
        <div className="hatch-traits">
          {SLOT_ORDER.map((slot) => {
            const t = TRAIT_MAP[record.traits[slot]]
            return (
              <span key={slot} className={t.rarity === 'L' ? 'hl' : t.rarity === 'R' ? 'hr' : ''}>
                {t.name}
              </span>
            )
          })}
        </div>
        <div className="hatch-fed">
          这只生物由 {record.fedTodos.length} 条待办喂大
          {hardFed > 0 && `，其中 ${hardFed} 条是硬仗`}。
        </div>
        <button className="primary" onClick={onNext} autoFocus style={{ marginTop: '0.8rem' }}>
          记入图鉴
        </button>
      </div>
    </div>
  )
}
