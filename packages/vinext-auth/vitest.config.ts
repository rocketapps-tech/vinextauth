import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/react/**',
        'src/**/*.d.ts',
        // Pure re-export barrel — no testable logic
        'src/index.ts',
        // Pure configuration factories — no logic, only data
        'src/providers/**',
        // Requires next/headers (Next.js server APIs) — not unit testable
        'src/server/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
