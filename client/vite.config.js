import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // react-simple-maps and its D3 deps have circular imports that cause
        // Rollup to produce a TDZ "Cannot access before initialization" crash
        // when split across chunks. Grouping them in one chunk fixes the order.
        manualChunks: {
          'vendor-maps': ['react-simple-maps', 'd3-geo', 'topojson-client'],
        },
      },
    },
  },
})
