import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'obsidian': path.resolve(__dirname, 'tests/__mocks__/obsidian.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ["tests/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    setupFiles: ["./tests/vitest.setup.ts"],
  },
});