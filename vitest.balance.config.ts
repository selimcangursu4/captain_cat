import { defineConfig } from 'vitest/config';

/** `npm run balance` — bölüm dengesi ölçümü (normal testlerden ayrı; birkaç dakika sürebilir). */
export default defineConfig({
  test: {
    include: ['tools/balance.test.ts'],
    environment: 'node',
    testTimeout: 1_800_000,
  },
});
