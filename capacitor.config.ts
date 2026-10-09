import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Mobil paket (Capacitor): web derlemesi (dist/) uygulamanın içine gömülür; oyun internetsiz açılır.
 * appId Google Play ve App Store'da uygulamanın kalıcı kimliğidir: ilk yüklemeden sonra değiştirilemez.
 *
 * Yayın paketi yalnızca HTTPS sunucuya bağlanır. Geliştirmede bilgisayardaki http:// sunucuya
 * bağlanmak için `npm run android:dev` CAP_ALLOW_HTTP=1 ile eşitler (bkz. tools/android.mjs).
 */
const allowHttp = process.env.CAP_ALLOW_HTTP === '1';

const config: CapacitorConfig = {
  appId: 'com.kaptanpati.game',
  appName: 'Kaptan Pati',
  webDir: 'dist',
  backgroundColor: '#0b4f79',
  android: {
    allowMixedContent: allowHttp,
  },
  ios: {
    // Oyun tam ekran çizer; güvenli alan boşluğunu sayfa kendisi bırakır (index.html).
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      // Oyunun kendi açılış ekranı (BootScene) çizilince kod kapatır.
      launchAutoHide: false,
      backgroundColor: '#0b4f79',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
