import { HATCH_POINTS, revealCount } from '../core/engine'
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
        {state.streak > 0 && (
          <p className={`streak-line${state.streak >= 3 ? ' on' : ''}`}>
            按时连击 ×{state.streak}
            {state.streak >= 3 ? ' · 揭露稀有度加成中（稀有×1.5 / 传说×2）' : '（满 3 触发稀有度加成）'}
          </p>
        )}
        <TodoBoard todos={state.todos} today={today} actions={actions} hasEgg={!!egg} />
      </div>

      <div className="col-center">
        <div className="incubator">
          <div className="lamp" />
          {egg ? (
            <>
              {/* 孵化器装置：玻璃罩 + 金属基座（LED 揭露进度 + 风险指示灯） */}
              <div className="egg-stage">
                <div className="machine">
                  <div className="egg-holder">
                    <EggView egg={egg} size={188} />
                  </div>
                  <div className="dome" />
                  <div className="machine-base">
                    <span className="machine-label">GSI·MK-I</span>
                    <div className="led-strip">
                      {SLOT_ORDER.map((slot, i) => (
                        <span
                          key={slot}
                          className={`led${i < revealCount(egg.points) ? ' lit' : ''}`}
                          title={`${SLOT_NAMES[slot]}${i < revealCount(egg.points) ? '（已揭露）' : ''}`}
                        />
                      ))}
                    </div>
                    <span
                      className={`risk-lamp ${egg.risk < 15 ? 'low' : egg.risk < 40 ? 'mid' : 'high'}`}
                      title={`畸变风险 ${Math.round(egg.risk)}%`}
                    />
                  </div>
                </div>
              </div>
              <p className="theme-label">{THEMES[egg.theme].name}</p>
              <p className="theme-desc">{THEMES[egg.theme].eggDesc}</p>

              <div className="progress-wrap">
                <div className="pt-line">
                  <span>
                    孵化点 <b>{egg.points}</b> / {HATCH_POINTS}
                  </span>
                  <span>已揭露 {revealCount(egg.points)} / 8</span>
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
                  const traitId = egg.revealed[slot]
                  if (!traitId)
                    return (
                      <span key={slot} className="tchip unknown">
                        <span className="slotname">{SLOT_NAMES[slot]}</span>？
                      </span>
                    )
                  const t = TRAIT_MAP[traitId]
                  return (
                    <span
                      key={slot}
                      className={`tchip${t.rarity === 'L' ? ' legend' : t.rarity === 'R' ? ' rare' : ''}`}
                      title={t.flavor}
                    >
                      <span className="slotname">{SLOT_NAMES[slot]}</span>
                      {t.name}
                    </span>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="egg-stage">
              <div className="machine">
                <div className="egg-holder empty-holder">
                  <span>
                    孵化舱空着。
                    {state.shed.length > 0 ? '从休眠棚换一枚蛋上来。' : '下一枚蛋周一降临。'}
                  </span>
                </div>
                <div className="dome" />
                <div className="machine-base">
                  <span className="machine-label">GSI·MK-I</span>
                  <div className="led-strip">
                    {SLOT_ORDER.map((slot) => (
                      <span key={slot} className="led" />
                    ))}
                  </div>
                  <span className="risk-lamp off" />
                </div>
              </div>
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
          mutation={rec.mutation}
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
