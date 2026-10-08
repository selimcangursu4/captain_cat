/// <reference types="node" />
/**
 * `npm run db:seed` — src/data/levels/*.json seviyelerini veritabanına aktarır (var olanları günceller).
 * Yeni seviye yayınlamak: `npm run levels` ile dosyaları üretin, sonra bu komut. Oyuncular
 * uygulamayı güncellemeden yeni seviyeleri indirir (GET /levels).
 */
import { loadConfig } from './env';
import { readLevelFiles } from './levels';
import { PrismaStore } from './prismaStore';

const config = loadConfig();
const store = await PrismaStore.connect(config.databaseUrl);
const rows = await readLevelFiles();
await store.upsertLevels(rows);
console.log(`${rows.length} seviye veritabanına aktarıldı.`);
await store.close();
