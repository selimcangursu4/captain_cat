import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android paketi (Capacitor). Web derlemesi (dist/) uygulamanın içine gömülür; oyun internetsiz açılır.
 * appId Google Play'de uygulamanın kalıcı kimliğidir: ilk yüklemeden sonra değiştirilemez.
 */
const config: CapacitorConfig = {
  appId: 'com.kaptanpati.game',
  appName: 'Kaptan Pati',
  webDir: 'dist',
  android: {
    // Geliştirmede bilgisayardaki sunucuya (http://<ip>:8787) bağlanabilmek için. Yayında sunucu
    // HTTPS olmalı ve bu ayar kapatılmalı (bkz. README "Android").
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      // Oyunun kendi açılış ekranı (BootScene) hazır olunca kod kapatır.
      launchAutoHide: false,
      backgroundColor: '#0b4f79',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
