import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve @xp/shared to its TypeScript SOURCE, not the built dist/.
      // Dev/HMR picks up shared changes instantly and can never see a stale build.
      '@xp/shared': fileURLToPath(new URL('../../packages/shared/index.ts', import.meta.url)),
    },
  },
})
