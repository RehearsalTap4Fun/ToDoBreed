import { useId, useMemo } from 'react'
import type { ReactNode } from 'react'
import { mulberry32 } from '../core/rng'
import type { SlotId, ThemeId } from '../core/types'
import { DISCORD_PALETTES, THEMES } from '../data/themes'
import { mix, shade } from './colors'

/**
 * 生物渲染器（§13.1）：生物 = 特征 ID 列表 + 主题色板，渲染是纯函数。
 * 图层顺序：地影 → 异能微光 → 附肢 → 蒙版躯体（底色+纹样+表皮内效）→ 表皮外饰 → 头部 → 口器。
 */

interface Pt {
  x: number
  y: number
}

interface FrameGeo {
  silhouette: ReactNode
  headC: Pt
  mouthC: Pt
  limbC: Pt
  limbSpread: number
  sideL: Pt
  sideR: Pt
  tailC: Pt
  floats?: boolean
}

/** 可爱治愈方向的造型基准：大头身比、圆润剪影、无锐角 */
const FRAME_GEO: Record<string, FrameGeo> = {
  frame_fluff: {
    silhouette: <circle cx={100} cy={120} r={60} fill="#fff" />,
    headC: { x: 100, y: 106 },
    mouthC: { x: 100, y: 140 },
    limbC: { x: 100, y: 174 },
    limbSpread: 55,
    sideL: { x: 46, y: 122 },
    sideR: { x: 154, y: 122 },
    tailC: { x: 152, y: 144 },
  },
  frame_serpent: {
    silhouette: (
      <>
        <path
          d="M45,161 C58,116 108,150 126,104"
          fill="none"
          stroke="#fff"
          strokeWidth={34}
          strokeLinecap="round"
        />
        <circle cx={136} cy={86} r={26} fill="#fff" />
      </>
    ),
    headC: { x: 136, y: 84 },
    mouthC: { x: 132, y: 100 },
    limbC: { x: 86, y: 168 },
    limbSpread: 45,
    sideL: { x: 58, y: 140 },
    sideR: { x: 126, y: 124 },
    tailC: { x: 45, y: 161 },
  },
  frame_squat: {
    silhouette: <ellipse cx={100} cy={136} rx={62} ry={44} fill="#fff" />,
    headC: { x: 100, y: 116 },
    mouthC: { x: 100, y: 148 },
    limbC: { x: 100, y: 176 },
    limbSpread: 65,
    sideL: { x: 40, y: 136 },
    sideR: { x: 160, y: 136 },
    tailC: { x: 158, y: 148 },
  },
  frame_quad: {
    silhouette: (
      <>
        <ellipse cx={112} cy={134} rx={50} ry={30} fill="#fff" />
        <circle cx={56} cy={104} r={29} fill="#fff" />
      </>
    ),
    headC: { x: 56, y: 100 },
    mouthC: { x: 52, y: 118 },
    limbC: { x: 112, y: 160 },
    limbSpread: 55,
    sideL: { x: 66, y: 144 },
    sideR: { x: 158, y: 134 },
    tailC: { x: 160, y: 128 },
  },
  frame_biped: {
    silhouette: (
      <path
        d="M100,62 C128,62 140,94 140,126 C140,156 124,172 100,172 C76,172 60,156 60,126 C60,94 72,62 100,62 Z"
        fill="#fff"
      />
    ),
    headC: { x: 100, y: 92 },
    mouthC: { x: 100, y: 124 },
    limbC: { x: 100, y: 170 },
    limbSpread: 30,
    sideL: { x: 62, y: 116 },
    sideR: { x: 138, y: 116 },
    tailC: { x: 136, y: 144 },
  },
  frame_segmented: {
    silhouette: (
      <>
        <circle cx={58} cy={134} r={27} fill="#fff" />
        <circle cx={97} cy={132} r={21} fill="#fff" />
        <circle cx={128} cy={140} r={18} fill="#fff" />
        <circle cx={152} cy={148} r={14} fill="#fff" />
      </>
    ),
    headC: { x: 56, y: 126 },
    mouthC: { x: 52, y: 144 },
    limbC: { x: 100, y: 162 },
    limbSpread: 52,
    sideL: { x: 60, y: 152 },
    sideR: { x: 150, y: 156 },
    tailC: { x: 163, y: 152 },
  },
  frame_umbrella: {
    silhouette: (
      <>
        <path d="M38,110 A62,56 0 0 1 162,110 Q100,128 38,110 Z" fill="#fff" />
        <rect x={82} y={106} width={36} height={54} rx={17} fill="#fff" />
      </>
    ),
    headC: { x: 100, y: 90 },
    mouthC: { x: 100, y: 140 },
    limbC: { x: 100, y: 162 },
    limbSpread: 38,
    sideL: { x: 46, y: 104 },
    sideR: { x: 154, y: 104 },
    tailC: { x: 118, y: 152 },
  },
  frame_float: {
    silhouette: (
      <path
        d="M100,54 C134,62 148,98 134,130 C126,152 74,152 66,130 C52,98 66,62 100,54 Z"
        fill="#fff"
      />
    ),
    headC: { x: 100, y: 94 },
    mouthC: { x: 100, y: 124 },
    limbC: { x: 100, y: 146 },
    limbSpread: 32,
    sideL: { x: 64, y: 102 },
    sideR: { x: 136, y: 102 },
    tailC: { x: 130, y: 132 },
    floats: true,
  },
}

