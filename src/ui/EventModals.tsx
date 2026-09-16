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
import { QCreatureImg } from './QCreatureImg'
import {
  COAT_NAMES,
  EXPRESSION_NAMES,
  FELINE_SLOT_NAMES,
  FELINE_THEME_MAP,
  themeDisplayName,
} from '../qmonster/feline/themes'
import { MUTATION_MAP as F_MUTATION_MAP, TIER_NAMES } from '../qmonster/feline/mutations'
import { felineAvailable, type FelineSlot } from '../qmonster/feline/sdk'

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
  if (event.type === 'freveal') {
    return (
      <FRevealCard
        slot={event.slot}
        value={event.value}
        index={event.index}
        total={event.total}
        onNext={onNext}
      />
    )
  }
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
    const record = liveRecord(event.record.id) ?? event.record
    if (record.kind === 'feline') return <FHatchCard record={record} onNext={onNext} />
    return <HatchCard record={record} onNext={onNext} />
  }
  if (event.type === 'fgrow') {
    const record = liveRecord(event.record.id) ?? event.record
    return <FGrowCard event={event} record={record} onNext={onNext} />
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

/** 破壳演出三段式（§08）：蓄力抖动 → 白光迸发 → 登场；ready 为 false 时蓄力段等待立绘就绪 */
function useHatchStage(ready: boolean) {
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

  // flash → reveal 的定时器必须独立成 effect（与上一个合写会被 cleanup 清掉导致卡白光）
  useEffect(() => {
    if (stage !== 'flash') return
    const t = setTimeout(() => setStage('reveal'), 480)
    return () => clearTimeout(t)
  }, [stage])

  return { stage, skip: () => setStage('reveal') }
}

function HatchStage({
  record,
  stage,
  ready,
  onSkip,
}: {
  record: CreatureRecord
  stage: 'charge' | 'flash'
  ready: boolean
  onSkip?: () => void
}) {
  const displayEgg = {
    theme: record.theme,
    ftheme: record.ftheme,
    points: 100,
    risk: record.riskAtHatch,
  } as unknown as Egg
  return (
    <div className="overlay hatch-stage" role="dialog" aria-modal="true" onClick={onSkip}>
      <div className={stage === 'charge' ? 'hatch-egg-charging' : undefined}>
        <EggView egg={displayEgg} size={250} />
      </div>
      {stage === 'flash' && <div className="hatch-flash" />}
      <p className="hatch-hint">
        {ready ? (onSkip ? '破壳中……（点击跳过）' : '破壳中……') : '生命成形中……'}
      </p>
    </div>
  )
}

function HatchCard({ record, onNext }: { record: CreatureRecord; onNext: () => void }) {
  const aberrant = record.outcome === 'aberrant'
  const hardFed = record.fedTodos.filter((t) => t.difficulty === 'hard' || t.difficulty === 'epic').length
  const { stage, skip } = useHatchStage(true)

  if (stage !== 'reveal') {
    return <HatchStage record={record} stage={stage} ready onSkip={skip} />
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

/** 单文件（file://）形态的提示：立绘需要本地 HTTP 服务才能合成，存档不受影响 */
function OfflineImageNote() {
  return (
    <p className="offline-note">
      这个单文件形态无法合成立绘——双击「启动孵化器.command」或运行 <code>npm run play</code>
      打开同一份存档（导出/导入），形象就会出现。
    </p>
  )
}

/* ── gen3 小猫轨 ─────────────────────────────── */

/** gen3 驻场成长卡：长出新异变或同位置升品；立绘按新选项重新合成（就绪前显示占位） */
function FGrowCard({
  event,
  record,
  onNext,
}: {
  event: Extract<GameEvent, { type: 'fgrow' }>
  record: CreatureRecord
  onNext: () => void
}) {
  const to = F_MUTATION_MAP[event.to]
  const from = event.from ? F_MUTATION_MAP[event.from] : null
  const slotName = FELINE_SLOT_NAMES[event.slot]
  const who = record.nickname ?? record.name
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="eyebrow">驻场成长 · {slotName}</div>
        <QCreatureImg record={record} size={150} />
        <h3>{to.name}</h3>
        <span className={`rarity-chip rarity-${to.tier}`}>{TIER_NAMES[to.tier]}</span>
        <p className="flavor">
          {who} 看着你把事情做完，忽然开窍了——
          {from ? (
            <>
              {slotName}由「{from.name}」长成了「{to.name}」。
            </>
          ) : (
            <>
              {slotName}长出了「{to.name}」。
            </>
          )}
          <br />
          {to.brief}
          {event.rarityTo !== event.rarityFrom && (
            <>
              <br />
              稀有度 {TIER_NAMES[event.rarityFrom]} → {TIER_NAMES[event.rarityTo]}
            </>
          )}
        </p>
        <button className="primary" onClick={onNext} autoFocus>
          好耶
        </button>
        <div className="reveal-count">成长 {record.growths} / 3</div>
      </div>
    </div>
  )
}

/** gen3 揭露卡：花纹 / 表情 / 五个异变位置之一 */
function FRevealCard({
  slot,
  value,
  index,
  total,
  onNext,
}: {
  slot: FelineSlot
  value: string
  index: number
  total: number
  onNext: () => void
}) {
  let title: string
  let flavor: string
  let tier: 'N' | 'R' | 'L' | null = null
  if (slot === 'coat') {
    title = COAT_NAMES[value as keyof typeof COAT_NAMES] ?? value
    flavor = '毛色先定了调子。接下来的一切，都长在这身毛上。'
  } else if (slot === 'expression') {
    title = EXPRESSION_NAMES[value as keyof typeof EXPRESSION_NAMES] ?? value
    flavor = '它在蛋里已经做好了这个表情，等着见你。'
  } else if (value === 'none') {
    title = `${FELINE_SLOT_NAMES[slot]}安静`
    flavor = '这里目前没有异变——但破壳那一刻或有变数。'
  } else {
    const def = F_MUTATION_MAP[value as keyof typeof F_MUTATION_MAP]
    title = def?.name ?? value
    flavor = def?.brief ?? ''
    tier = def?.tier ?? null
  }
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="eyebrow">特征揭露 · {FELINE_SLOT_NAMES[slot]}</div>
        <h3>{title}</h3>
        {tier && <span className={`rarity-chip rarity-${tier}`}>{TIER_NAMES[tier]}</span>}
        <p className="flavor">{flavor}</p>
        <button className="primary" onClick={onNext} autoFocus>
          收下
        </button>
        <div className="reveal-count">
          第 {index + 1} / {total} 项特征
        </div>
      </div>
    </div>
  )
}

/** gen3 破壳卡：蓄力至 SDK 合成就绪 → 白光 → 登场；命名与稀有度在破壳瞬间已定 */
function FHatchCard({ record, onNext }: { record: CreatureRecord; onNext: () => void }) {
  const aberrant = record.outcome === 'aberrant'
  // file:// 单文件形态下 SDK 不可用：不等待立绘，直接登场并提示
  const ready = record.fstatus === 'ready' || !felineAvailable()
  const { stage } = useHatchStage(ready)
  const plan = record.fplan

  if (stage !== 'reveal') return <HatchStage record={record} stage={stage} ready={ready} />

  const hardFed = record.fedTodos.filter((t) => t.difficulty === 'hard' || t.difficulty === 'epic').length
  const theme = record.ftheme ? FELINE_THEME_MAP[record.ftheme] : null
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal-card hatch-card">
        <div className="eyebrow">
          破壳 · {themeDisplayName(record)} · {record.id}
        </div>
        <QCreatureImg record={record} size={230} />
        {!felineAvailable() && <OfflineImageNote />}
        <h3>
          {record.name}
          {plan && !aberrant && (
            <span className={`rarity-chip rarity-${plan.rarity}`} style={{ marginLeft: '0.5rem' }}>
              {TIER_NAMES[plan.rarity]}
            </span>
          )}
        </h3>
        <p className="outcome">
          {aberrant ? (
            <span className="oc-ab">畸变孵化 · 判定 {record.riskAtHatch}% 风险命中</span>
          ) : record.fmode === 'mutation' ? (
            <span className="oc-normal">✦ 变异孵化 · 安然越过 {record.riskAtHatch}% 风险</span>
          ) : (
            <span className="oc-normal">正常孵化 · 安然越过 {record.riskAtHatch}% 风险</span>
          )}
        </p>
        {aberrant && (
          <div className="ab-note">
            它破壳时有点不知所措——身上长了太多不属于{theme?.name ?? '这个主题'}的东西。工作间的灯为它调暗了一档。
          </div>
        )}
        {record.fmode === 'mutation' && (
          <div className="mut-note">✦ 变异降临：它比蛋里预示的多长出了几处东西。</div>
        )}
        {plan && (
          <div className="hatch-traits">
            <span>{COAT_NAMES[plan.selections.coat]}</span>
            <span>{EXPRESSION_NAMES[plan.selections.expression]}</span>
            {plan.mutations.map((m) => {
              const def = F_MUTATION_MAP[m]
              return (
                <span key={m} className={def.tier === 'L' ? 'hl' : def.tier === 'R' ? 'hr' : ''}>
                  {def.name}
                </span>
              )
            })}
          </div>
        )}
        <div className="hatch-fed">
          这只小猫由 {record.fedTodos.length} 条待办喂大
          {hardFed > 0 && `，其中 ${hardFed} 条是硬仗`}。
        </div>
        <button className="primary" onClick={onNext} autoFocus style={{ marginTop: '0.8rem' }}>
          记入图鉴
        </button>
      </div>
    </div>
  )
}
