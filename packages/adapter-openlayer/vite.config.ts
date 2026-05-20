import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'DrawUtilsBaseOpenlayer',
      formats: ['es', 'cjs'],
      fileName: (f) => f === 'es' ? 'index.js' : 'index.cjs',
    },
    rollupOptions: {
      external: (id: string) => /^ol(\/.*)?$/.test(id) || /^vue(\/.*)?$/.test(id) || /^maplibre-gl(\/.*)?$/.test(id),
    },
    sourcemap: false,
  },
})