/* ── 附肢 ─────────────────────────────────────────── */

function renderLimbs(id: string, geo: FrameGeo, color: string, seed: number): ReactNode {
  const { limbC, limbSpread: sp, sideL, sideR, tailC } = geo
  const rng = mulberry32(seed ^ 0x1a2b)
  switch (id) {
    case 'limb_stub':
      return (
        <g fill={color}>
          {[-0.55, -0.2, 0.2, 0.55].map((f, i) => (
            <rect key={i} x={limbC.x + f * sp - 6.5} y={limbC.y - 6} width={13} height={20} rx={6.5} />
          ))}
        </g>
      )
    case 'limb_tentacles':
      return (
        <g stroke={color} strokeWidth={7.5} strokeLinecap="round" fill="none">
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const x0 = limbC.x + (i - 2.5) * (sp / 2.6)
            const w = (i % 2 === 0 ? 1 : -1) * (5 + rng() * 3.5)
            return <path key={i} d={`M${x0},${limbC.y - 12} c${w},10 ${-w},18 ${w * 0.6},28`} />
          })}
        </g>
      )
    case 'limb_webbed':
      return (
        <g>
          {[-0.4, 0.4].map((f, i) => {
            const x = limbC.x + f * sp
            return (
              <g key={i}>
                <ellipse cx={x} cy={limbC.y + 6} rx={16} ry={9} fill={color} />
                {[-8, 0, 8].map((dx, j) => (
                  <line
                    key={j}
                    x1={x}
                    y1={limbC.y + 4}
                    x2={x + dx}
                    y2={limbC.y + 12}
                    stroke={shade(color, -0.3)}
                    strokeWidth={1.5}
                  />
                ))}
              </g>
            )
          })}
        </g>
      )
    case 'limb_cilia':
      return (
        <g stroke={color} strokeWidth={2.6} strokeLinecap="round">
          {Array.from({ length: 15 }, (_, i) => {
            const f = (i / 14) * 2 - 1
            const x = limbC.x + f * sp * 0.92
            const y = limbC.y - 10 + Math.abs(f) * -6
            return <line key={i} x1={x} y1={y} x2={x + f * 5} y2={y + 13} />
          })}
        </g>
      )
    case 'limb_claws': {
      const claw = 'M0,-13 A13,13 0 1 0 0,13 A5.5,5.5 0 1 1 0,-13 Z'
      return (
        <g fill={color}>
          <g transform={`translate(${sideL.x - 8},${sideL.y}) scale(-1.25,1.25) rotate(-15)`}>
            <path d={claw} />
          </g>
          <g transform={`translate(${sideR.x + 6},${sideR.y + 4}) scale(0.85) rotate(15)`}>
            <path d={claw} />
          </g>
        </g>
      )
    }
    case 'limb_curltail':
      return (
        <g
          transform={`translate(${tailC.x},${tailC.y})`}
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        >
          <path d="M0,0 q20,-2 24,-15 q3,-12 -8,-14 q-10,-2 -11,7 q-1,8 7,8" />
        </g>
      )
    case 'limb_wings':
      return (
        <g fill={color} opacity={0.88}>
          <path
            d={`M${sideL.x},${sideL.y} Q${sideL.x - 30},${sideL.y - 34} ${sideL.x - 46},${sideL.y - 14} Q${sideL.x - 28},${sideL.y - 4} ${sideL.x},${sideL.y + 6} Z`}
          />
          <path
            d={`M${sideR.x},${sideR.y} Q${sideR.x + 30},${sideR.y - 34} ${sideR.x + 46},${sideR.y - 14} Q${sideR.x + 28},${sideR.y - 4} ${sideR.x},${sideR.y + 6} Z`}
          />
        </g>
      )
    case 'limb_vines':
      return (
        <g stroke="#7DA05B" strokeWidth={3.6} strokeLinecap="round" fill="none">
          <path d={`M${sideL.x + 4},${sideL.y} q-16,-6 -18,-24 q-2,-14 9,-17`} />
          <path d={`M${sideR.x - 4},${sideR.y + 6} q16,-4 20,-20 q3,-12 -6,-16`} />
          <ellipse cx={sideL.x - 8} cy={sideL.y - 40} rx={5} ry={3} fill="#7DA05B" stroke="none" transform={`rotate(-30 ${sideL.x - 8} ${sideL.y - 40})`} />
          <ellipse cx={sideR.x + 13} cy={sideR.y - 29} rx={5} ry={3} fill="#7DA05B" stroke="none" transform={`rotate(30 ${sideR.x + 13} ${sideR.y - 29})`} />
        </g>
      )
    default:
      return null
  }
}

