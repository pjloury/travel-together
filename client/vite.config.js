import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // react-simple-maps + D3 deps have circular refs that cause
    // "Cannot access 'X' before initialization" at runtime unless
    // Vite pre-bundles them into a single CJS chunk.
    include: [
      'react-simple-maps',
      'd3-geo',
      'topojson-client',
    ],
  },
})
