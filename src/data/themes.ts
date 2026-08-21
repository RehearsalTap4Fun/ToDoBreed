import type { ThemeDef, ThemeId } from '../core/types'

/** MVP 三主题：气质差异最大的深海、菌沼、幽影（§12.1） */
export const THEMES: Record<ThemeId, ThemeDef> = {
  deepsea: {
    id: 'deepsea',
    name: '深海蛋',
    eggDesc: '深蓝玻璃质壳，内部有缓慢上浮的气泡',
    palette: ['#274D6E', '#48A79A', '#EAF3EE'],
    pools: {
      frame: ['frame_serpent', 'frame_fluff', 'frame_float'],
      limbs: ['limb_tentacles', 'limb_webbed', 'limb_cilia'],
      head: ['head_lantern', 'head_mono'],
      mouth: ['mouth_sucker', 'mouth_baleen'],
      surface: ['surf_slime', 'surf_gel', 'surf_scales'],
      pattern: ['pat_veins', 'pat_spots'],
      temperament: ['temp_timid', 'temp_curious'],
      quirk: ['quirk_glow', 'quirk_weather'],
    },
    nameRoots: ['汐', '渊', '泅', '沫'],
  },
  fungal: {
    id: 'fungal',
    name: '菌沼蛋',
    eggDesc: '哑光壳面上长着一小圈活蘑菇',
    palette: ['#57683A', '#8A6B44', '#DCC46A'],
    pools: {
      frame: ['frame_squat', 'frame_umbrella', 'frame_fluff'],
      limbs: ['limb_cilia', 'limb_vines', 'limb_stub'],
      head: ['head_antennae', 'head_spiral'],
      mouth: ['mouth_curtain', 'mouth_petal'],
      surface: ['surf_moss', 'surf_gummy', 'surf_fur'],
      pattern: ['pat_spots', 'pat_twotone'],
      temperament: ['temp_lazy', 'temp_hoarder'],
      quirk: ['quirk_bloom', 'quirk_hum'],
    },
    nameRoots: ['菌', '沼', '苔', '孢'],
  },
  shadow: {
    id: 'shadow',
    name: '幽影蛋',
    eggDesc: '轮廓清晰但内部漆黑，光照不进去',
    palette: ['#2A2633', '#7A68A0', '#E3E6EE'],
    pools: {
      frame: ['frame_float', 'frame_serpent'],
      limbs: ['limb_curltail', 'limb_tentacles'],
      head: ['head_eyeless', 'head_mono'],
      mouth: ['mouth_tongue', 'mouth_curtain'],
      surface: ['surf_fuzz', 'surf_gel'],
      pattern: ['pat_eyespots', 'pat_plain'],
      temperament: ['temp_nocturnal', 'temp_gloomy', 'temp_timid'],
      quirk: ['quirk_shadoweat', 'quirk_hum'],
    },
    nameRoots: ['幽', '噬', '昙', '霭'],
  },
}

export const THEME_IDS: ThemeId[] = ['deepsea', 'fungal', 'shadow']

/** 色彩失谐畸变使用的失谐色板 */
export const DISCORD_PALETTES: [string, string, string][] = [
  ['#B0483A', '#3AB0A0', '#E8D84A'],
  ['#8A3A9E', '#9EB03A', '#F0E6D8'],
  ['#3A55B0', '#E07B39', '#D8F0E0'],
]
