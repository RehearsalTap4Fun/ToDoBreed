import type { ImageResolver } from '@qmonster/renderer-canvas'

/**
 * 浏览器资源解析器（对接指南 §4.2）：同源加载部件位图并缓存，失败可重试。
 * 目录中的 assetPath 相对版本目录（如 'parts/xxx.webp'），个别带 'assets/vX.Y.Z/' 前缀需归一。
 */
export class BrowserImageResolver implements ImageResolver {
  private readonly cache = new Map<string, Promise<ImageBitmap>>()

  public constructor(private readonly catalogVersion: string) {}

  public resolve(assetPath: string): Promise<ImageBitmap> {
    const normalized = this.normalize(assetPath)
    let pending = this.cache.get(normalized)
    if (pending === undefined) {
      pending = this.load(normalized).catch((error) => {
        this.cache.delete(normalized)
        throw error
      })
      this.cache.set(normalized, pending)
    }
    return pending
  }

  private normalize(assetPath: string): string {
    const prefix = `assets/v${this.catalogVersion}/`
    return assetPath.startsWith(prefix) ? assetPath.slice(prefix.length) : assetPath
  }

  private async load(relativePath: string): Promise<ImageBitmap> {
    const url = `/qmonster/assets/v${this.catalogVersion}/${relativePath}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`ASSET_HTTP_${response.status}:${relativePath}`)
    return createImageBitmap(await response.blob())
  }
}

let resolver: BrowserImageResolver | null = null

export function qmonsterResolver(catalogVersion: string): BrowserImageResolver {
  if (resolver === null) resolver = new BrowserImageResolver(catalogVersion)
  return resolver
}
