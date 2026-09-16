import * as vendored from './vendor/qmonster.js'
import { OFFLINE_BASE, ensureOfflineRuntime, isOfflineMode, offlineRuntimeReady } from './offline'

/**
 * QMonster v0.10「小猫组合」孵化 SDK：加载器 + 类型镜像。
 * 产物来自 RandomPet master `npm run build` → dist/hatchery（qmonster.js + snapshot.json + 目录 + 44 张 PNG），
 * 由 `npm run sync:hatchery` 同步到 qmonster-assets/hatchery/<runtimeRevision>/（经 /qmonster/ 静态托管），
 * 同时把 qmonster.js 拷到 vendor/ 静态内联进应用（单文件形态也能用；file:// 下素材走 offline.ts 的注入通道）。
 * 按对接指南 v3.0：只消费产物不引源码；发布目录按 runtimeRevision 固定且不可变；URL 来自部署配置而非存档。
 */

export const FELINE_RUNTIME_REVISION =
  '942d401f8013f4def2ff027d0839a34ad58a608774f532629d0845d318994cf4'
/** 协议兼容值：SDK 的 spec.catalogVersion 固定为此字符串（与目录名 v0.10.0 分开管理，勿改） */
export const FELINE_CATALOG_VERSION = '0.10.0-candidate.1'
export const FELINE_RELEASE_BASE = `/qmonster/hatchery/${FELINE_RUNTIME_REVISION}/`
export const FELINE_CATALOG_FILE = 'packages/asset-catalog/catalog/v0.10.0/catalog.json'
export const FELINE_IMAGE_SIZE = 1254

export const COATS = [
  'brown-tabby',
  'orange-white',
  'tuxedo',
  'calico',
  'colorpoint',
  'rosetted',
] as const
export const EXPRESSIONS = ['parted-mouth', 'small-fangs', 'tongue-tip'] as const
export const MUTATIONS = [
  'dragon-horns',
  'antlers',
  'fin-ears',
  'small-lion-mane',
  'small-wings',
  'forked-tail-tip',
  // 异变批次 1（2026-09-15，RandomPet master d601e40）
  'halo',
  'dragon-wings',
  'feathered-wings',
  'frill-neck',
  'flame-tail',
] as const

export type Coat = (typeof COATS)[number]
export type Expression = (typeof EXPRESSIONS)[number]
export type Mutation = (typeof MUTATIONS)[number]
export type MutationSlot = 'crown' | 'ears' | 'neck' | 'back' | 'tailTip'

/** 异变 → 所在位置（同位置互斥：龙角与鹿角共用额顶） */
export const MUTATION_SLOT: Record<Mutation, MutationSlot> = {
  'dragon-horns': 'crown',
  antlers: 'crown',
  'fin-ears': 'ears',
  'small-lion-mane': 'neck',
  'small-wings': 'back',
  'forked-tail-tip': 'tailTip',
  halo: 'crown',
  'dragon-wings': 'back',
  'feathered-wings': 'back',
  'frill-neck': 'neck',
  'flame-tail': 'tailTip',
}

export const FELINE_SLOTS = [
  'coat',
  'expression',
  'crown',
  'ears',
  'neck',
  'back',
  'tailTip',
] as const
export type FelineSlot = (typeof FELINE_SLOTS)[number]

export interface FelineSelections {
  coat: Coat
  expression: Expression
  crown: 'none' | 'dragon-horns' | 'antlers' | 'halo'
  ears: 'none' | 'fin-ears'
  neck: 'none' | 'small-lion-mane' | 'frill-neck'
  back: 'none' | 'small-wings' | 'feathered-wings' | 'dragon-wings'
  tailTip: 'none' | 'forked-tail-tip' | 'flame-tail'
}

export interface FelineSpec {
  schemaVersion: 'feline-combination-v1'
  catalogVersion: typeof FELINE_CATALOG_VERSION
  seed: string
  selections: FelineSelections
  rolls: Record<FelineSlot, number>
  locks: FelineSlot[]
}

/** 必须完整持久化的形象身份（对接指南「保存、恢复与缓存」） */
export interface StoredFelineVisual {
  kind: 'qmonster-feline-combination'
  spec: FelineSpec
  catalogSha256: string
  runtimeRevision: string
}

export interface FelineHatchResult {
  visual: StoredFelineVisual
  image: {
    blob: Blob
    mime: 'image/webp' | 'image/png'
    width: number
    height: number
    cacheKey: string
  }
}

