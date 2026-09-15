import type { Coat, Expression, FelineSlot } from './sdk'
import type { AnyMutationId } from './mutations'
import type { Egg, ThemeId } from '../../core/types'
import { THEMES } from '../../data/themes'

/**
 * gen3 主题表：主题 = 花纹权重 + 表情偏好 + 标志异变 + 命名词根。
 * v0.10 的 6 个异变各作为一个主题的标志（可辨识度来自标志异变，花纹只做底色倾向）。
 * 原「菌沼」暂不设：现无菌类素材，待 RandomPet 出菌伞类异变后再加回。
 */
export type FelineThemeId = 'deepsea' | 'shadow' | 'ember' | 'forest' | 'sky' | 'regal'

export type EggDeco = 'deepsea' | 'fungal' | 'shadow' | 'ember' | 'sky' | 'regal'

export interface FelineTheme {
  id: FelineThemeId
  name: string
  tagline: string
  /** 蛋的名字、描述、[主色, 辅色, 点缀色] 与壳面装饰风格 */
  eggName: string
  eggDesc: string
  palette: [string, string, string]
  eggDeco: EggDeco
  /** 旧代码路径（命运骰、旧图鉴分页）回退用的旧主题 */
  legacyTheme: ThemeId
  nameRoots: string[]
  coats: { item: Coat; w: number }[]
  expressions: { item: Expression; w: number }[]
  /** 标志异变（N 级）：正常态最常见的那一处，主题辨识度所在 */
  signature: AnyMutationId
  /** 次级异变：变异态优先补上的 */
  secondary: AnyMutationId[]
  /** 亲和异变：R/L 级里更常落到本主题的那些（待素材期间不影响渲染） */
  affinity: AnyMutationId[]
}

