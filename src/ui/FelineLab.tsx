import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  FELINE_RUNTIME_REVISION,
  felineAvailable,
  loadFelineAvailability,
  loadFelineHatchery,
  type FelineHatchery,
} from '../qmonster/feline/sdk'
import { COAT_NAMES, EXPRESSION_NAMES, FELINE_THEMES } from '../qmonster/feline/themes'
import {
  MUTATION_DEFS,
  MUTATION_MAP,
  MUTATION_NAMES,
  TIER_NAMES,
  type AnyMutationId,
} from '../qmonster/feline/mutations'
import {
  FELINE_RULES_VERSION,
  FULL_AVAILABILITY,
  TIER_WEIGHTS,
  planFeline,
  toSdkSelections,
  type Availability,
  type FelineMode,
  type FelinePlan,
} from '../qmonster/feline/rules'
import type { Rarity } from '../core/types'

/** 小猫组合试验场（?flab=1）：QMonster v0.10 SDK × 孵化器 gen3 规则 v2（分层异变），6 主题 × 3 判定 小范围目测 */

const MODES: FelineMode[] = ['normal', 'mutation', 'aberration']
const MODE_NAMES: Record<FelineMode, string> = {
  normal: '正常',
  mutation: '变异',
  aberration: '畸变',
}
const MODE_HINTS: Record<FelineMode, string> = {
  normal: '0–1 处，首件 80% 标志',
  mutation: '2–3 处，必含标志',
  aberration: '3–5 处，压低本主题件',
}
const TIERS: Rarity[] = ['N', 'R', 'L']
const SLOT_NAMES = { crown: '额顶', ears: '耳', neck: '颈', back: '背', tailTip: '尾' } as const

interface CellImage {
  url?: string
  error?: string
}