/* ── 头部与眼 ─────────────────────────────────────── */

const EYE_BASE = '#F6F1E3'
const PUPIL = '#26221C'
const BLUSH = '#F0908E'

/** 可爱大眼：双高光圆眼 */
function cuteEyes(c: Pt, gap = 13, r = 6.5): ReactNode {
  return (
    <g>
      {[-1, 1].map((s) => (
        <g key={s}>
          <circle cx={c.x + s * gap} cy={c.y} r={r} fill={PUPIL} />
          <circle cx={c.x + s * gap - r * 0.32} cy={c.y - r * 0.35} r={r * 0.36} fill="#FFFFFF" />
          <circle cx={c.x + s * gap + r * 0.34} cy={c.y + r * 0.32} r={r * 0.16} fill="#FFFFFF" opacity={0.9} />
        </g>
      ))}
    </g>
  )
}

/** 全员腮红 */
function blushMarks(c: Pt, gap = 23): ReactNode {
  return (
    <g fill={BLUSH} opacity={0.5}>
      <ellipse cx={c.x - gap} cy={c.y + 9} rx={5.6} ry={3.2} />
      <ellipse cx={c.x + gap} cy={c.y + 9} rx={5.6} ry={3.2} />
    </g>
  )
}

function renderHead(id: string, geo: FrameGeo, secondary: string, accent: string, glowId: string): ReactNode {
  const c = geo.headC
  switch (id) {
    case 'head_mono':
      return (
        <g>
          <circle cx={c.x} cy={c.y} r={17} fill={EYE_BASE} />
          <circle cx={c.x} cy={c.y + 1.5} r={9.5} fill={PUPIL} />
          <circle cx={c.x - 3.2} cy={c.y - 2.2} r={3.4} fill="#FFFFFF" />
          <circle cx={c.x + 3.4} cy={c.y + 4.4} r={1.5} fill="#FFFFFF" opacity={0.9} />
        </g>
      )
    case 'head_droopy':
      return (
        <g>
          {[-1, 1].map((s) => (
            <g key={s} transform={`translate(${c.x + s * 13},${c.y})`}>
              <path d="M-8,-1 Q0,6.5 8,-1" stroke={PUPIL} strokeWidth={2.6} strokeLinecap="round" fill="none" />
              <path d={`M${s * 8},-1 l${s * 3},2.4`} stroke={PUPIL} strokeWidth={2} strokeLinecap="round" />
            </g>
          ))}
        </g>
      )
    case 'head_antennae':
      return (
        <g>
          <g stroke={secondary} strokeWidth={3.4} strokeLinecap="round" fill="none">
            <path d={`M${c.x - 8},${c.y - 14} q-8,-12 -16,-16`} />
            <path d={`M${c.x + 8},${c.y - 14} q8,-12 16,-16`} />
          </g>
          <circle cx={c.x - 24} cy={c.y - 30} r={4.6} fill={accent} />
          <circle cx={c.x + 24} cy={c.y - 30} r={4.6} fill={accent} />
          {cuteEyes(c)}
        </g>
      )
    case 'head_spiral':
      return (
        <g>
          <g fill={accent} stroke={shade(accent, -0.35)} strokeWidth={1.2}>
            <ellipse cx={c.x} cy={c.y - 24} rx={12} ry={5} />
            <ellipse cx={c.x} cy={c.y - 32} rx={9} ry={4.4} />
            <ellipse cx={c.x} cy={c.y - 39} rx={6} ry={3.8} />
            <circle cx={c.x} cy={c.y - 45} r={3.2} />
          </g>
          {cuteEyes(c)}
        </g>
      )
    case 'head_antlers':
      return (
        <g>
          <g stroke={secondary} strokeWidth={3.4} strokeLinecap="round" fill="none">
            <path d={`M${c.x - 10},${c.y - 14} l-6,-16 m6,16 l-13,-8`} />
            <path d={`M${c.x - 16},${c.y - 30} l-6,-5`} />
            <path d={`M${c.x + 10},${c.y - 14} l6,-16 m-6,16 l13,-8`} />
            <path d={`M${c.x + 16},${c.y - 30} l6,-5`} />
          </g>
          {cuteEyes(c)}
        </g>
      )
    case 'head_eyeless':
      return (
        <g fill={PUPIL} opacity={0.8}>
          <circle cx={c.x - 8} cy={c.y} r={2.2} />
          <circle cx={c.x} cy={c.y - 4.5} r={2.2} />
          <circle cx={c.x + 8} cy={c.y} r={2.2} />
        </g>
      )
    case 'head_lantern':
      return (
        <g>
          <g stroke={secondary} strokeWidth={3} strokeLinecap="round" fill="none">
            <path d={`M${c.x - 6},${c.y - 14} q-14,-4 -16,14`} />
            <path d={`M${c.x + 6},${c.y - 14} q14,-4 16,14`} />
          </g>
          {[-1, 1].map((s) => (
            <g key={s}>
              <circle cx={c.x + s * 22} cy={c.y + 2} r={7.5} fill={accent} filter={`url(#${glowId})`} />
              <circle cx={c.x + s * 22} cy={c.y + 2} r={3} fill={PUPIL} />
              <circle cx={c.x + s * 22 - 2} cy={c.y} r={1.2} fill="#FFFFFF" />
            </g>
          ))}
        </g>
      )
    default:
      return cuteEyes(c)
  }
}

