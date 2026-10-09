/// <reference types="node" />
/**
 * Kaptan Pati oyun sunucusu: `npm run server` (geliştirme, dosya değişince yeniden başlar).
 * Önce veritabanı: `npm run db:up` (Docker) ve `npm run db:migrate`.
 */
import { buildApp } from './app';
import { loadConfig } from './env';
import { LevelCatalog, readLevelFiles } from './levels';
import { PrismaStore } from './prismaStore';
import { RevenueCatVerifier } from './purchases';

const LEVEL_REFRESH_MS = 5 * 60_000;

async function main(): Promise<void> {
  const config = loadConfig();
  const store = await PrismaStore.connect(config.databaseUrl);

  // Seviyeler veritabanından; veritabanı boşsa paketteki dosyalardan aktarılır.
  const catalog = new LevelCatalog();
  let rows = await store.listLevels(0);
  if (rows.length === 0) {
    rows = await readLevelFiles();
    await store.upsertLevels(rows);
    console.log(`Veritabanında seviye yoktu: ${rows.length} seviye dosyalardan aktarıldı.`);
  }
  catalog.load(rows);
  // Veritabanına sonradan eklenen seviyeler yeniden başlatmadan tanınsın.
  setInterval(() => {
    store.listLevels(0).then((r) => catalog.load(r), (e: unknown) => console.error('Seviyeler yenilenemedi:', e));
  }, LEVEL_REFRESH_MS).unref();

  const app = await buildApp({
    store,
    catalog,
    devCommands: config.devCommands,
    corsOrigins: config.corsOrigins,
    sessionDays: config.sessionDays,
    registerPerHour: config.registerPerHour,
    loginPer10Min: config.loginPer10Min,
    purchaseVerifier: config.revenueCatSecretKey ? new RevenueCatVerifier(config.revenueCatSecretKey) : null,
    sandboxPurchases: config.devCommands,
    legal: { contactEmail: config.supportEmail, operator: config.operatorName },
  });
  if (!config.supportEmail || !config.operatorName) {
    console.warn('UYARI: SUPPORT_EMAIL / OPERATOR_NAME tanımlı değil. Gizlilik politikası ve destek sayfası mağaza incelemesi için bunları göstermeli.');
  }
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(
    `Kaptan Pati sunucusu: http://localhost:${config.port} · ${catalog.count} seviye · geliştirici komutları ${config.devCommands ? 'açık' : 'kapalı'} · ödeme doğrulama ${config.revenueCatSecretKey ? 'açık' : 'kapalı'}`,
  );

  const shutdown = async () => {
    await app.close();
    await store.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error: unknown) => {
  console.error('Sunucu başlatılamadı:', error);
  process.exit(1);
});
