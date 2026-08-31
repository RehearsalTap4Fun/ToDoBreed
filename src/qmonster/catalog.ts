import { parseCatalog, type Catalog } from '@qmonster/generator-core'

export const QMONSTER_CATALOG_VERSION = 'v0.3.0'

let cached: Promise<Catalog> | null = null

/** 加载并缓存 QMonster 目录（解析失败禁止孵化，见对接指南 §4.1） */
export function loadCatalog(): Promise<Catalog> {
  if (cached === null) {
    cached = fetchCatalog().catch((error) => {
      cached = null
      throw error
    })
  }
  return cached
}

async function fetchCatalog(): Promise<Catalog> {
  const response = await fetch(`/qmonster/catalog/${QMONSTER_CATALOG_VERSION}/catalog.json`)
  if (!response.ok) throw new Error(`CATALOG_HTTP_${response.status}`)
  const parsed = parseCatalog(await response.json())
  if (!parsed.ok) {
    throw new Error(`CATALOG_INVALID:${parsed.diagnostics.map((item) => item.code).join(',')}`)
  }
  return parsed.value
}

/** QMonster 渲染是否可用：file:// 单机形态下 fetch/getImageData 均不可用 */
export function qmonsterAvailable(): boolean {
  return location.protocol !== 'file:'
}
