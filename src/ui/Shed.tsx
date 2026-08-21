import { SHED_CAP } from '../core/engine'
import type { Egg } from '../core/types'
import { THEMES } from '../data/themes'
import { EggView } from '../render/Egg'

export function Shed({
  shed,
  pending,
  onSwap,
  hasEgg,
}: {
  shed: Egg[]
  pending: number
  onSwap: (i: number) => void
  hasEgg: boolean
}) {
  return (
    <div className="shed">
      {Array.from({ length: SHED_CAP }, (_, i) => {
        const egg = shed[i]
        if (!egg)
          return (
            <div key={i} className="shed-slot empty">
              空置的干草窝
            </div>
          )
        return (
          <div key={i} className="shed-slot">
            <EggView egg={egg} size={58} />
            <div className="shed-info">
              <b>{THEMES[egg.theme].name}</b>
              <br />
              <span className="mono">
                {egg.points}/100 · 风险 {Math.round(egg.risk)}%
              </span>
              <br />
              <span className="mono">休眠第 {egg.dormantWeeks} 周</span>
            </div>
            <button onClick={() => onSwap(i)}>{hasEgg ? '交换' : '换上孵化台'}</button>
          </div>
        )
      })}
      <p className="shed-note">
        休眠中的蛋每周风险 +8%，休眠满 3 周将自行破壳。孵化点只进孵化台上的蛋。
      </p>
      {pending > 0 && <p className="pending-note">有 {pending} 枚新蛋在排队等空位</p>}
    </div>
  )
}
