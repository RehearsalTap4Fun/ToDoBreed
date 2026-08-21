import { useId, useMemo } from 'react'
import type { Egg as EggT } from '../core/types'
import { THEMES } from '../data/themes'
import { shade } from './colors'

const EGG_PATH =
  'M100,26 C136,26 158,80 158,116 C158,152 132,174 100,174 C68,174 42,152 42,116 C42,80 64,26 100,26 Z'

/** 蛋的可视化（§03）：进度越高微光越亮，风险越高裂纹越多 */
export function EggView({ egg, size = 200 }: { egg: EggT; size?: number }) {
  const rawId = useId()
  const uid = useMemo(() => `e${rawId.replace(/[^a-zA-Z0-9]/g, '')}`, [rawId])
  const theme = THEMES[egg.theme]
  const [primary, secondary, accent] = theme.palette
  const glow = 0.15 + (egg.points / 100) * 0.55

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={theme.name}>
      <defs>
        <linearGradient id={`${uid}-shell`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={shade(primary, 0.28)} />
          <stop offset="55%" stopColor={primary} />
          <stop offset="100%" stopColor={shade(primary, -0.22)} />
        </linearGradient>
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0%" stopColor={accent} stopOpacity={0.9} />
          <stop offset="100%" stopColor={accent} stopOpacity={0} />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={EGG_PATH} />
        </clipPath>
      </defs>

      {/* 孵化灯微光：随进度增强 */}
      <ellipse className="egg-halo" cx={100} cy={120} rx={86} ry={78} fill={`url(#${uid}-halo)`} opacity={glow} />

      <g className="egg-wobble">
        <path d={EGG_PATH} fill={`url(#${uid}-shell)`} />

        <g clipPath={`url(#${uid}-clip)`}>
          {/* 主题装饰 */}
          {egg.theme === 'deepsea' && (
            <g>
              <circle className="bubble b1" cx={80} cy={150} r={5} fill={secondary} opacity={0.55} />
              <circle className="bubble b2" cx={112} cy={160} r={3.4} fill={secondary} opacity={0.5} />
              <circle className="bubble b3" cx={96} cy={145} r={2.4} fill={accent} opacity={0.55} />
              <path d="M70,45 Q60,80 66,118" stroke={accent} strokeWidth={5} fill="none" opacity={0.28} strokeLinecap="round" />
            </g>
          )}
          {egg.theme === 'fungal' && (
            <g>
              <circle cx={78} cy={70} r={4} fill={accent} opacity={0.5} />
              <circle cx={124} cy={96} r={5.5} fill={accent} opacity={0.4} />
              <circle cx={90} cy={128} r={3} fill={accent} opacity={0.5} />
              <circle cx={118} cy={140} r={4.4} fill={secondary} opacity={0.5} />
            </g>
          )}
          {egg.theme === 'shadow' && (
            <g>
              <path d="M60,110 q40,-26 80,0 q-40,26 -80,0 z" fill="#000" opacity={0.45} />
              <circle className="shadow-blink" cx={100} cy={110} r={3} fill={secondary} opacity={0.8} />
            </g>
          )}

          {/* 进度较高时透出的内部剪影 */}
          {egg.points >= 60 && (
            <ellipse cx={100} cy={118} rx={30} ry={36} fill="#000" opacity={0.18 + egg.points / 500} />
          )}

          {/* 风险裂纹 */}
          <g stroke={shade(primary, -0.55)} strokeWidth={2.2} fill="none" strokeLinecap="round">
            {egg.risk > 15 && <path d="M78,60 l8,12 l-5,10 l9,8" />}
            {egg.risk > 30 && <path d="M128,84 l-9,10 l6,12 l-10,9" />}
            {egg.risk > 50 && <path d="M92,130 l10,9 l-4,12 M64,100 l9,7 l-3,11" />}
            {egg.risk > 70 && <path d="M112,44 l-7,12 l8,9 M140,110 l-10,8 l4,12" />}
          </g>
        </g>

        {/* 高光 */}
        <ellipse cx={82} cy={62} rx={11} ry={20} fill="#fff" opacity={egg.theme === 'shadow' ? 0.08 : 0.22} transform="rotate(-18 82 62)" />

        {/* 菌沼蛋壳上的活蘑菇 */}
        {egg.theme === 'fungal' && (
          <g>
            <g transform="translate(58,88)">
              <line x1={0} y1={0} x2={-4} y2={-9} stroke="#D8CBAF" strokeWidth={2.6} />
              <path d="M-11,-9 a7,6 0 0 1 14,0 z" fill="#C0705F" />
            </g>
            <g transform="translate(142,120) scale(0.8)">
              <line x1={0} y1={0} x2={4} y2={-9} stroke="#D8CBAF" strokeWidth={2.6} />
              <path d="M-3,-9 a7,6 0 0 1 14,0 z" fill="#C0705F" />
            </g>
          </g>
        )}
      </g>
    </svg>
  )
}
