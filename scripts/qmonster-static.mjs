/** /qmonster/* 静态托管的共享实现：dev 中间件与本地静态服务器共用 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const MIME = {
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
}

/** 把 rootDir 下的文件安全地写给 res；返回是否已处理 */
export function serveFile(rootDir, urlPath, res) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '')
  const filePath = join(rootDir, clean)
  if (!filePath.startsWith(rootDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return false
  }
  res.writeHead(200, {
    'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'cache-control': 'max-age=3600',
  })
  createReadStream(filePath).pipe(res)
  return true
}
