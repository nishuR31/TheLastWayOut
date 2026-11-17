import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    // Warn on genuinely oversized app chunks instead of masking the signal.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing libraries into cacheable vendor chunks.
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'vendor-three'
          if (id.includes('node_modules/cannon-es')) return 'vendor-physics'
          if (id.includes('node_modules/@fontsource')) return 'vendor-fonts'
        }
      }
    }
  },
  server: { host: '0.0.0.0', port: 3000 }
})
