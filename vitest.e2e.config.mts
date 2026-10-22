import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vitest/config';

// End-to-end tests: real HTTP requests against a running app (`npm run dev`
// or `npm start`) backed by a real database. Run with `npm run test:e2e`.
// E2E_BASE_URL defaults to http://localhost:3000.
if (fs.existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
