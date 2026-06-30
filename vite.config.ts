import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { pricesApiPlugin } from './server/vitePlugin.ts';

export default defineConfig({
  plugins: [react(), pricesApiPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**',
    ],
  },
});
