import { useEffect, useMemo, useState } from 'react'
import {
  Q_SLOT_NAMES,
  Q_SLOT_ORDER,
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
import { QCreatureImg } from './QCreatureImg'
import { useTraitIndex } from '../qmonster/semantics'

export function EventModals({
  event,
  liveRecord,
  onNext,
}: {
  event: GameEvent | null
  liveRecord: (id: string) => CreatureRecord | undefined
  onNext: () => void
}) {
  if (!event) return null
  if (event.type === 'reveal') {
    if (event.qtraitId !== undefined) {
      return <QRevealCard qtraitId={event.qtraitId} index={event.index} onNext={onNext} />
    }
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
    const record = liveRecord(event.record.id) ?? event.record
    return record.kind === 'qmonster' ? (
      <QHatchCard record={record} onNext={onNext} />
    ) : (
      <HatchCard record={record} onNext={onNext} />
    )
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
            traits={rec.traits!}
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
          traits={record.traits!}
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
            const t = TRAIT_MAP[record.traits![slot]]
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


/** gen2 揭露卡：语义特征信息来自 QMonster 目录 */
function QRevealCard({
  qtraitId,
  index,
  onNext,
}: {
  qtraitId: string
  index: number
  onNext: () => void
}) {
  const traitIndex = useTraitIndex()
  const info = qtraitId ? traitIndex?.get(qtraitId) : undefined
  const slotName = Q_SLOT_NAMES[Q_SLOT_ORDER[index]]
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="eyebrow">特征揭露 · {slotName}</div>
        <h3>{info?.displayName ?? '尚在凝聚'}</h3>
        {info && (
          <span className={`rarity-chip rarity-${info.rarity}`}>{RARITY_NAMES[info.rarity]}</span>
        )}
        <p className="flavor">
          {info?.flavorText ?? '这个部位的轮廓还藏在蛋壳的雾气里，破壳时自会见分晓。'}
        </p>
        <button className="primary" onClick={onNext} autoFocus>
          收下
        </button>
        <div className="reveal-count">第 {index + 1} / 8 项特征</div>
      </div>
    </div>
  )
}

/** gen2 破壳卡：蓄力至立绘就绪 → 白光 → 登场 */
function QHatchCard({ record, onNext }: { record: CreatureRecord; onNext: () => void }) {
  const traitIndex = useTraitIndex()
  const aberrant = record.outcome === 'aberrant'
  const ready = record.qstatus === 'ready'
  const reduced = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    [],
  )
  const [stage, setStage] = useState<'charge' | 'flash' | 'reveal'>('charge')
  const [minChargeDone, setMinChargeDone] = useState(reduced)

  useEffect(() => {
    if (reduced) return
    const t = setTimeout(() => setMinChargeDone(true), 1700)
    return () => clearTimeout(t)
  }, [reduced])

  useEffect(() => {
    if (stage === 'charge' && ready && minChargeDone) {
      setStage(reduced ? 'reveal' : 'flash')
    }
  }, [stage, ready, minChargeDone, reduced])

  useEffect(() => {
    if (stage !== 'flash') return
    const t = setTimeout(() => setStage('reveal'), 480)
    return () => clearTimeout(t)
  }, [stage])

  if (stage !== 'reveal') {
    const displayEgg = { theme: record.theme, points: 100, risk: record.riskAtHatch } as unknown as Egg
    return (
      <div className="overlay hatch-stage" role="dialog" aria-modal="true">
        <div className={stage === 'charge' ? 'hatch-egg-charging' : undefined}>
          <EggView egg={displayEgg} size={250} />
        </div>
        {stage === 'flash' && <div className="hatch-flash" />}
        <p className="hatch-hint">{ready ? '破壳中……' : '生命成形中……'}</p>
      </div>
    )
  }

  const hardFed = record.fedTodos.filter((t) => t.difficulty === 'hard' || t.difficulty === 'epic').length
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal-card hatch-card">
        <div className="eyebrow">
          破壳 · {THEMES[record.theme].name} · {record.id}
        </div>
        <QCreatureImg record={record} size={230} />
        <h3>{record.name}</h3>
        <p className="outcome">
          {aberrant ? (
            <span className="oc-ab">畸变孵化 · 判定 {record.riskAtHatch}% 风险命中</span>
          ) : record.qmode === 'mutation' ? (
            <span className="oc-normal">✦ 变异孵化 · 安然越过 {record.riskAtHatch}% 风险</span>
          ) : (
            <span className="oc-normal">正常孵化 · 安然越过 {record.riskAtHatch}% 风险</span>
          )}
        </p>
        {aberrant && (
          <div className="ab-note">它破壳时有点不知所措——工作间的灯为它调暗了一档。</div>
        )}
        {record.qmode === 'mutation' && (
          <div className="mut-note">✦ 变异降临：它带着不属于常规谱系的痕迹出生了。</div>
        )}
        <div className="hatch-traits">
          {Q_SLOT_ORDER.map((slot) => {
            const info = record.qsemantic ? traitIndex?.get(record.qsemantic[slot]) : undefined
            return (
              <span
                key={slot}
                className={info?.rarity === 'L' ? 'hl' : info?.rarity === 'R' ? 'hr' : ''}
              >
                {info?.displayName ?? Q_SLOT_NAMES[slot]}
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
