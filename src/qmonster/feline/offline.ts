/**
 * file:// 单文件形态的素材通道。
 * 浏览器禁止 file:// 页面 fetch 本地文件，但允许 <script src> 注入——沿用 gsi-inbox.js 的做法：
 * `npm run release` 把每个 SDK 资源（目录 JSON + 44 张 PNG）各写成一份 release/qmonster-files/*.js
 * （内容为 window.__QMONSTER_FILES__[path] = { t: mime, d: base64 }），运行时按需注入；
 * 再用 fetch 垫片把 SDK 对 http://qmonster.local/<path> 的请求接到注入的数据上——SDK 本身零改动，
 * 仍按字节校验 SHA-256。`?offline=1` 可在 HTTP 下强制走这条通道以便验证。
 */
export const OFFLINE_BASE = 'http://qmonster.local/'
const FILES_DIR = 'qmonster-files/'

/** 资源路径 → 旁置脚本文件名（与 scripts/build-release-assets.mjs 保持一致） */
export function scriptNameFor(path: string): string {
  return `${path.replace(/\//g, '__')}.js`
}

export function isOfflineMode(): boolean {
  if (typeof location === 'undefined') return false
  return location.protocol === 'file:' || new URLSearchParams(location.search).has('offline')
}

interface FileEntry {
  t: string
  d: string
}
interface Manifest {
  rev: string
  catalogFile: string
  files: string[]
}
declare global {
  interface Window {
    __QMONSTER_FILES__?: Record<string, FileEntry>
    __QMONSTER_FILES_MANIFEST__?: Manifest
  }
}

const scriptLoads = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  const cached = scriptLoads.get(src)
  if (cached) return cached
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.onload = () => resolve()
    el.onerror = () => {
      el.remove()
      reject(new Error(`SCRIPT_LOAD:${src}`))
    }
    document.head.appendChild(el)
  })
  scriptLoads.set(src, p)
  p.catch(() => scriptLoads.delete(src))
  return p
}

function decodeBase64(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const buffer = new ArrayBuffer(bin.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return buffer
}

let runtime: Promise<boolean> | null = null
let ready = false
let shimInstalled = false

/** 离线通道是否已就绪（清单已加载、垫片已装） */
export function offlineRuntimeReady(): boolean {
  return ready
}

/** 加载清单并安装 fetch 垫片；旁置文件缺失时返回 false（UI 据此提示用启动器打开） */
export function ensureOfflineRuntime(): Promise<boolean> {
  if (!isOfflineMode()) return Promise.resolve(true)
  if (runtime === null) {
    runtime = loadScript(`${FILES_DIR}manifest.js`)
      .then(() => {
        const manifest = window.__QMONSTER_FILES_MANIFEST__
        if (!manifest) return false
        installFetchShim(manifest)
        ready = true
        return true
      })
      .catch(() => false)
  }
  return runtime
}

/** 供 UI 显示：离线清单声明的 SDK 运行版本（与代码钉版不一致时提示重新 release） */
export function offlineManifestRevision(): string | null {
  return window.__QMONSTER_FILES_MANIFEST__?.rev ?? null
}

function installFetchShim(manifest: Manifest): void {
  if (shimInstalled) return
  shimInstalled = true
  const known = new Set(manifest.files)
  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(OFFLINE_BASE)) return original(input, init)
    const path = decodeURIComponent(url.slice(OFFLINE_BASE.length).split('?')[0])
    if (!known.has(path)) return new Response(null, { status: 404, statusText: 'unknown qmonster resource' })
    try {
      if (!window.__QMONSTER_FILES__?.[path]) await loadScript(`${FILES_DIR}${scriptNameFor(path)}`)
      const entry = window.__QMONSTER_FILES__?.[path]
      if (!entry) return new Response(null, { status: 404, statusText: 'qmonster resource script empty' })
      return new Response(decodeBase64(entry.d), { status: 200, headers: { 'content-type': entry.t } })
    } catch {
      return new Response(null, { status: 502, statusText: 'qmonster resource script failed' })
    }
  }
}
