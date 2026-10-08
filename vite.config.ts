import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Göreli yollar: Capacitor (Aşama 8) dosyaları file:// benzeri bir kökten sunar.
  base: './',
  server: {
    host: true, // Aynı ağdaki telefondan test edebilmek için
    port: 5190,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Phaser'ı ayrı dosyada tut: oyun kodu değişince tarayıcı motoru yeniden indirmez.
        manualChunks(id: string) {
          return id.includes('node_modules/phaser') ? 'phaser' : undefined;
        },
      },
    },
  },
  test: {
    // Oyun testleri + sunucu testleri (sunucu testleri bellek deposuyla çalışır, veritabanı gerekmez).
    include: ['tests/**/*.test.ts', 'server/tests/**/*.test.ts'],
    environment: 'node',
  },
});
