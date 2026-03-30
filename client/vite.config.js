import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// All d3 sub-packages ship both ESM src/ (circular deps → Rollup TDZ crash)
// and pre-bundled UMD dist/ (no circular deps). Aliasing to dist/ files
// forces Vite to use the safe pre-built versions in both dev and prod.
const d3Alias = [
  'd3-array', 'd3-color', 'd3-dispatch', 'd3-drag', 'd3-ease',
  'd3-geo', 'd3-interpolate', 'd3-selection', 'd3-timer',
  'd3-transition', 'd3-zoom',
].reduce((acc, pkg) => {
  acc[pkg] = resolve(`node_modules/${pkg}/dist/${pkg}.js`)
  return acc
}, {})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: d3Alias,
  },
})