/* ── 口器 ─────────────────────────────────────────── */

function renderMouth(id: string, geo: FrameGeo, secondary: string): ReactNode {
  const c = geo.mouthC
  switch (id) {
    case 'mouth_beak':
      return (
        <path
          d={`M${c.x - 6},${c.y - 3} L${c.x + 6},${c.y - 3} L${c.x},${c.y + 8} Z`}
          fill={shade(secondary, -0.2)}
          stroke={shade(secondary, -0.2)}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      )
    case 'mouth_grin':
      return (
        <g>
          <path
            d={`M${c.x - 13},${c.y - 1} Q${c.x},${c.y + 9} ${c.x + 13},${c.y - 1}`}
            stroke={PUPIL}
            strokeWidth={2.8}
            strokeLinecap="round"
            fill="none"
          />
          <path d={`M${c.x - 4},${c.y + 3} a4.4,3.6 0 0 0 8.8,0 z`} fill="#E8919C" />
        </g>
      )
    case 'mouth_curtain':
      return (
        <g stroke={PUPIL} strokeWidth={2.4} strokeLinecap="round" opacity={0.8}>
          {[-10, -5, 0, 5, 10].map((dx, i) => (
            <path key={i} d={`M${c.x + dx},${c.y - 3} q${dx * 0.2},8 0,14`} fill="none" />
          ))}
        </g>
      )
    case 'mouth_sucker':
      return (
        <g stroke={PUPIL} strokeWidth={2} fill="none" opacity={0.85}>
          <circle cx={c.x} cy={c.y + 2} r={9} />
          <circle cx={c.x} cy={c.y + 2} r={5.2} />
          <circle cx={c.x} cy={c.y + 2} r={1.8} fill={PUPIL} />
        </g>
      )
    case 'mouth_tongue':
      return (
        <g>
          <path
            d={`M${c.x - 12},${c.y - 2} Q${c.x},${c.y + 8} ${c.x + 12},${c.y - 2}`}
            stroke={PUPIL}
            strokeWidth={2.8}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M${c.x},${c.y + 3} q12,14 22,9 q8,-4 5,-11`}
            stroke="#C86B78"
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )
    case 'mouth_petal':
      return (
        <g fill="#C98BA6" stroke={shade('#C98BA6', -0.25)} strokeWidth={1}>
          {[0, 90, 45, 135].map((r) => (
            <ellipse key={r} cx={c.x} cy={c.y + 2} rx={3.8} ry={8.5} transform={`rotate(${r} ${c.x} ${c.y + 2})`} />
          ))}
          <circle cx={c.x} cy={c.y + 2} r={2.4} fill={PUPIL} stroke="none" />
        </g>
      )
    case 'mouth_baleen':
      return (
        <g stroke={PUPIL} strokeWidth={2} strokeLinecap="round" opacity={0.8}>
          <path d={`M${c.x - 14},${c.y - 2} h28`} strokeWidth={2.6} />
          {[-12, -8, -4, 0, 4, 8, 12].map((dx, i) => (
            <line key={i} x1={c.x + dx} y1={c.y - 2} x2={c.x + dx} y2={c.y + 7} />
          ))}
        </g>
      )
    default:
      return null
  }
}

/* ── 表皮材质 ─────────────────────────────────────── */

interface SurfaceFx {
  inMask?: ReactNode
  decal?: ReactNode
  bodyOpacity?: number
  /** 应用在蒙版躯体上的滤镜 id 后缀 */
  bodyFilter?: 'fuzz' | 'fur'
}

function surfaceFx(id: string, geo: FrameGeo, colors: { dark: string; accent: string; body: string }, seed: number): SurfaceFx {
  const rng = mulberry32(seed ^ 0x5eaf)
  const top = { x: geo.headC.x, y: geo.headC.y - 20 }
  switch (id) {
    case 'surf_fuzz':
      return {
        bodyFilter: 'fuzz',
        decal: (
          <g stroke={colors.dark} strokeWidth={2.4} strokeLinecap="round" fill="none">
            <path d={`M${top.x - 8},${top.y + 4} q-2,-8 2,-11`} />
            <path d={`M${top.x},${top.y} q0,-9 4,-11`} />
            <path d={`M${top.x + 8},${top.y + 4} q4,-8 1,-12`} />
          </g>
        ),
      }
    case 'surf_fur':
      return {
        bodyFilter: 'fur',
        decal: (
          <g stroke={colors.dark} strokeWidth={2.6} strokeLinecap="round" fill="none">
            {[-14, -7, 0, 7, 14].map((dx, i) => (
              <path key={i} d={`M${top.x + dx},${top.y + 5} q${dx * 0.3},-10 ${dx * 0.15 + 3},-13`} />
            ))}
          </g>
        ),
      }
    case 'surf_slime':
      return {
        inMask: <ellipse cx={geo.headC.x - 14} cy={geo.headC.y - 8} rx={16} ry={9} fill="#FFFFFF" opacity={0.3} transform={`rotate(-25 ${geo.headC.x - 14} ${geo.headC.y - 8})`} />,
        decal: (
          <path
            d={`M${geo.limbC.x + geo.limbSpread * 0.5},${geo.limbC.y - 4} q2,8 -2,12`}
            stroke={colors.body}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
            opacity={0.9}
          />
        ),
      }
    case 'surf_scales':
      return {
        inMask: (
          <g stroke={colors.dark} strokeWidth={1.4} fill="none" opacity={0.3}>
            {Array.from({ length: 24 }, (_, i) => {
              const x = 45 + (i % 6) * 22 + (Math.floor(i / 6) % 2 === 0 ? 0 : 11)
              const y = 78 + Math.floor(i / 6) * 20
              return <path key={i} d={`M${x},${y} a11,9 0 0 0 22,0`} />
            })}
          </g>
        ),
      }
    case 'surf_shell':
      return {
        inMask: (
          <g stroke={colors.dark} strokeWidth={2.6} fill="none" opacity={0.35}>
            <path d="M30,105 q70,-22 140,0" />
            <path d="M30,128 q70,-20 140,0" />
            <path d="M35,150 q65,-18 130,0" />
          </g>
        ),
      }
    case 'surf_gummy':
      return {
        inMask: (
          <ellipse cx={geo.headC.x - 12} cy={geo.headC.y - 12} rx={20} ry={12} fill="#FFFFFF" opacity={0.4} transform={`rotate(-20 ${geo.headC.x - 12} ${geo.headC.y - 12})`} />
        ),
      }
    case 'surf_feather':
      return {
        inMask: (
          <g stroke={colors.dark} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.4}>
            {Array.from({ length: 8 }, (_, i) => {
              const x = 55 + rng() * 90
              const y = 85 + rng() * 70
              return <path key={i} d={`M${x},${y} l4,6 l4,-6`} />
            })}
          </g>
        ),
      }
    case 'surf_moss':
      return {
        decal: (
          <g>
            {[0, 1, 2, 3].map((i) => {
              const x = top.x - 20 + i * 13 + rng() * 5
              const y = top.y + 2 + (i % 2) * 5
              return <ellipse key={i} cx={x} cy={y} rx={8} ry={4.5} fill="#6F8F4F" opacity={0.92} />
            })}
            <g transform={`translate(${top.x + 24},${top.y + 2})`}>
              <line x1={0} y1={0} x2={0} y2={-8} stroke="#D8CBAF" strokeWidth={2.4} />
              <path d="M-6,-8 a6,5 0 0 1 12,0 z" fill="#C0705F" />
            </g>
          </g>
        ),
      }
    case 'surf_gel':
      return {
        bodyOpacity: 0.8,
        inMask: (
          <g fill={colors.accent} opacity={0.75}>
            <circle className="gel-dot gel-d1" cx={85} cy={140} r={4} />
            <circle className="gel-dot gel-d2" cx={110} cy={150} r={3} />
            <circle className="gel-dot gel-d3" cx={100} cy={130} r={2.4} />
          </g>
        ),
      }
    default:
      return {}
  }
}

/* ── 纹样 ─────────────────────────────────────────── */

function renderPattern(id: string, secondary: string, accent: string, seed: number, glowId: string): ReactNode {
  const rng = mulberry32(seed ^ 0x9c1d)
  switch (id) {
    case 'pat_plain':
      return null
    case 'pat_twotone':
      return <rect x={0} y={128} width={200} height={72} fill={secondary} opacity={0.85} />
    case 'pat_stripes':
      return (
        <g transform="rotate(-8 100 120)" fill={secondary} opacity={0.72}>
          {[68, 96, 124, 152].map((y) => (
            <rect key={y} x={-20} y={y} width={240} height={10} rx={5} />
          ))}
        </g>
      )
    case 'pat_spots':
      return (
        <g fill={secondary} opacity={0.85}>
          {Array.from({ length: 6 }, (_, i) => (
            <circle key={i} cx={55 + rng() * 90} cy={80 + rng() * 80} r={3.5 + rng() * 5.5} />
          ))}
        </g>
      )
    case 'pat_eyespots':
      return (
        <g>
          {Array.from({ length: 5 }, (_, i) => {
            const x = 55 + rng() * 90
            const y = 80 + rng() * 80
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={6} fill={accent} opacity={0.9} />
                <circle cx={x} cy={y} r={2.4} fill={PUPIL} />
              </g>
            )
          })}
        </g>
      )
    case 'pat_veins': {
      const d = 'M100,168 q-3,-22 -13,-33 m13,33 q6,-24 16,-34 m-16,-5 q-2,-16 -10,-22'
      return (
        <g className="veins-pulse" fill="none" strokeLinecap="round">
          <path d={d} stroke={accent} strokeWidth={4.5} opacity={0.45} filter={`url(#${glowId})`} />
          <path d={d} stroke={accent} strokeWidth={2} opacity={0.95} />
        </g>
      )
    }
    default:
      return null
  }
}

