import type { AberrationDef, TraitDef } from '../core/types'

/**
 * 特征库（设计文档 §07）：
 * v0.1 每槽全部普通级 + 精选稀有级共 59 条；v0.2 加入传说级 18 条，共 77 条。
 */
export const TRAITS: TraitDef[] = [
  // ── 槽位一 · 体型骨架 ────────────────────────────
  { id: 'frame_fluff', slot: 'frame', name: '团絮形', rarity: 'N', nameChar: '絮', flavor: '蜷成一团的蓬松球体，看不出头尾' },
  { id: 'frame_serpent', slot: 'frame', name: '修长蛇形', rarity: 'N', nameChar: '蜒', flavor: '细长柔韧，惯于缠绕工作间的栖木', boosts: { limb_curltail: 1.5 } },
  { id: 'frame_squat', slot: 'frame', name: '矮墩形', rarity: 'N', nameChar: '墩', flavor: '重心极低，走路像一块挪动的年糕' },
  { id: 'frame_quad', slot: 'frame', name: '四足伏行', rarity: 'N', nameChar: '伏', flavor: '标准兽形骨架，怪奇感全靠其余部位' },
  { id: 'frame_biped', slot: 'frame', name: '双足直立', rarity: 'N', nameChar: '亭', flavor: '站得笔直，显得莫名郑重' },
  { id: 'frame_segmented', slot: 'frame', name: '多节虫形', rarity: 'N', nameChar: '节', flavor: '分节身躯，行进时波浪般起伏' },
  { id: 'frame_umbrella', slot: 'frame', name: '伞盖形', rarity: 'R', nameChar: '伞', flavor: '顶部展开成伞状，躯干垂在下方', boosts: { limb_tentacles: 2, limb_cilia: 2 } },
  { id: 'frame_float', slot: 'frame', name: '飘浮无足', rarity: 'R', nameChar: '浮', flavor: '离地三寸悬浮，从不落地', excludes: ['limb_stub', 'limb_webbed'] },
  { id: 'frame_tiny', slot: 'frame', name: '掌上微型', rarity: 'L', nameChar: '芥', flavor: '小到能住进茶杯，图鉴里配放大镜图标' },
  { id: 'frame_giant', slot: 'frame', name: '庞然巨物', rarity: 'L', nameChar: '巍', flavor: '大到工作间为它单独扩建了一格' },
  { id: 'frame_twin', slot: 'frame', name: '双躯并联', rarity: 'L', nameChar: '双', flavor: '两个身体共享一个意识，行动完全同步' },

  // ── 槽位二 · 附肢 ────────────────────────────────
  { id: 'limb_stub', slot: 'limbs', name: '短圆四肢', rarity: 'N', nameChar: '笃', flavor: '圆滚滚的小短腿，跑起来很努力' },
  { id: 'limb_tentacles', slot: 'limbs', name: '触手束', rarity: 'N', nameChar: '绻', flavor: '六根灵活的触手，各有分工' },
  { id: 'limb_webbed', slot: 'limbs', name: '蹼足', rarity: 'N', nameChar: '蹼', flavor: '走路啪嗒啪嗒响的一对蹼' },
  { id: 'limb_cilia', slot: 'limbs', name: '纤毛裙边', rarity: 'N', nameChar: '纤', flavor: '身体下缘一圈细密纤毛，滑行移动' },
  { id: 'limb_claws', slot: 'limbs', name: '螯钳一对', rarity: 'N', nameChar: '螯', flavor: '一大一小，大的用来撑场面' },
  { id: 'limb_curltail', slot: 'limbs', name: '细长卷尾', rarity: 'N', nameChar: '蜷', flavor: '能卷住东西的第五只手' },
  { id: 'limb_wings', slot: 'limbs', name: '翼膜', rarity: 'R', nameChar: '翎', flavor: '能短距离滑翔，落点堪忧' },
  { id: 'limb_vines', slot: 'limbs', name: '藤蔓卷须', rarity: 'R', nameChar: '蔓', flavor: '植物性的卷须，晒太阳时会舒展' },
  { id: 'limb_manyfingers', slot: 'limbs', name: '十二指细手', rarity: 'L', nameChar: '拈', flavor: '一双有十二根手指的手，极其灵巧' },
  { id: 'limb_anchor', slot: 'limbs', name: '锚形重尾', rarity: 'L', nameChar: '锚', flavor: '尾部是一枚沉重的锚，睡觉时定在原地' },

  // ── 槽位三 · 头部与眼 ────────────────────────────
  { id: 'head_mono', slot: 'head', name: '独眼', rarity: 'N', nameChar: '瞳', flavor: '一只占了半张脸的大眼，情绪全写在里面' },
  { id: 'head_droopy', slot: 'head', name: '双目下垂', rarity: 'N', nameChar: '倦', flavor: '永远一副刚睡醒的样子' },
  { id: 'head_antennae', slot: 'head', name: '触角天线', rarity: 'N', nameChar: '芒', flavor: '一对天线，时常接收不明信号' },
  { id: 'head_spiral', slot: 'head', name: '螺旋独角', rarity: 'N', nameChar: '旋', flavor: '头顶一根发条似的角' },
  { id: 'head_antlers', slot: 'head', name: '鹿角分叉', rarity: 'N', nameChar: '茸', flavor: '角的分叉上偶尔停着小飞虫' },
  { id: 'head_eyeless', slot: 'head', name: '无眼', rarity: 'R', nameChar: '窈', flavor: '以头部的孔洞感知世界，反而最敏锐', boosts: { pat_eyespots: 3 } },
  { id: 'head_lantern', slot: 'head', name: '灯笼垂眼', rarity: 'R', nameChar: '灯', flavor: '眼睛垂在触须末端，像提着两盏灯' },
  { id: 'head_elseeyes', slot: 'head', name: '眼生他处', rarity: 'L', nameChar: '觅', flavor: '眼睛长在腹部，头顶一片光滑' },
  { id: 'head_vortexface', slot: 'head', name: '漩涡面容', rarity: 'L', nameChar: '涡', flavor: '面部是一个缓慢旋转的漩涡' },
  { id: 'head_detach', slot: 'head', name: '可拆卸头', rarity: 'L', nameChar: '离', flavor: '睡觉时把头取下来放在一边' },

  // ── 槽位四 · 口器 ────────────────────────────────
  { id: 'mouth_beak', slot: 'mouth', name: '小尖喙', rarity: 'N', nameChar: '啄', flavor: '啄东西时发出清脆的嗒嗒声' },
  { id: 'mouth_grin', slot: 'mouth', name: '阔口咧嘴', rarity: 'N', nameChar: '哈', flavor: '嘴角咧到耳根，看起来永远在笑' },
  { id: 'mouth_curtain', slot: 'mouth', name: '须帘', rarity: 'N', nameChar: '帘', flavor: '垂须遮住口部，进食时才掀开' },
  { id: 'mouth_sucker', slot: 'mouth', name: '吸盘口', rarity: 'N', nameChar: '吸', flavor: '圆形吸盘口，喜欢吸在玻璃上' },
  { id: 'mouth_tongue', slot: 'mouth', name: '长卷舌', rarity: 'N', nameChar: '舔', flavor: '舌头是身长的两倍，卷取一切' },
  { id: 'mouth_petal', slot: 'mouth', name: '花瓣口', rarity: 'R', nameChar: '蕾', flavor: '口部平时闭合如花苞，进食时四瓣展开', boosts: { quirk_bloom: 2 } },
  { id: 'mouth_baleen', slot: 'mouth', name: '滤食鲸须', rarity: 'R', nameChar: '鲸', flavor: '从空气里滤食看不见的微粒' },
  { id: 'mouth_ventriloquist', slot: 'mouth', name: '腹语孔', rarity: 'L', nameChar: '喃', flavor: '声音从身体的别处发出来' },
  { id: 'mouth_double', slot: 'mouth', name: '双重口', rarity: 'L', nameChar: '叠', flavor: '口中还有一张更小的口，用途不明' },

  // ── 槽位五 · 表皮材质 ────────────────────────────
  { id: 'surf_fuzz', slot: 'surface', name: '短绒毛', rarity: 'N', nameChar: '绒', flavor: '摸起来像上好的天鹅绒' },
  { id: 'surf_fur', slot: 'surface', name: '厚绒毛', rarity: 'N', nameChar: '氅', flavor: '蓬松到看不清真实体型' },
  { id: 'surf_slime', slot: 'surface', name: '湿滑黏膜', rarity: 'N', nameChar: '润', flavor: '永远水润，经过的地方留下微光痕迹' },
  { id: 'surf_scales', slot: 'surface', name: '细鳞', rarity: 'N', nameChar: '鳞', flavor: '细密的鳞片，光下呈现流动的光泽' },
  { id: 'surf_shell', slot: 'surface', name: '硬质甲壳', rarity: 'N', nameChar: '甲', flavor: '敲起来梆梆响，本人对此很自豪' },
  { id: 'surf_gummy', slot: 'surface', name: '软胶质感', rarity: 'N', nameChar: '糯', flavor: '戳一下会duang地弹回来' },
  { id: 'surf_feather', slot: 'surface', name: '羽被', rarity: 'N', nameChar: '羽', flavor: '一身细羽，换羽期工作间会飘毛' },
  { id: 'surf_moss', slot: 'surface', name: '苔藓覆层', rarity: 'R', nameChar: '苔', flavor: '身上长着活的苔藓，雨天格外翠绿', boosts: { quirk_bloom: 2 } },
  { id: 'surf_gel', slot: 'surface', name: '半透明凝胶', rarity: 'R', nameChar: '澈', flavor: '能隐约看见体内缓慢漂浮的光点' },
  { id: 'surf_metal', slot: 'surface', name: '金属冷光', rarity: 'L', nameChar: '银', flavor: '金属质感的冷光表面，指纹会留在上面', boosts: { quirk_static: 3 } },
  { id: 'surf_mist', slot: 'surface', name: '雾缘', rarity: 'L', nameChar: '霭', flavor: '身体的轮廓边缘化为薄雾，摸不到确切的边界' },

  // ── 槽位六 · 纹样 ────────────────────────────────
  { id: 'pat_plain', slot: 'pattern', name: '纯色哑光', rarity: 'N', nameChar: '素', flavor: '一色到底，气质极简' },
  { id: 'pat_twotone', slot: 'pattern', name: '双色拼接', rarity: 'N', nameChar: '拼', flavor: '身体在某条线处干脆地换了颜色' },
  { id: 'pat_stripes', slot: 'pattern', name: '条纹', rarity: 'N', nameChar: '纹', flavor: '规则的环状条纹' },
  { id: 'pat_spots', slot: 'pattern', name: '圆斑', rarity: 'N', nameChar: '点', flavor: '大小不一的圆斑点' },
  { id: 'pat_eyespots', slot: 'pattern', name: '眼状斑', rarity: 'R', nameChar: '眈', flavor: '许多长得像眼睛的斑，有些好像在眨' },
  { id: 'pat_veins', slot: 'pattern', name: '荧光脉络', rarity: 'R', nameChar: '荧', flavor: '皮下脉络发出荧光，随呼吸明灭' },
  { id: 'pat_cracklight', slot: 'pattern', name: '裂纹透光', rarity: 'L', nameChar: '隙', flavor: '体表裂纹中透出内里的光' },
  { id: 'pat_daynight', slot: 'pattern', name: '昼夜反色', rarity: 'L', nameChar: '昼', flavor: '白天与黑夜配色完全互换' },

  // ── 槽位七 · 性格气质 ────────────────────────────
  { id: 'temp_timid', slot: 'temperament', name: '怯懦', rarity: 'N', nameChar: '怯', flavor: '有动静就躲到桌子底下，只露半只眼' },
  { id: 'temp_curious', slot: 'temperament', name: '好奇', rarity: 'N', nameChar: '探', flavor: '总凑到屏幕最前面看你在干什么' },
  { id: 'temp_lazy', slot: 'temperament', name: '慵懒', rarity: 'N', nameChar: '酣', flavor: '一天睡二十个小时，剩下四小时打哈欠' },
  { id: 'temp_restless', slot: 'temperament', name: '焦躁', rarity: 'N', nameChar: '惴', flavor: '在待办板下面来回踱步，替你着急' },
  { id: 'temp_zealous', slot: 'temperament', name: '过度热情', rarity: 'N', nameChar: '欢', flavor: '你每完成一条待办它都欢呼庆祝' },
  { id: 'temp_nocturnal', slot: 'temperament', name: '夜行', rarity: 'N', nameChar: '宵', flavor: '白天一动不动装标本，深夜活跃', boosts: { quirk_glow: 2 } },
  { id: 'temp_gloomy', slot: 'temperament', name: '忧郁', rarity: 'R', nameChar: '郁', flavor: '常望着窗外发呆，雨天心情反而好' },
  { id: 'temp_hoarder', slot: 'temperament', name: '收藏癖', rarity: 'R', nameChar: '珍', flavor: '收集亮晶晶的小东西堆在自己窝里' },
  { id: 'temp_mimic', slot: 'temperament', name: '模仿者', rarity: 'L', nameChar: '仿', flavor: '会模仿你完成待办时的动作，惟妙惟肖' },

  // ── 槽位八 · 异能怪癖 ────────────────────────────
  { id: 'quirk_glow', slot: 'quirk', name: '微光', rarity: 'N', nameChar: '萤', flavor: '黑暗中发出萤火虫般的微光' },
  { id: 'quirk_weather', slot: 'quirk', name: '预报天气', rarity: 'N', nameChar: '霁', flavor: '下雨前会提前竖起耳朵或触角' },
  { id: 'quirk_hum', slot: 'quirk', name: '低鸣安神', rarity: 'N', nameChar: '吟', flavor: '发出白噪音般的呼噜声' },
  { id: 'quirk_static', slot: 'quirk', name: '静电', rarity: 'N', nameChar: '电', flavor: '摸它会啪的一下，它自己也吓一跳' },
  { id: 'quirk_shadoweat', slot: 'quirk', name: '食影', rarity: 'R', nameChar: '噬', flavor: '吃掉小块阴影，被吃过的地方亮一点' },
  { id: 'quirk_bloom', slot: 'quirk', name: '催花', rarity: 'R', nameChar: '芽', flavor: '它附近的绿植长得格外好' },
  { id: 'quirk_dreamvisit', slot: 'quirk', name: '梦境串门', rarity: 'L', nameChar: '梦', flavor: '据说会出现在主人的梦里，无法证实' },
  { id: 'quirk_timeskew', slot: 'quirk', name: '时感错乱', rarity: 'L', nameChar: '晷', flavor: '它周围的钟表走得略慢' },
  { id: 'quirk_bilocation', slot: 'quirk', name: '二重存在', rarity: 'L', nameChar: '幻', flavor: '极偶尔在两个地方被同时看到' },
]

