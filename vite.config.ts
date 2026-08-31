import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// QMonster 生成器（../RandomPet）以源码别名接入：包为 private TS 源码直出，Vite 直接编译
const qm = (p: string) => fileURLToPath(new URL(`../RandomPet/packages/${p}`, import.meta.url))

// 单文件构建：JS/CSS 全部内联进一个 HTML，file:// 双击即可运行（纯单机形态）
// 注意：QMonster 渲染依赖 HTTP 同源资源（fetch + getImageData），仅在 dev/静态服务下可用
export default defineConfig({
  plugins: [react(), viteSingleFile()],
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
