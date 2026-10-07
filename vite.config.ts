import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Preloads the Latin subset of Host Grotesk in the built page, so the first
// paint already has the web font more often and the hero doesn't reflow.
function preloadFont(): Plugin {
  let base = '/'
  return {
    name: 'headroom:preload-font',
    apply: 'build',
    configResolved(c) {
      base = c.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const font = Object.values(ctx.bundle ?? {}).find((f) => f.type === 'asset' && /host-grotesk-latin-wght-normal[^/]*\.woff2$/.test(f.fileName))
        return font ? [{ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `${base}${font.fileName}` }, injectTo: 'head' }] : []
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadFont()],
  build: {
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0])