export const TRAIT_MAP: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.id, t]))

/** 畸变表（§07.11）——风险孵化时随机覆盖 1–2 个特征槽 */
export const ABERRATIONS: AberrationDef[] = [
  { id: 'ab_dislocate', name: '错位', desc: '某个器官长在了不该长的位置，它已经习惯了' },
  { id: 'ab_unformed', name: '未成形', desc: '某个槽位呈半透明的未完成态，像铅笔稿' },
  { id: 'ab_discord', name: '色彩失谐', desc: '配色脱离主题色板，刺目却有种奇异的美' },
  { id: 'ab_silent', name: '静默', desc: '没有性格动画，只是安静地待着，偶尔眨眼' },
  { id: 'ab_overflow', name: '外溢', desc: '轮廓超出了身体应有的范围，边缘模糊地晕开' },
  { id: 'ab_shrink', name: '逆生长', desc: '孵化后比蛋还小，据档案记载还在缓慢变小' },
]

export const ABERRATION_MAP: Record<string, AberrationDef> = Object.fromEntries(
  ABERRATIONS.map((a) => [a.id, a]),
)

/** 变异表（§07.10）——正常孵化时按变异率判定，等概率抽取，图鉴带金边徽章 */
export const MUTATIONS: AberrationDef[] = [
  { id: 'mut_twoheads', name: '双头', desc: '多了一个头，两个头性格微妙不同' },
  { id: 'mut_albino', name: '白化', desc: '全身褪为月白，纹样若隐若现' },
  { id: 'mut_melanistic', name: '墨化', desc: '全身纯黑，只余眼睛发光' },
  { id: 'mut_translucent', name: '透明化', desc: '身体半透明，可见体内缓慢漂浮的光点' },
  { id: 'mut_mirror', name: '镜像双生', desc: '孵出一对镜像双子，图鉴中同占一格' },
  { id: 'mut_extreme', name: '体型极端化', desc: '在原体型基础上极大或极小' },
  { id: 'mut_symbiote', name: '共生小体', desc: '身上住着一只豆粒大的共生小生物' },
  { id: 'mut_afterimage', name: '残影', desc: '移动时留下半秒的残影' },
]

export const MUTATION_MAP: Record<string, AberrationDef> = Object.fromEntries(
  MUTATIONS.map((m) => [m.id, m]),
)
