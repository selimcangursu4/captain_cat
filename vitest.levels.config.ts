import { defineConfig } from 'vitest/config';

/** `npm run levels` — eksik seviyeleri üretir ve denge botuyla ayarlar (birkaç dakika sürebilir). */
export default defineConfig({
  test: {
    include: ['tools/generate-levels.ts'],
    environment: 'node',
    testTimeout: 3_600_000,
  },
});