export const FELINE_THEMES: FelineTheme[] = [
  {
    id: 'deepsea',
    name: '深海',
    tagline: '潮汐与冷光，鳍耳是它的印记',
    eggName: '深海蛋',
    eggDesc: '深蓝玻璃质壳，内部有缓慢上浮的气泡',
    palette: ['#274D6E', '#48A79A', '#EAF3EE'],
    eggDeco: 'deepsea',
    legacyTheme: 'deepsea',
    nameRoots: ['汐', '潮', '澜', '渊'],
    coats: [
      { item: 'colorpoint', w: 3 },
      { item: 'tuxedo', w: 2 },
      { item: 'calico', w: 1 },
    ],
    expressions: [
      { item: 'parted-mouth', w: 2 },
      { item: 'tongue-tip', w: 1 },
      { item: 'small-fangs', w: 1 },
    ],
    signature: 'fin-ears',
    secondary: ['forked-tail-tip'],
    affinity: ['frill-neck'],
  },
  {
    id: 'shadow',
    name: '幽影',
    tagline: '夜色里晃着分叉的尾尖',
    eggName: '幽影蛋',
    eggDesc: '轮廓清晰但内部漆黑，光照不进去',
    palette: ['#2A2633', '#7A68A0', '#E3E6EE'],
    eggDeco: 'shadow',
    legacyTheme: 'shadow',
    nameRoots: ['幽', '夜', '影', '昧'],
    coats: [
      { item: 'tuxedo', w: 3 },
      { item: 'colorpoint', w: 2 },
      { item: 'brown-tabby', w: 1 },
    ],
    expressions: [
      { item: 'small-fangs', w: 2 },
      { item: 'parted-mouth', w: 1 },
      { item: 'tongue-tip', w: 1 },
    ],
    signature: 'forked-tail-tip',
    secondary: ['dragon-horns'],
    affinity: ['dragon-wings'],
  },
  {
    id: 'ember',
    name: '炎烬',
    tagline: '余烬里长出一对小龙角',
    eggName: '炎烬蛋',
    eggDesc: '壳面温热，裂缝里透出余烬的橘光',
    palette: ['#8A3A2A', '#E07B39', '#FFE2B8'],
    eggDeco: 'ember',
    legacyTheme: 'shadow',
    nameRoots: ['焰', '烬', '赤', '燎'],
    coats: [
      { item: 'orange-white', w: 3 },
      { item: 'rosetted', w: 2 },
      { item: 'calico', w: 1 },
    ],
    expressions: [
      { item: 'small-fangs', w: 2 },
      { item: 'tongue-tip', w: 1 },
      { item: 'parted-mouth', w: 1 },
    ],
    signature: 'dragon-horns',
    secondary: ['small-wings'],
    affinity: ['flame-tail', 'dragon-wings'],
  },
  {
    id: 'forest',
    name: '林苔',
    tagline: '顶着鹿角的林间访客',
    eggName: '林苔蛋',
    eggDesc: '壳上覆着一层薄苔，偶尔冒出一朵小蘑菇',
    palette: ['#3F5A34', '#8A6B44', '#D8E6B0'],
    eggDeco: 'fungal',
    legacyTheme: 'fungal',
    nameRoots: ['苔', '林', '榛', '栎'],
    coats: [
      { item: 'brown-tabby', w: 3 },
      { item: 'rosetted', w: 2 },
      { item: 'calico', w: 1 },
    ],
    expressions: [
      { item: 'parted-mouth', w: 2 },
      { item: 'tongue-tip', w: 2 },
      { item: 'small-fangs', w: 1 },
    ],
    signature: 'antlers',
    secondary: ['small-lion-mane'],
    affinity: ['frill-neck', 'feathered-wings'],
  },
  {
    id: 'sky',
    name: '云翼',
    tagline: '背着小翅膀的云上猫',
    eggName: '云翼蛋',
    eggDesc: '壳色像晴天，摸上去比看上去轻',
    palette: ['#5A86C9', '#B8D8F5', '#FFFFFF'],
    eggDeco: 'sky',
    legacyTheme: 'deepsea',
    nameRoots: ['云', '羽', '霁', '岚'],
    coats: [
      { item: 'calico', w: 3 },
      { item: 'orange-white', w: 2 },
      { item: 'colorpoint', w: 1 },
    ],
    expressions: [
      { item: 'tongue-tip', w: 2 },
      { item: 'parted-mouth', w: 2 },
      { item: 'small-fangs', w: 1 },
    ],
    signature: 'small-wings',
    secondary: ['fin-ears'],
    affinity: ['feathered-wings', 'halo'],
  },
  {
    id: 'regal',
    name: '曜庭',
    tagline: '金豹点配小狮鬃的王庭气派',
    eggName: '曜庭蛋',
    eggDesc: '金棕壳面有细密的豹点暗纹',
    palette: ['#7A5A1E', '#D4A63A', '#FFF1C9'],
    eggDeco: 'regal',
    legacyTheme: 'fungal',
    nameRoots: ['曜', '金', '璃', '煌'],
    coats: [
      { item: 'rosetted', w: 3 },
      { item: 'colorpoint', w: 2 },
      { item: 'brown-tabby', w: 1 },
    ],
    expressions: [
      { item: 'parted-mouth', w: 2 },
      { item: 'small-fangs', w: 2 },
      { item: 'tongue-tip', w: 1 },
    ],
    signature: 'small-lion-mane',
    secondary: ['antlers'],
    affinity: ['halo', 'feathered-wings'],
  },
]

export const FELINE_THEME_MAP: Record<FelineThemeId, FelineTheme> = Object.fromEntries(
  FELINE_THEMES.map((t) => [t.id, t]),
) as Record<FelineThemeId, FelineTheme>

export const COAT_NAMES: Record<Coat, string> = {
  'brown-tabby': '棕灰虎斑',
  'orange-white': '橘白双色',
  tuxedo: '黑白燕尾服',
  calico: '三花',
  colorpoint: '奶油重点色',
  rosetted: '金棕豹点',
}

export const EXPRESSION_NAMES: Record<Expression, string> = {
  'parted-mouth': '自然微张嘴',
  'small-fangs': '两颗小牙',
  'tongue-tip': '轻吐舌',
}

export const FELINE_SLOT_NAMES: Record<FelineSlot, string> = {
  coat: '花纹',
  expression: '表情',
  crown: '额顶',
  ears: '耳朵',
  neck: '颈部',
  back: '背部',
  tailTip: '尾尖',
}

/** 蛋的展示名：gen3 读小猫主题，旧蛋读旧主题 */
export function eggDisplayName(egg: Pick<Egg, 'theme' | 'ftheme'>): string {
  return egg.ftheme ? FELINE_THEME_MAP[egg.ftheme].eggName : THEMES[egg.theme].name
}

/** 生物/蛋的主题展示名（不带"蛋"字） */
export function themeDisplayName(x: Pick<Egg, 'theme' | 'ftheme'>): string {
  return x.ftheme ? FELINE_THEME_MAP[x.ftheme].name : THEMES[x.theme].name.replace(/蛋$/, '')
}
