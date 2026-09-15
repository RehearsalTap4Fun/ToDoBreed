import { SHED_CAP } from '../core/engine'
import type { Egg } from '../core/types'
import { eggDisplayName } from '../qmonster/feline/themes'
import { EggView } from '../render/Egg'

/** 休眠棚：墙上的木搁板 + 三个干草窝，点击蛋直接与孵化舱交换 */
export function Shed({
  shed,
  onSwap,
  hasEgg,
}: {
  shed: Egg[]
  onSwap: (i: number) => void
  hasEgg: boolean
}) {
  return (
    <div className="shelf-obj">
      <div className="nests">
        {Array.from({ length: SHED_CAP }, (_, i) => {
          const egg = shed[i]
          if (!egg) {
            return (
              <div key={i} className="nest empty" title="空置的干草窝">
                <div className="nest-straw" />
              </div>
            )
          }
          return (
            <button
              key={i}
              className="nest"
              onClick={() => onSwap(i)}
              title={`${eggDisplayName(egg)} · ${egg.points}/100 · 风险 ${Math.round(egg.risk)}% · 休眠第 ${egg.dormantWeeks} 周（每周 +8%，满 3 周自行破壳）—— 点击${hasEgg ? '与孵化舱交换' : '放入孵化舱'}`}
            >
              <div className="nest-egg">
                <EggView egg={egg} size={58} />
              </div>
              <div className="nest-straw" />
              <span className="nest-tag">
                {egg.points} · {Math.round(egg.risk)}%
              </span>
            </button>
          )
        })}
      </div>
      <div className="shelf-plank">
        <span className="shelf-label">休 眠 棚</span>
      </div>
    </div>
  )
}
