import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'DrawUtilsBaseCore',
      formats: ['es', 'cjs'],
      fileName: (f) => f === 'es' ? 'index.js' : 'index.cjs',
    },
    sourcemap: false,
    minify: false,
  },
})
