import { useState } from 'react'
import { HATCH_POINTS, residentOf, revealCount } from '../core/engine'
import {
  Q_SLOT_NAMES,
  Q_SLOT_ORDER,
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
import { QCreatureImg } from './QCreatureImg'
import { useTraitIndex } from '../qmonster/semantics'
import { TodoBoard } from './TodoBoard'
import { Shed } from './Shed'

export interface Actions {
  addTodo(
    input: { title: string; difficulty: Difficulty; due: string | null },
    saveAsTemplate?: boolean,
  ): void
  applyTemplate(id: string): void
  removeTemplate(id: string): void
  complete(id: string): void
  abandon(id: string): void
  swap(i: number): void
  rename(rid: string, nick: string): void
  setResident(rid: string | null): void
}

export interface WorkshopProps {
  state: GameState
  today: string
  dow: string
  devOffset: number
  actions: Actions
  onOpenCodex(): void
  onOpenInbox(): void
  onExport(): void
  onImportClick(): void
}

/** 场景化工作间（§03）：所有功能物化为房间里的物件，不做抽屉式菜单 */
export function Workshop({
  state,
  today,
  dow,
  devOffset,
  actions,
  onOpenCodex,
  onOpenInbox,
  onExport,
  onImportClick,
}: WorkshopProps) {
  const egg = state.currentEgg
  const [chestOpen, setChestOpen] = useState(false)

  return (
    <main className="scene">
      {/* 吊灯与光锥 */}
      <div className="light-cone" />
      <div className="lamp-obj">
        <div className="lamp-cord" />
        <div className="lamp-shade" />
        <div className="lamp-bulb" />
      </div>

      {/* 墙上的木牌与挂历 */}
      <div className="wall-sign">怪奇生物孵化器</div>
      <div className="calendar-obj" title={`${today} ${dow}`}>
        <div className="cal-top">{today.slice(0, 7)}</div>
        <div className="cal-day">{today.slice(8)}</div>
        <div className="cal-dow">
          {dow}
          {devOffset !== 0 && <em>偏移{devOffset}天</em>}
        </div>
      </div>

      {/* 墙上的线索信箱 */}
      <button
        className="mailbox-obj"
        onClick={onOpenInbox}
        title="线索信箱：采集脚本从 git 与 AI 会话中送来的待办建议"
      >
        <span className="mail-slot" />
        {state.inbox.length > 0 && (
          <>
            <span className="mail-flag" />
            <span className="mail-badge">{state.inbox.length}</span>
          </>
        )}
      </button>

      {/* 黑板（含便签、粉笔连击、写便签入口） */}
      <div className="board-wrap">
        <TodoBoard
          todos={state.todos}
          templates={state.templates}
          today={today}
          actions={actions}
          hasEgg={!!egg}
          streak={state.streak}
        />
      </div>

      {/* 墙上的 8 张观察卡：已揭露特征（gen2 读语义槽，legacy 读旧特征库） */}
      <TraitWall egg={egg} />

      {/* 墙上的休眠棚搁板 */}
      <Shed shed={state.shed} onSwap={actions.swap} hasEgg={!!egg} />

      {/* 工作桌：孵化器 + 记录夹 + 图鉴 + 存档匣 */}
      <div className="desk">
        <div className="on-desk machine-spot">
          <div className="machine">
            {egg ? (
              <div className="egg-holder">
                <EggView egg={egg} size={188} />
              </div>
            ) : (
              <div className="egg-holder empty-holder">
                <span>孵化舱空着，新蛋正在路上。</span>
              </div>
            )}
            <div className="dome" />
            <div className="machine-base">
              <span className="machine-label">GSI·MK-I</span>
              <div className="led-strip">
                {SLOT_ORDER.map((slot, i) => (
                  <span
                    key={slot}
                    className={`led${egg && i < revealCount(egg.points) ? ' lit' : ''}`}
                    title={SLOT_NAMES[slot]}
                  />
                ))}
              </div>
              <span
                className={`risk-lamp ${
                  !egg ? 'off' : egg.risk < 15 ? 'low' : egg.risk < 40 ? 'mid' : 'high'
                }`}
                title={egg ? `畸变风险 ${Math.round(egg.risk)}%` : '待机'}
              />
            </div>
          </div>
        </div>

        <button className="on-desk book-obj" onClick={onOpenCodex} title="翻开怪奇图鉴">
          <span className="book-title">怪奇图鉴</span>
          <span className="book-count">{state.codex.length}</span>
        </button>

        <div className="on-desk chest-wrap">
          <button
            className="chest-obj"
            onClick={() => setChestOpen((v) => !v)}
            title="存档匣：导出 / 导入"
          >
            <span className="chest-clasp" />
          </button>
          {chestOpen && (
            <div className="chest-menu">
              <button
                onClick={() => {
                  onExport()
                  setChestOpen(false)
                }}
              >
                导出存档
              </button>
              <button
                onClick={() => {
                  onImportClick()
                  setChestOpen(false)
                }}
              >
                导入存档
              </button>
            </div>
          )}
        </div>

        <div className="desk-top" />
        <div className="desk-front">
          <div className="clipboard">
            {egg ? (
              <>
                <b>{THEMES[egg.theme].name}</b>
                <span className="cb-line">
                  孵化点 <em>{egg.points}</em> / {HATCH_POINTS} · 已揭露 {revealCount(egg.points)}/8
                </span>
                <div className="risk-line">
                  <span>风险</span>
                  <div className="risk-meter">
                    <div className="rf" style={{ width: `${(egg.risk / 85) * 100}%` }} />
                  </div>
                  <span className="risk-num">{Math.round(egg.risk)}%</span>
                </div>
              </>
            ) : (
              <>
                <b>孵化舱空置</b>
                <span className="cb-line">新蛋即将降临</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 地板与驻场生物 */}
      <div className="floor-area">
        <Resident rec={residentOf(state)} pinned={!!state.residentId} />
      </div>
    </main>
  )
}

/** 驻场生物：默认最新孵化，可在图鉴指定；按性格播放行为（§03） */
function Resident({ rec, pinned }: { rec: CreatureRecord | null; pinned: boolean }) {
  if (!rec) {
    return <span className="resident-name">还没有孵化的生物驻场</span>
  }
  const silent = rec.aberrations.some((a) => a.ab === 'ab_silent')
  const temp = rec.traits?.temperament ?? ''
  const hour = new Date().getHours()
  const night = hour >= 20 || hour < 6

  let wrapCls = rec.kind === 'qmonster' ? 'res-walk-mid' : ''
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
        {rec.kind === 'qmonster' ? (
          <QCreatureImg record={rec} size={112} className={silent ? undefined : 'creature-idle'} />
        ) : (
          <Creature
            traits={rec.traits!}
            theme={rec.theme}
            aberrations={rec.aberrations}
            mutation={rec.mutation}
            seed={rec.seed}
            size={104}
            idle={!silent}
          />
        )}
        {bubble && <span className="bubble">{bubble}</span>}
      </div>
      <span className="resident-name">
        驻场{pinned ? '·指定' : ''} · {rec.nickname ?? rec.name}（{rec.id}）
      </span>
    </>
  )
}


/** 观察卡墙：gen2 蛋读 QMonster 语义槽（身份解析前显示凝聚中），legacy 蛋读旧特征库 */
function TraitWall({ egg }: { egg: GameState['currentEgg'] }) {
  const traitIndex = useTraitIndex()
  const revealed = egg ? revealCount(egg.points) : 0
  return (
    <div className="trait-wall">
      {SLOT_ORDER.map((slot, i) => {
        let name: string | null = null
        let flavor = '尚未揭露'
        let rarity: 'N' | 'R' | 'L' | null = null
        let slotName: string = SLOT_NAMES[slot]
        if (egg?.qseed) {
          slotName = Q_SLOT_NAMES[Q_SLOT_ORDER[i]]
          if (i < revealed) {
            const qid = egg.qidentity?.slots[Q_SLOT_ORDER[i]]
            const info = qid ? traitIndex?.get(qid) : undefined
            name = info?.displayName ?? '凝聚中'
            flavor = info?.flavorText ?? '身份尚在凝聚'
            rarity = info?.rarity ?? null
          }
        } else if (egg && i < revealed) {
          const id = egg.revealed[slot]
          const t = id ? TRAIT_MAP[id] : null
          if (t) {
            name = t.name
            flavor = t.flavor
            rarity = t.rarity
          }
        }
        return (
          <div
            key={slot}
            className={`wallcard${name ? '' : ' unknown'}${rarity === 'L' ? ' l' : rarity === 'R' ? ' r' : ''}`}
            title={flavor}
          >
            <span className="wc-slot">{slotName}</span>
            <span className="wc-name">{name ?? '？'}</span>
          </div>
        )
      })}
    </div>
  )
}
