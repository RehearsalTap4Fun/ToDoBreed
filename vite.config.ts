import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
// @ts-expect-error 共享的 mjs 无类型声明
import { serveFile } from './scripts/qmonster-static.mjs'

// QMonster 生成器（../RandomPet）以源码别名接入：包为 private TS 源码直出，Vite 直接编译
const qm = (p: string) => fileURLToPath(new URL(`../RandomPet/packages/${p}`, import.meta.url))
const qassets = fileURLToPath(new URL('./qmonster-assets', import.meta.url))

/** dev 下托管 /qmonster/*（资源在 qmonster-assets/，不进 public 以免 build 拷贝 181MB） */
const qmonsterAssets = (): Plugin => ({
  name: 'gsi-qmonster-assets',
  configureServer(server) {
    server.middlewares.use('/qmonster', (req, res, next) => {
      const url = (req.url ?? '/').split('?')[0]
      if (!serveFile(qassets, url, res)) next()
    })
  },
})

// 构建仍为单 HTML（游戏本体自包含）；QMonster 部件资源由本地静态服务（npm run play）另行托管
export default defineConfig({
  plugins: [react(), viteSingleFile(), qmonsterAssets()],
  resolve: {
    alias: {
      '@qmonster/generator-core': qm('generator-core/src/index.ts'),
      '@qmonster/renderer-canvas': qm('renderer-canvas/src/index.ts'),
    },
    dedupe: ['zod'],
  },
  server: {
    fs: { allow: ['..'] },
  },
})
