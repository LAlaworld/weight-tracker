import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
    proxy: {
      // 浏览器直连 open.feishu.cn 会被 CORS 拦截，经 dev server 转发
      '/feishu': {
        target: 'https://open.feishu.cn',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/feishu/, ''),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
