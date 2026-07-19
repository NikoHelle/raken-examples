import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // App-def logic only — no DOM.
    environment: 'node',
  },
});
