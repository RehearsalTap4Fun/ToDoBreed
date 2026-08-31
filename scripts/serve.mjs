#!/usr/bin/env node
/**
 * 本地静态服务器（纯单机形态 v2）：托管 dist/ 构建产物 + /qmonster/ 部件资源。
 * QMonster 渲染依赖 HTTP 同源资源（fetch + getImageData），file:// 无法承载，
 * 故单机形态从"单 HTML 双击"升级为"本地服务 + 双击启动器"（依然离线零远端）。
 */
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveFile } from './qmonster-static.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const QASSETS = join(ROOT, 'qmonster-assets')
const PORT = Number(process.env.GSI_PORT ?? 5123)

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('[serve] 未找到 dist/index.html，请先运行 npm run build')
  process.exit(1)
}

const server = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0]
  if (url.startsWith('/qmonster/')) {
    if (serveFile(QASSETS, url.slice('/qmonster/'.length), res)) return
  } else if (url === '/gsi-inbox.json' || url === '/gsi-inbox.js') {
    if (serveFile(join(ROOT, 'public'), url, res)) return
  } else {
    if (serveFile(DIST, url === '/' ? '/index.html' : url, res)) return
    // SPA 兜底
    if (serveFile(DIST, '/index.html', res)) return
  }
  res.writeHead(404)
  res.end('not found')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[serve] 怪奇生物孵化器 → http://localhost:${PORT}`)
})
