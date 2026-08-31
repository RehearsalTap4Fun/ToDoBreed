/**
 * @qmonster/generator-core 的最小类型镜像（仅覆盖孵化器用到的 API 面）。
 * 运行时由 vite alias 编译 ../RandomPet 真实源码；此文件只服务 tsc，
 * 避免我们的 typecheck 耦合对方仓库的 TS 版本与严格度设置。
 */

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info'
  code: string
  path?: (string | number)[]
  message?: string
}

export type ThemeId = 'deep-sea' | 'fungal' | 'shadow'

export interface SemanticTraitDef {
  id: string
  semanticSlotId: string
  displayName: string
  flavorText: string
  rarity: 'N' | 'R' | 'L'
  excludes: string[]
  boosts: Record<string, number>
  [key: string]: unknown
}

export interface Catalog {
  version: string
  semanticTraits: SemanticTraitDef[]
  [key: string]: unknown
}

export interface VisualSelection {
  partId: string
  [key: string]: unknown
}

export interface MonsterSpec {
  schemaVersion: string
  catalogVersion: string
  rendererVersion: string
  seed: string
  themeId: ThemeId
  palette: { primary: string; secondary: string; accent: string; [key: string]: unknown }
  visualSlots: Record<string, VisualSelection>
  semanticTraits: Record<string, { primaryTraitId: string; [key: string]: unknown }>
  mutation: { id: string; [key: string]: unknown } | null
  aberrations: { id: string; [key: string]: unknown }[]
  [key: string]: unknown
}

export interface GenerationRequest {
  seed: string
  themeId: ThemeId
  mode: 'normal' | 'mutation' | 'aberration'
  slotRolls?: Record<string, number>
  lockedSelections?: Record<string, string>
}

export interface GenerationResult {
  blocked: boolean
  diagnostics: Diagnostic[]
  spec: MonsterSpec
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; diagnostics: Diagnostic[] }

export declare function parseCatalog(input: unknown): ParseResult<Catalog>
export declare function parseMonsterSpec(input: unknown): ParseResult<MonsterSpec>
export declare function validateMonsterSpecAgainstCatalog(
  spec: MonsterSpec,
  catalog: Catalog,
): Diagnostic[]
export declare function generateMonster(
  request: GenerationRequest,
  catalog: Catalog,
): GenerationResult

export declare const SEMANTIC_SLOT_IDS: readonly string[]
export declare const VISUAL_SLOT_IDS: readonly string[]
