import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'DrawUtilsBaseOpenlayer',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: (id: string) => /^ol(\/.*)?$/.test(id) || /^vue(\/.*)?$/.test(id),
    },
    sourcemap: false,
  },
})
