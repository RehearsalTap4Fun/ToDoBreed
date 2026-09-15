import type { Coat, Expression } from './sdk'
import type { AnyMutationId } from './mutations'

/**
 * gen3 主题表：主题 = 花纹权重 + 表情偏好 + 标志异变 + 命名词根。
 * v0.10 的 6 个异变各作为一个主题的标志（可辨识度来自标志异变，花纹只做底色倾向）。
 * 原「菌沼」暂不设：现无菌类素材，待 RandomPet 出菌伞类异变后再加回。
 */
export type FelineThemeId = 'deepsea' | 'shadow' | 'ember' | 'forest' | 'sky' | 'regal'

export interface FelineTheme {
  id: FelineThemeId
  name: string
  tagline: string
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
