import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 单文件构建：JS/CSS 全部内联进一个 HTML，file:// 双击即可运行（纯单机形态）
export default defineConfig({
  plugins: [react(), viteSingleFile()],
})
