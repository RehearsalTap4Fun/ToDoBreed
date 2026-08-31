import {
  generateMonster,
  type Catalog,
  type Diagnostic,
  type MonsterSpec,
} from '@qmonster/generator-core'
import { renderMonster } from '@qmonster/renderer-canvas'
import { qmonsterResolver } from './image-resolver'

export type QMode = 'normal' | 'mutation' | 'aberration'

/** 统一渲染尺寸：身份质检与最终立绘同尺寸，保证重试序列一致 */
export const QMONSTER_RENDERER_SIZE = 1024
export type QTheme = 'deep-sea' | 'fungal' | 'shadow'

/** 孵化器主题 → QMonster 主题 */
export const THEME_TO_Q: Record<'deepsea' | 'fungal' | 'shadow', QTheme> = {
  deepsea: 'deep-sea',
  fungal: 'fungal',
  shadow: 'shadow',
}

const hasError = (diagnostics: Diagnostic[]) =>
  diagnostics.some((item) => item.severity === 'error')

export interface QHatchResult {
  spec: MonsterSpec
  diagnostics: Diagnostic[]
}

/**
 * 生成 MonsterSpec（确定性：同 seed+主题+模式+目录版本 → 同一只）。
 * 模式由孵化器引擎的既有判定映射（正常/变异/畸变），不使用 adapter 内部的重掷逻辑。
 */
export function generateSpec(
  seed: string,
  theme: QTheme,
  mode: QMode,
  catalog: Catalog,
): QHatchResult {
  const generated = generateMonster({ seed, themeId: theme, mode }, catalog)
  if (generated.blocked || hasError(generated.diagnostics)) {
    throw new Error(
      `QMONSTER_GENERATE:${generated.diagnostics.map((d) => d.code).join(',') || 'blocked'}`,
    )
  }
  return { spec: generated.spec, diagnostics: generated.diagnostics }
}

/**
 * 确定性重试孵化：任意 seed 可能生成渲染质检不过的组合（脸部越界/插槽缺失等 error 诊断），
 * 按 `seed → seed#1 → seed#2 …` 派生序列逐个尝试，直到生成+渲染全部通过。
 * 同一 baseSeed 永远收敛到同一只（防刷新重掷成立）。
 */
export async function hatchValidSpec(
  baseSeed: string,
  theme: QTheme,
  mode: QMode,
  catalog: Catalog,
  canvas: HTMLCanvasElement,
  maxAttempts = 20,
): Promise<QHatchResult & { attempt: number }> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seed = attempt === 0 ? baseSeed : `${baseSeed}#${attempt}`
    try {
      const { spec, diagnostics } = generateSpec(seed, theme, mode, catalog)
      const renderDiags = await renderSpecToCanvas(spec, catalog, canvas, { groundShadow: true })
      return { spec, diagnostics: [...diagnostics, ...renderDiags], attempt }
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`QMONSTER_EXHAUSTED:${maxAttempts} 次尝试均未通过质检（${String(lastError)}）`)
}

/** 把 MonsterSpec 渲染到给定画布（透明背景），返回诊断 */
export async function renderSpecToCanvas(
  spec: MonsterSpec,
  catalog: Catalog,
  canvas: HTMLCanvasElement,
  options?: { groundShadow?: boolean },
): Promise<Diagnostic[]> {
  const size = canvas.width
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('QMONSTER_RENDER:NO_CONTEXT')
  context.clearRect(0, 0, canvas.width, canvas.height)
  const rendered = await renderMonster(
    context,
    spec,
    catalog,
    qmonsterResolver(spec.catalogVersion),
    {
      width: size,
      height: size,
      includeGroundShadow: options?.groundShadow ?? false,
      applyPaletteMasks: true,
    },
  )
  if (hasError(rendered.diagnostics)) {
    throw new Error(`QMONSTER_RENDER:${rendered.diagnostics.map((d) => d.code).join(',')}`)
  }
  return rendered.diagnostics
}