export function FelineLab() {
  const [hatchery, setHatchery] = useState<FelineHatchery | null>(null)
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('20260915')
  const [seedBase, setSeedBase] = useState('20260915')
  const [perCell, setPerCell] = useState(2)
  const [images, setImages] = useState<Record<string, CellImage>>({})

  useEffect(() => {
    if (!felineAvailable()) {
      setError('小猫 SDK 需要 HTTP 同源 + 安全上下文（localhost），file:// 单机形态下不可用，请通过 npm run dev 或 npm run play 访问')
      return
    }
    Promise.all([loadFelineHatchery(), loadFelineAvailability()])
      .then(([h, a]) => {
        setHatchery(h)
        setAvailability(() => a as Availability)
      })
      .catch((e) => setError(String(e)))
  }, [])

  const plans = useMemo(() => {
    if (!availability) return []
    return FELINE_THEMES.flatMap((t) =>
      MODES.flatMap((m) =>
        Array.from({ length: perCell }, (_, i) =>
          planFeline(`${seedBase}-${t.id}-${m}-${i + 1}`, t.id, m, availability),
        ),
      ),
    )
  }, [seedBase, perCell, availability])

  useEffect(() => {
    if (!hatchery || plans.length === 0) return
    let cancelled = false
    const urls: string[] = []
    setImages({})
    const queue = [...plans]
    const worker = async () => {
      while (!cancelled) {
        const plan = queue.shift()
        if (!plan) return
        try {
          const result = await hatchery.hatch(plan.seed, toSdkSelections(plan))
          if (cancelled) return
          const url = URL.createObjectURL(result.image.blob)
          urls.push(url)
          setImages((prev) => ({ ...prev, [plan.seed]: { url } }))
        } catch (e) {
          if (cancelled) return
          setImages((prev) => ({ ...prev, [plan.seed]: { error: String(e) } }))
        }
      }
    }
    void Promise.all([worker(), worker()])
    return () => {
      cancelled = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [hatchery, plans])

  // 畸变体单独计数，不计入 N/R/L（与图鉴/标本室口径一致）
  const totals = plans.reduce(
    (acc, p) => {
      if (p.aberrant) acc.X += 1
      else acc[p.rarity] += 1
      return acc
    },
    { N: 0, R: 0, L: 0, X: 0 },
  )
  const done = Object.values(images).filter((i) => i.url).length
  const failed = Object.values(images).filter((i) => i.error).length

  return (
    <div className="flab">
      <header className="lab-head">
        <h1>小猫组合试验场</h1>
        <p>
          QMonster v0.10 小猫组合 · 6 主题 × 3 判定 · 规则 {FELINE_RULES_VERSION} · SDK{' '}
          {FELINE_RUNTIME_REVISION.slice(0, 8)} · 同 seed 确定性生成 · 图像由 SDK 在浏览器合成
        </p>
        <div className="flab-controls">
          <label className="qlab-seed">
            seed 基串：
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSeedBase(draft)
              }}
            />
          </label>
          <button onClick={() => setSeedBase(draft)}>重新生成</button>
          <label className="qlab-seed">
            每格：
            <select value={perCell} onChange={(e) => setPerCell(Number(e.target.value))}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n} 只
                </option>
              ))}
            </select>
          </label>
          <span className="flab-totals">
            本页 {plans.length} 只 · 普通 {totals.N} · 稀有 {totals.R} · 传说 {totals.L} · 畸变{' '}
            {totals.X} · 已绘 {done}/{plans.length}
            {failed > 0 && <em className="flab-failed"> · 失败 {failed}</em>}
          </span>
        </div>
      </header>
      {error && <div className="qlab-error">{error}</div>}

      <MutationLegend availability={availability} />
      <DistributionPreview availability={availability} />

      <div className="flab-grid" style={{ gridTemplateColumns: '150px repeat(3, 1fr)' }}>
        <div />
        {MODES.map((m) => (
          <div key={m} className="lab-col-head">
            {MODE_NAMES[m]}
            <small>{MODE_HINTS[m]}</small>
          </div>
        ))}
        {FELINE_THEMES.map((t) => (
          <Fragment key={t.id}>
            <div className="lab-row-head">
              <b>{t.name}</b>
              <span>{t.tagline}</span>
              <span className="flab-sig">标志：{MUTATION_NAMES[t.signature]}</span>
              <span>亲和：{t.affinity.map((m) => MUTATION_NAMES[m]).join('、')}</span>
              <span>词根：{t.nameRoots.join('')}</span>
            </div>
            {MODES.map((m) => (
              <div key={m} className="flab-cell">
                {plans
                  .filter((p) => p.theme === t.id && p.mode === m)
                  .map((p) => (
                    <FelineCard key={p.seed} plan={p} image={images[p.seed]} />
                  ))}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function TierBadge({ tier, aberrant }: { tier: Rarity; aberrant?: boolean }) {
  return (
    <span className={`flab-badge flab-badge-${tier}${aberrant ? ' is-aberrant' : ''}`}>
      {aberrant ? '畸变' : TIER_NAMES[tier]}
    </span>
  )
}

function FelineCard({ plan, image }: { plan: FelinePlan; image?: CellImage }) {
  return (
    <figure className={`flab-card${plan.aberrant ? ' aberrant' : ''}`}>
      <div className="flab-img">
        {image?.url ? (
          <img src={image.url} alt={plan.name} />
        ) : image?.error ? (
          <div className="flab-err" title={image.error}>
            渲染失败
          </div>
        ) : (
          <div className="flab-pending">绘制中…</div>
        )}
      </div>
      <figcaption>
        <div className="flab-title">
          <b>{plan.name}</b>
          <TierBadge tier={plan.rarity} aberrant={plan.aberrant} />
        </div>
        <div className="flab-chips">
          <span>{COAT_NAMES[plan.selections.coat]}</span>
          <span>{EXPRESSION_NAMES[plan.selections.expression]}</span>
          {plan.mutations.map((m) => (
            <span key={m} className={`tier-${MUTATION_MAP[m].tier}`}>
              {MUTATION_NAMES[m]}
            </span>
          ))}
        </div>
      </figcaption>
    </figure>
  )
}

/** 异变登记表：分层 + 位置 + 素材状态（按目录实际可用性标注） */
function MutationLegend({ availability }: { availability: Availability | null }) {
  const liveFor = (id: AnyMutationId) => {
    if (!availability) return null
    const coats = FELINE_THEMES.flatMap((t) => t.coats.map((c) => c.item))
    const uniq = [...new Set(coats)]
    const n = uniq.filter((c) => availability(c).has(id)).length
    return n === uniq.length ? '已有' : n === 0 ? '待素材' : `${n}/${uniq.length} 花纹`
  }
  return (
    <details className="flab-panel" open>
      <summary>
        异变登记表 · {MUTATION_DEFS.length} 件（现有 {MUTATION_DEFS.filter((d) => d.status === 'live').length}
        ，批次 1 待素材 {MUTATION_DEFS.filter((d) => d.status === 'planned').length}）
      </summary>
      <div className="flab-legend">
        {TIERS.map((tier) => (
          <div key={tier} className="flab-legend-col">
            <div className="flab-legend-head">
              <TierBadge tier={tier} />
              <small>
                层权重 正常 {TIER_WEIGHTS.normal[tier]} · 变异 {TIER_WEIGHTS.mutation[tier]} · 畸变{' '}
                {TIER_WEIGHTS.aberration[tier]}
              </small>
            </div>
            {MUTATION_DEFS.filter((d) => d.tier === tier).map((d) => {
              const state = liveFor(d.id)
              return (
                <div key={d.id} className={`flab-legend-row${state === '待素材' ? ' is-planned' : ''}`}>
                  <b>{d.name}</b>
                  <span className="flab-legend-slot">{SLOT_NAMES[d.slot]}</span>
                  <span className="flab-legend-state">{state ?? '…'}</span>
                  <small>{d.brief}</small>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </details>
  )
}

/** 分布预演：不渲染，只跑规则，比较"现有素材"与"批次 1 到位后"的稀有度与异变出现率 */
function DistributionPreview({ availability }: { availability: Availability | null }) {
  const SAMPLE = 400
  const stats = useMemo(() => {
    const scenarios: { key: string; label: string; av: Availability | null }[] = [
      { key: 'live', label: '现有素材', av: availability },
      { key: 'full', label: '批次 1 到位后', av: FULL_AVAILABILITY },
    ]
    return scenarios.map((sc) => {
      const perMode = MODES.map((mode) => {
        const rar: Record<Rarity, number> = { N: 0, R: 0, L: 0 }
        const freq: Record<string, number> = {}
        let total = 0
        if (sc.av) {
          for (const t of FELINE_THEMES) {
            for (let i = 0; i < SAMPLE; i++) {
              const p = planFeline(`dist-${i}`, t.id, mode, sc.av)
              rar[p.rarity] += 1
              for (const m of p.mutations) freq[m] = (freq[m] ?? 0) + 1
              total += 1
            }
          }
        }
        return { mode, rar, freq, total }
      })
      return { ...sc, perMode }
    })
  }, [availability])

  const pct = (n: number, d: number) => (d === 0 ? '–' : `${Math.round((n / d) * 100)}%`)

  return (
    <details className="flab-panel">
      <summary>分布预演 · 每判定 6 主题 × {SAMPLE} seed，只跑规则不渲染</summary>
      <div className="flab-dist">
        <table>
          <thead>
            <tr>
              <th>场景</th>
              <th>判定</th>
              <th>普通</th>
              <th>稀有</th>
              <th>传说</th>
              {MUTATION_DEFS.map((d) => (
                <th key={d.id} className={`tier-${d.tier}`}>
                  {d.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((sc) =>
              sc.perMode.map((row, i) => (
                <tr key={`${sc.key}-${row.mode}`}>
                  {i === 0 && <td rowSpan={MODES.length}>{sc.label}</td>}
                  <td>{MODE_NAMES[row.mode]}</td>
                  <td>{pct(row.rar.N, row.total)}</td>
                  <td>{pct(row.rar.R, row.total)}</td>
                  <td>{pct(row.rar.L, row.total)}</td>
                  {MUTATION_DEFS.map((d) => (
                    <td key={d.id}>{pct(row.freq[d.id] ?? 0, row.total)}</td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
        <p>异变列 = 该判定下带此异变的个体占比（一只可带多处）。稀有度 = max(最高异变层, 处数层)；畸变按稀有度列出但另打标记。</p>
      </div>
    </details>
  )
}