/* ── 主组件 ───────────────────────────────────────── */

/** 画风（画风实验室探索中）：flat=扁平剪纸 soft=软立体 sticker=贴纸卡通 ink=水彩图鉴 plush=写实毛绒玩偶 */
export type ArtStyle = 'flat' | 'soft' | 'sticker' | 'ink' | 'plush'

export interface CreatureProps {
  traits: Record<SlotId, string>
  theme: ThemeId
  aberrations?: { slot: SlotId; ab: string }[]
  seed: number
  size?: number
  idle?: boolean
  artStyle?: ArtStyle
}

export function Creature({
  traits,
  theme,
  aberrations = [],
  seed,
  size = 160,
  idle = true,
  artStyle = 'sticker',
}: CreatureProps) {
  const rawId = useId()
  const uid = useMemo(() => `c${rawId.replace(/[^a-zA-Z0-9]/g, '')}`, [rawId])

  const has = (ab: string) => aberrations.some((a) => a.ab === ab)
  const unformed = new Set(aberrations.filter((a) => a.ab === 'ab_unformed').map((a) => a.slot))
  const op = (slot: SlotId) => (unformed.has(slot) ? 0.32 : 1)

  const palette = has('ab_discord')
    ? DISCORD_PALETTES[seed % DISCORD_PALETTES.length]
    : THEMES[theme].palette

  const rng = mulberry32(seed ^ 0x77aa)
  // 粉彩化：底色向白偏移，暗部收敛，整体更柔和（可爱治愈方向）
  const body = mix(mix(palette[0], palette[1], rng() * 0.35), '#FFFFFF', 0.16)
  const secondary = palette[1]
  const accent = palette[2]
  const dark = shade(body, -0.24)

  const geo = FRAME_GEO[traits.frame] ?? FRAME_GEO.frame_squat
  const fx = surfaceFx(traits.surface, geo, { dark, accent, body }, seed)

  const maskId = `${uid}-m`
  const glowId = `${uid}-glow`
  const fuzzId = `${uid}-fuzz`
  const furId = `${uid}-fur`
  const blurId = `${uid}-blur`
  const gradId = `${uid}-grad`
  const softBlurId = `${uid}-softb`
  const stickerId = `${uid}-sticker`
  const inkId = `${uid}-ink`

  const softDropId = `${uid}-sdrop`
  const plushId = `${uid}-plush`
  const faceDropId = `${uid}-fdrop`
  const styleFilter =
    artStyle === 'sticker'
      ? `url(#${stickerId})`
      : artStyle === 'ink'
        ? `url(#${inkId})`
        : artStyle === 'soft'
          ? `url(#${softDropId})`
          : artStyle === 'plush'
            ? `url(#${plushId})`
            : undefined
  /** 软立体与毛绒共享体积光（渐变+高光+体积影） */
  const volumetric = artStyle === 'soft' || artStyle === 'plush'

  const bodyFilter = has('ab_overflow')
    ? `url(#${blurId})`
    : fx.bodyFilter === 'fuzz'
      ? `url(#${fuzzId})`
      : fx.bodyFilter === 'fur'
        ? `url(#${furId})`
        : undefined

  const dislocated = aberrations.filter((a) => a.ab === 'ab_dislocate')
  const headShift = dislocated.some((a) => a.slot === 'head') ? 'translate(-13,11) rotate(-9)' : undefined
  const mouthShift =
    dislocated.length > 0 && !dislocated.some((a) => a.slot === 'head')
      ? 'translate(15,-9) rotate(14)'
      : undefined

  const shrink = has('ab_shrink')
  const silent = has('ab_silent')
  const wrapClass = [
    geo.floats ? 'creature-float' : idle && !silent ? 'creature-idle' : '',
    traits.surface === 'surf_gummy' && idle && !silent ? 'creature-gummy' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="怪奇生物">
      <defs>
        <mask id={maskId}>{geo.silhouette}</mask>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation={3.2} />
        </filter>
        <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={2.4} />
        </filter>
        <filter id={fuzzId} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves={2} result="n" seed={seed % 100} />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={4} />
        </filter>
        <filter id={furId} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves={2} result="n" seed={seed % 100} />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={9} />
        </filter>
        {volumetric && (
          <>
            <radialGradient id={gradId} cx="0.35" cy="0.26" r="0.95">
              <stop offset="0%" stopColor={shade(body, 0.38)} />
              <stop offset="48%" stopColor={body} />
              <stop offset="100%" stopColor={shade(body, -0.36)} />
            </radialGradient>
            <filter id={softBlurId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation={7} />
            </filter>
            <filter id={softDropId} x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx={0} dy={3.5} stdDeviation={3} floodColor="#1A120A" floodOpacity={0.38} />
            </filter>
          </>
        )}
        {artStyle === 'plush' && (
          <>
            <filter id={plushId} x="-30%" y="-30%" width="160%" height="160%">
              {/* 轮廓毛边：低频波浪 + 高频细毛 双重扰动 */}
              <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={2} seed={(seed % 40) + 1} result="wave" />
              <feDisplacementMap in="SourceGraphic" in2="wave" scale={5} result="d1" />
              <feTurbulence type="turbulence" baseFrequency="0.8" numOctaves={2} seed={(seed % 40) + 7} result="hair" />
              <feDisplacementMap in="d1" in2="hair" scale={4} result="fuzzed" />
              <feDisplacementMap in="SourceAlpha" in2="wave" scale={5} result="a1" />
              <feDisplacementMap in="a1" in2="hair" scale={4} result="fuzzA" />
              {/* 织物绒面：噪声凹凸 + 漫反射光照 */}
              <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves={3} seed={(seed % 40) + 13} result="bump" />
              <feDiffuseLighting in="bump" lightingColor="#FFFFFF" surfaceScale={2.2} diffuseConstant={1.25} result="cloth">
                <feDistantLight azimuth={235} elevation={62} />
              </feDiffuseLighting>
              <feComposite in="cloth" in2="fuzzA" operator="in" result="clothIn" />
              <feBlend in="fuzzed" in2="clothIn" mode="multiply" result="mult" />
              {/* 补回亮度与饱和度，避免绒面被光照乘算洗淡 */}
              <feComponentTransfer in="mult" result="bright">
                <feFuncR type="linear" slope={1.14} intercept={0.02} />
                <feFuncG type="linear" slope={1.14} intercept={0.02} />
                <feFuncB type="linear" slope={1.14} intercept={0.02} />
              </feComponentTransfer>
              <feColorMatrix in="bright" type="saturate" values="1.28" />
            </filter>
            <filter id={faceDropId} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx={0} dy={1.5} stdDeviation={1.2} floodColor="#2A1F14" floodOpacity={0.35} />
            </filter>
          </>
        )}
        {artStyle === 'sticker' && (
          <filter id={stickerId} x="-25%" y="-25%" width="150%" height="150%">
            <feMorphology in="SourceAlpha" operator="dilate" radius={2} result="d1" />
            <feFlood floodColor="#2E2418" result="inkc" />
            <feComposite in="inkc" in2="d1" operator="in" result="outline" />
            <feMorphology in="SourceAlpha" operator="dilate" radius={5.5} result="d2" />
            <feFlood floodColor="#FFFFFF" result="wf" />
            <feComposite in="wf" in2="d2" operator="in" result="border" />
            <feColorMatrix in="SourceGraphic" type="saturate" values="1.35" result="sat" />
            <feMerge>
              <feMergeNode in="border" />
              <feMergeNode in="outline" />
              <feMergeNode in="sat" />
            </feMerge>
          </filter>
        )}
        {artStyle === 'ink' && (
          <filter id={inkId} x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={3} seed={(seed % 50) + 3} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={4.5} result="disp" />
            <feDisplacementMap in="SourceAlpha" in2="n" scale={4.5} result="dispA" />
            <feMorphology in="dispA" operator="dilate" radius={1.9} result="thick" />
            <feComposite in="thick" in2="dispA" operator="out" result="ring" />
            <feFlood floodColor="#33281A" result="inkc" />
            <feComposite in="inkc" in2="ring" operator="in" result="outline" />
            <feColorMatrix in="disp" type="saturate" values="0.85" result="wash" />
            <feComponentTransfer in="wash" result="lifted">
              <feFuncA type="linear" slope={0.88} />
            </feComponentTransfer>
            <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves={2} seed={(seed % 30) + 9} result="tex" />
            <feColorMatrix
              in="tex"
              type="matrix"
              values="0 0 0 0 0.72  0 0 0 0 0.65  0 0 0 0 0.52  0 0 0 0.5 0"
              result="texc"
            />
            <feComposite in="texc" in2="dispA" operator="in" result="grain" />
            <feBlend in="lifted" in2="grain" mode="multiply" result="washed" />
            <feMerge>
              <feMergeNode in="washed" />
              <feMergeNode in="outline" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* 地影 */}
      {!geo.floats && (
        <ellipse cx={100} cy={184} rx={geo.limbSpread * 0.9 + 12} ry={5} fill="#000" opacity={0.16} />
      )}
      {geo.floats && <ellipse cx={100} cy={182} rx={24} ry={4.5} fill="#000" opacity={0.2} />}

      <g transform={shrink ? 'translate(38,66.5) scale(0.62)' : undefined}>
        <g className={wrapClass || undefined}>
          {/* 异能：微光 */}
          {traits.quirk === 'quirk_glow' && (
            <circle
              className="quirk-glow"
              cx={geo.headC.x}
              cy={(geo.headC.y + geo.limbC.y) / 2}
              r={62}
              fill={accent}
              opacity={0.14}
              filter={`url(#${glowId})`}
            />
          )}

          <g filter={styleFilter}>
            <g opacity={op('limbs')}>{renderLimbs(traits.limbs, geo, dark, seed)}</g>

            <g mask={`url(#${maskId})`} filter={bodyFilter} opacity={(fx.bodyOpacity ?? 1) * op('frame')}>
              <rect width={200} height={200} fill={volumetric ? `url(#${gradId})` : body} />
              <g opacity={op('pattern')}>{renderPattern(traits.pattern, secondary, accent, seed, glowId)}</g>
              <g opacity={op('surface')}>{fx.inMask}</g>
              {volumetric && (
                <g>
                  <ellipse
                    cx={geo.headC.x - 16}
                    cy={geo.headC.y - 12}
                    rx={28}
                    ry={17}
                    fill="#FFFFFF"
                    opacity={0.4}
                    filter={`url(#${softBlurId})`}
                  />
                  <ellipse
                    cx={geo.headC.x - 18}
                    cy={geo.headC.y - 16}
                    rx={10}
                    ry={5.5}
                    fill="#FFFFFF"
                    opacity={0.5}
                    transform={`rotate(-24 ${geo.headC.x - 18} ${geo.headC.y - 16})`}
                  />
                  <ellipse
                    cx={100}
                    cy={geo.limbC.y - 4}
                    rx={60}
                    ry={18}
                    fill="#000000"
                    opacity={0.3}
                    filter={`url(#${softBlurId})`}
                  />
                </g>
              )}
              {artStyle === 'plush' && (
                <g>
                  <ellipse
                    cx={geo.limbC.x}
                    cy={geo.limbC.y - (geo.floats ? 10 : 22)}
                    rx={24}
                    ry={16}
                    fill={mix(body, '#FFFFFF', 0.42)}
                    opacity={0.92}
                  />
                  <ellipse
                    cx={geo.limbC.x}
                    cy={geo.limbC.y - (geo.floats ? 10 : 22)}
                    rx={24}
                    ry={16}
                    fill="none"
                    stroke={shade(body, -0.42)}
                    strokeWidth={1.4}
                    strokeDasharray="3.5 3"
                    opacity={0.65}
                  />
                </g>
              )}
            </g>

            <g opacity={op('surface')}>{fx.decal}</g>
            {artStyle !== 'plush' && (
              <>
                <g opacity={op('head')} transform={headShift}>
                  {renderHead(traits.head, geo, secondary, accent, glowId)}
                  {blushMarks(geo.headC)}
                </g>
                <g opacity={op('mouth')} transform={mouthShift}>
                  {renderMouth(traits.mouth, geo, secondary)}
                </g>
              </>
            )}
          </g>
          {artStyle === 'plush' && (
            /* 毛绒风：脸部件独立于绒面之上，模拟塑料眼+刺绣脸谱 */
            <g filter={`url(#${faceDropId})`}>
              <g opacity={op('head')} transform={headShift}>
                {renderHead(traits.head, geo, secondary, accent, glowId)}
                {blushMarks(geo.headC)}
              </g>
              <g opacity={op('mouth')} transform={mouthShift}>
                {renderMouth(traits.mouth, geo, secondary)}
              </g>
            </g>
          )}
        </g>
      </g>
    </svg>
  )
}
