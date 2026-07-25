import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // ffmpeg.wasm 은 모듈 워커(new URL('./worker.js', import.meta.url))를 쓰는데
  // esbuild 사전 번들링이 이 URL 을 깨뜨릴 수 있어 제외한다.
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
})
