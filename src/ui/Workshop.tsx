import { HATCH_POINTS, THRESHOLDS, revealCount } from '../core/engine'
import {
  SLOT_NAMES,
  SLOT_ORDER,
  type CreatureRecord,
  type Difficulty,
  type GameState,
} from '../core/types'
import { THEMES } from '../data/themes'
import { TRAIT_MAP } from '../data/traits'
import { EggView } from '../render/Egg'
import { Creature } from '../render/Creature'
import { TodoBoard } from './TodoBoard'
import { Shed } from './Shed'

export interface Actions {
  addTodo(input: { title: string; difficulty: Difficulty; due: string | null }): void
  complete(id: string): void
  abandon(id: string): void
  swap(i: number): void
  rename(rid: string, nick: string): void
}

export function Workshop({
  state,
  today,
  actions,
}: {
  state: GameState
  today: string
  actions: Actions
}) {
  const egg = state.currentEgg
  return (
    <main className="workshop">
      <div className="col-left">
        <h2 className="panel-title">
          待办板 <span className="cnt">{state.todos.filter((t) => t.state === 'open').length} 条进行中</span>
        </h2>
        <TodoBoard todos={state.todos} today={today} actions={actions} hasEgg={!!egg} />
      </div>

      <div className="col-center">
        <div className="incubator">
          <div className="lamp" />
          {egg ? (
            <>
              <div className="egg-stage">
                <EggView egg={egg} size={210} />
              </div>
              <p className="theme-label">{THEMES[egg.theme].name}</p>
              <p className="theme-desc">{THEMES[egg.theme].eggDesc}</p>

              <div className="progress-wrap">
                <div className="pt-line">
                  <span>
                    孵化点 <b>{egg.points}</b> / {HATCH_POINTS}
                  </span>
                  <span>
                    已揭露 {revealCount(egg.points)} / 8
                  </span>
                </div>
                <div className="seg-bar">
                  {THRESHOLDS.map((th, i) => {
                    const prev = i === 0 ? 0 : THRESHOLDS[i - 1]
                    const frac = Math.max(0, Math.min(1, (egg.points - prev) / (th - prev)))
                    return (
                      <div key={th} className="seg" title={`${th} 点揭露：${SLOT_NAMES[SLOT_ORDER[i]]}`}>
                        <div className="fill" style={{ transform: `scaleX(${frac})` }} />
                      </div>
                    )
                  })}
                </div>
                <div className="risk-line">
                  <span>畸变风险</span>
                  <div className="risk-meter">
                    <div className="rf" style={{ width: `${(egg.risk / 85) * 100}%` }} />
                  </div>
                  <span className="risk-num">{Math.round(egg.risk)}%</span>
                </div>
              </div>

              <div className="trait-chips">
                {SLOT_ORDER.map((slot, i) => {
                  const revealed = i < revealCount(egg.points)
                  if (!revealed)
                    return (
                      <span key={slot} className="tchip unknown">
                        <span className="slotname">{SLOT_NAMES[slot]}</span>？
                      </span>
                    )
                  const t = TRAIT_MAP[egg.destiny.traits[slot]]
                  return (
                    <span key={slot} className={`tchip${t.rarity === 'R' ? ' rare' : ''}`} title={t.flavor}>
                      <span className="slotname">{SLOT_NAMES[slot]}</span>
                      {t.name}
                    </span>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="no-egg">
              孵化台空着。
              {state.shed.length > 0
                ? '可以从休眠棚换一枚蛋上来。'
                : '下一枚蛋将在周一降临。'}
            </div>
          )}

          <div className="floor">
            <Resident codex={state.codex} />
          </div>
        </div>
      </div>

      <div className="col-right">
        <h2 className="panel-title">休眠棚</h2>
        <Shed shed={state.shed} pending={state.pendingEggs} onSwap={actions.swap} hasEgg={!!egg} />
      </div>
    </main>
  )
}

/** 驻场生物：最近孵化的一只在工作间闲逛，按性格播放行为（§03） */
function Resident({ codex }: { codex: CreatureRecord[] }) {
  const rec = codex[codex.length - 1]
  if (!rec) {
    return <span className="resident-name">还没有孵化的生物驻场</span>
  }
  const silent = rec.aberrations.some((a) => a.ab === 'ab_silent')
  const temp = rec.traits.temperament
  const hour = new Date().getHours()
  const night = hour >= 20 || hour < 6

  let wrapCls = ''
  let bubble: string | null = null
  if (!silent) {
    switch (temp) {
      case 'temp_timid':
        wrapCls = 'res-shiver'
        bubble = '…'
        break
      case 'temp_curious':
        wrapCls = 'res-walk-mid'
        bubble = '?'
        break
      case 'temp_lazy':
        bubble = '💤'
        break
      case 'temp_restless':
        wrapCls = 'res-walk-fast'
        bubble = '!'
        break
      case 'temp_zealous':
        wrapCls = 'res-walk-mid res-bounce'
        bubble = '♪'
        break
      case 'temp_nocturnal':
        wrapCls = night ? 'res-walk-mid' : 'res-dim'
        bubble = night ? '👀' : '💤'
        break
      case 'temp_gloomy':
        wrapCls = 'res-walk-slow'
        bubble = '…'
        break
      case 'temp_hoarder':
        wrapCls = 'res-walk-mid'
        bubble = '✦'
        break
    }
  }

  return (
    <>
      <div className={`resident ${wrapCls}`}>
        <Creature
          traits={rec.traits}
          theme={rec.theme}
          aberrations={rec.aberrations}
          seed={rec.seed}
          size={104}
          idle={!silent}
        />
        {bubble && <span className="bubble">{bubble}</span>}
      </div>
      <span className="resident-name">
        驻场 · {rec.nickname ?? rec.name}（{rec.id}）
      </span>
    </>
  )
}
