/** @qmonster/renderer-canvas 的最小类型镜像（仅孵化器用到的 API 面），说明同 generator-core.d.ts */
import type { Catalog, Diagnostic, MonsterSpec } from './generator-core'

export interface ImageResolver {
  resolve(assetPath: string): Promise<CanvasImageSource> | CanvasImageSource
}

export interface RenderOptions {
  width: number
  height: number
  includeGroundShadow: boolean
  applyPaletteMasks: boolean
}

export interface RenderResult {
  diagnostics: Diagnostic[]
  [key: string]: unknown
}

export declare function renderMonster(
  context: CanvasRenderingContext2D,
  spec: MonsterSpec,
  catalog: Catalog,
  resolver: ImageResolver,
  options: RenderOptions,
): Promise<RenderResult>

export declare function exportCanvas(
  canvas: HTMLCanvasElement,
  mime: 'image/webp' | 'image/png',
): Promise<Blob>
