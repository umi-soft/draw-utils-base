import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/**/__tests__/**/*.test.ts'],
    coverage: {
      include: ['packages/**/src/**/*.ts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 56,
        functions: 68,
        lines: 74,
        statements: 70,
      },
    },
  },
})
