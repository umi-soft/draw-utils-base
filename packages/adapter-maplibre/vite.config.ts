import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'DrawUtilsBaseMaplibre',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: (id: string) => /^maplibre-gl(\/.*)?$/.test(id) || /^vue(\/.*)?$/.test(id) || /^ol(\/.*)?$/.test(id),
    },
    sourcemap: false,
  },
})
