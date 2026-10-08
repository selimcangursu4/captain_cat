/// <reference types="node" />

/** Sunucu ayarları (.env ya da ortam değişkenleri; örnek: .env.example). */
export interface ServerConfig {
  readonly port: number;
  readonly databaseUrl: string;
  /** Geliştirici komutlarına (+yıldız, seviye atla) ve deneme alımlarına izin ver. Yayında kapalı olmalı. */
  readonly devCommands: boolean;
  /** CORS: izin verilen kaynaklar; true = hepsi. */
  readonly corsOrigins: string[] | true;
  /** Oturum süresi (gün); her kullanımda uzar. */
  readonly sessionDays: number;
  /** Kaba kuvvete karşı: IP başına saatte kayıt, IP+e-posta başına 10 dakikada giriş denemesi. */
  readonly registerPerHour: number;
  readonly loginPer10Min: number;
  /** RevenueCat gizli anahtarı (sk_…): gerçek ödemeleri doğrulamak için. Yoksa gerçek alım kabul edilmez. */
  readonly revenueCatSecretKey: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  try {
    process.loadEnvFile();
  } catch {
    // .env yoksa ortam değişkenleri kullanılır.
  }
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL tanımlı değil (.env.example dosyasını .env olarak kopyalayın)');
  const origins = (env.CORS_ORIGINS ?? '*').trim();
  return {
    port: Number(env.PORT ?? 8787),
    databaseUrl,
    devCommands: env.DEV_COMMANDS === '1',
    corsOrigins: origins === '*' ? true : origins.split(',').map((s) => s.trim()).filter(Boolean),
    sessionDays: Number(env.SESSION_DAYS ?? 90),
    registerPerHour: Number(env.RATE_LIMIT_REGISTER_PER_HOUR ?? 5),
    loginPer10Min: Number(env.RATE_LIMIT_LOGIN_PER_10MIN ?? 10),
    revenueCatSecretKey: env.REVENUECAT_SECRET_KEY?.trim() || null,
  };
}
