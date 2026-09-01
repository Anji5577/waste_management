import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
      // The real-inference suite loads an 83 MB ONNX graph from disk; the
      // default 5 s timeout is not close to enough for a cold start.
      testTimeout: 180_000,
      hookTimeout: 180_000,
      // Node-side ONNX sessions are heavy — running files in parallel processes
      // multiplies peak memory by the worker count and triggers OOM kills.
      pool: 'forks',
      poolOptions: { forks: { singleFork: true } },
    },
  }),
);
