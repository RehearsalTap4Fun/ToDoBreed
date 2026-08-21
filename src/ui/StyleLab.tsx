import { useState } from 'react'
import type { SlotId, ThemeId } from '../core/types'
import { Creature, type ArtStyle } from '../render/Creature'

/** 画风实验室：同一批特征数据 × 多种渲染风格并排对比（?lab=1 进入） */

function slots(arr: string[]): Record<SlotId, string> {
  return {
    frame: arr[0],
    limbs: arr[1],
    head: arr[2],
    mouth: arr[3],
    surface: arr[4],
    pattern: arr[5],
    temperament: arr[6],
    quirk: arr[7],
  }
}

const SPECIMENS: {
  label: string
  theme: ThemeId
  seed: number
  traits: Record<SlotId, string>
  mutation?: string
}[] = [
  {
    label: '幽影 · 蛇形无眼',
    theme: 'shadow',
    seed: 7,
    traits: slots(['frame_serpent', 'limb_curltail', 'head_eyeless', 'mouth_tongue', 'surf_fuzz', 'pat_eyespots', 'temp_timid', 'quirk_glow']),
  },
  {
    label: '深海 · 浮灯水母',
    theme: 'deepsea',
    seed: 11,
    traits: slots(['frame_float', 'limb_tentacles', 'head_lantern', 'mouth_baleen', 'surf_gel', 'pat_veins', 'temp_curious', 'quirk_glow']),
  },
  {
    label: '菌沼 · 苔藓墩子',
    theme: 'fungal',
    seed: 23,
    traits: slots(['frame_squat', 'limb_stub', 'head_spiral', 'mouth_curtain', 'surf_moss', 'pat_spots', 'temp_lazy', 'quirk_bloom']),
  },
  {
    label: '深海 · 羽亭鸟',
    theme: 'deepsea',
    seed: 31,
    traits: slots(['frame_biped', 'limb_wings', 'head_droopy', 'mouth_beak', 'surf_feather', 'pat_stripes', 'temp_zealous', 'quirk_weather']),
  },
  {
    label: '传说 · 银巍巨物',
    theme: 'deepsea',
    seed: 47,
    traits: slots(['frame_giant', 'limb_anchor', 'head_elseeyes', 'mouth_double', 'surf_metal', 'pat_cracklight', 'temp_gloomy', 'quirk_timeskew']),
  },
  {
    label: '变异 · 双头苔墩',
    theme: 'fungal',
    seed: 53,
    traits: slots(['frame_squat', 'limb_stub', 'head_spiral', 'mouth_curtain', 'surf_moss', 'pat_spots', 'temp_lazy', 'quirk_bloom']),
    mutation: 'mut_twoheads',
  },
]

const STYLES: { id: ArtStyle; name: string; desc: string }[] = [
  { id: 'flat', name: '① 扁平剪纸（现状）', desc: '纯色块面，无描边无光影——当前基线' },
  { id: 'soft', name: '② 软立体', desc: '径向渐变 + 顶光高光 + 底部体积影，毛绒玩具质感' },
  { id: 'sticker', name: '③ 贴纸卡通', desc: '粗深描边 + 白色贴纸边 + 提饱和，表情包气质' },
  { id: 'ink', name: '④ 水彩图鉴', desc: '手绘抖动轮廓 + 淡彩晕染，贴合博物志世界观' },
  { id: 'plush', name: '⑤ 写实毛绒玩偶', desc: '织物绒面光照 + 毛边轮廓 + 缝线肚皮布片，塑料眼+刺绣脸' },
]

export function StyleLab() {
  const [dark, setDark] = useState(false)
  return (
    <div className="stylelab">
      <header className="lab-head">
        <h1>画风实验室</h1>
        <p>同一批特征数据 × 五种渲染风格。全部是参数化 SVG，选定方向后 59 条特征零重画迁移。</p>
        <button className="tbtn" onClick={() => setDark(!dark)}>
          背景：{dark ? '工作间深色' : '图鉴纸面'}（点击切换）
        </button>
      </header>

      <div className="lab-grid" style={{ gridTemplateColumns: `170px repeat(${SPECIMENS.length}, 1fr)` }}>
        <div className="lab-corner" />
        {SPECIMENS.map((s) => (
          <div key={s.label} className="lab-col-head">
            {s.label}
          </div>
        ))}
        {STYLES.map((st) => (
          <StyleRow key={st.id} style={st} dark={dark} />
        ))}
      </div>
    </div>
  )
}

function StyleRow({ style, dark }: { style: { id: ArtStyle; name: string; desc: string }; dark: boolean }) {
  return (
    <>
      <div className="lab-row-head">
        <b>{style.name}</b>
        <span>{style.desc}</span>
      </div>
      {SPECIMENS.map((s) => (
        <div key={s.label} className={`lab-cell${dark ? ' dark' : ''}`}>
          <Creature
            traits={s.traits}
            theme={s.theme}
            mutation={s.mutation ?? null}
            seed={s.seed}
            size={168}
            artStyle={style.id}
            idle={false}
          />
        </div>
      ))}
    </>
  )
}