export interface FelineHatchery {
  hatch(seed: string, selections?: Partial<FelineSelections>): Promise<FelineHatchResult>
  restore(visual: StoredFelineVisual): Promise<FelineHatchResult>
}

export interface FelineSdk {
  createFelineHatchery(config: {
    catalogUrl: string
    resourceBaseUrl: string
  }): Promise<FelineHatchery>
  mutationSelectionsFromList(
    mutations: readonly string[],
  ): Pick<FelineSelections, MutationSlot>
  generateFelineCombination(seed: string, initial?: Partial<FelineSelections>): FelineSpec
  parseFelineCombinationSpec(
    input: unknown,
  ): { ok: true; value: FelineSpec } | { ok: false; diagnostics: { path: string[]; message: string }[] }
}

/**
 * SDK 是否可用：需要 crypto.subtle + OffscreenCanvas；HTTP 形态直接可用，
 * file://（或 ?offline=1）形态要等 offline.ts 的旁置素材通道就绪（清单缺失则不可用）。
 */
export function felineAvailable(): boolean {
  const caps =
    typeof crypto !== 'undefined' && crypto.subtle !== undefined && typeof OffscreenCanvas !== 'undefined'
  if (!caps) return false
  return isOfflineMode() ? offlineRuntimeReady() : true
}

/** 资源基址：HTTP 形态指向 /qmonster/hatchery/<rev>/；离线形态指向垫片接管的伪域名 */
export function felineReleaseBase(): string {
  return isOfflineMode() ? OFFLINE_BASE : new URL(FELINE_RELEASE_BASE, location.origin).href
}

/** SDK 静态内联（vendor/qmonster.js），保留异步签名以兼容调用方 */
export function loadFelineSdk(): Promise<FelineSdk> {
  return Promise.resolve(vendored as unknown as FelineSdk)
}

let hatchery: Promise<FelineHatchery> | null = null

/** 创建并缓存孵化器实例：SDK 会校验目录字节 SHA-256 与快照一致 */
export function loadFelineHatchery(): Promise<FelineHatchery> {
  if (hatchery === null) {
    hatchery = ensureOfflineRuntime()
      .then((ok) => {
        if (!ok) throw new Error('FELINE_OFFLINE_FILES_MISSING：单文件形态缺少旁置 qmonster-files/，请重新 npm run release 并整目录拷贝')
        return loadFelineSdk()
      })
      .then((mod) =>
        mod.createFelineHatchery({
          catalogUrl: `${felineReleaseBase()}${FELINE_CATALOG_FILE}`,
          resourceBaseUrl: felineReleaseBase(),
        }),
      )
      .catch((error) => {
        hatchery = null
        throw error
      })
  }
  return hatchery
}

/** 目录里各花纹实际具备的异变（生产期间可能只有部分花纹到位） */
export interface FelineCatalogInfo {
  catalogVersion: string
  templateVersion: string
  mutationsByCoat: Record<string, string[]>
}

let catalogInfo: Promise<FelineCatalogInfo> | null = null

export function loadFelineCatalogInfo(): Promise<FelineCatalogInfo> {
  if (catalogInfo === null) {
    catalogInfo = ensureOfflineRuntime()
      .then(() => fetch(`${felineReleaseBase()}${FELINE_CATALOG_FILE}`))
      .then(async (response) => {
        if (!response.ok) throw new Error(`FELINE_CATALOG_HTTP_${response.status}`)
        const json = (await response.json()) as {
          catalogVersion: string
          templateVersion: string
          mutations: Record<string, Record<string, string>>
        }
        const mutationsByCoat: Record<string, string[]> = {}
        for (const [coat, entries] of Object.entries(json.mutations ?? {})) {
          mutationsByCoat[coat] = Object.keys(entries ?? {})
        }
        return { catalogVersion: json.catalogVersion, templateVersion: json.templateVersion, mutationsByCoat }
      })
      .catch((error) => {
        catalogInfo = null
        throw error
      })
  }
  return catalogInfo
}

/** 按花纹给出可渲染异变集合（供 planFeline 的 available 参数） */
export async function loadFelineAvailability(): Promise<(coat: string) => ReadonlySet<string>> {
  const info = await loadFelineCatalogInfo()
  const sets = new Map<string, ReadonlySet<string>>()
  for (const [coat, ids] of Object.entries(info.mutationsByCoat)) sets.set(coat, new Set(ids))
  const empty: ReadonlySet<string> = new Set()
  return (coat) => sets.get(coat) ?? empty
}
