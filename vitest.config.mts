import path from 'path';
import { defineConfig } from 'vitest/config';

// Unit tests: pure logic only (scoring engine, parsing, security helpers).
// They need no database or running server, so they run anywhere, including CI.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    env: {
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    },
  },
});
