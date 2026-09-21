import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // Relative base so the same build works from a web root, a sub-path,
  // a Puter site, or tinyjs's file:// webview.
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // The wasm module resolves its own .wasm file via import.meta.url and
    // must not be pre-bundled.
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
  },
})
