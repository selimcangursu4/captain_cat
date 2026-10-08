/// <reference types="node" />
import { defineConfig } from 'prisma/config';

// Prisma 7 .env dosyasını kendisi okumaz; Node'un yerleşik okuyucusuyla yüklenir.
try {
  process.loadEnvFile();
} catch {
  // .env yoksa ortam değişkenleri kullanılır (ör. sunucuda).
}

export default defineConfig({
  schema: 'server/prisma/schema.prisma',
  migrations: { path: 'server/prisma/migrations' },
  // `prisma generate` (npm install sonrası) veritabanı adresine ihtiyaç duymaz; .env yokken de çalışsın.
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://localhost:5433/kaptan_pati' },
});
