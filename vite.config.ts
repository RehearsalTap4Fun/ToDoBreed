import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
// @ts-expect-error 共享的 mjs 无类型声明
import { serveFile } from './scripts/qmonster-static.mjs'

const qassets = fileURLToPath(new URL('./qmonster-assets', import.meta.url))

/** dev 下托管 /qmonster/*（小猫 SDK 素材在 qmonster-assets/hatchery/，不进 public 以免 build 拷贝） */
const qmonsterAssets = (): Plugin => ({
  name: 'gsi-qmonster-assets',
  configureServer(server) {
    server.middlewares.use('/qmonster', (req, res, next) => {
      const url = (req.url ?? '/').split('?')[0]
      if (!serveFile(qassets, url, res)) next()
    })
  },
})

// 构建仍为单 HTML（游戏本体自包含，含内联小猫 SDK）；素材由本地静态服务（npm run play）或 release/qmonster-files 另行托管
export default defineConfig({
  plugins: [react(), viteSingleFile(), qmonsterAssets()],
  server: {
    fs: { allow: ['..'] },
  },
})
