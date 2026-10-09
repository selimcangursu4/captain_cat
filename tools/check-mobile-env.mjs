/**
 * Mağaza paketi derlenmeden önce kontrol (npm run mobile:check / mobile:build / android:release).
 * Ayarlar .env.production(.local) ya da ortam değişkenlerinden okunur (Vite'ın okuduğu yerler).
 *  - VITE_API_URL: https:// ve herkese açık bir alan adı olmalı (localhost/IP adresi incelemede çalışmaz).
 *  - VITE_REVENUECAT_ANDROID_KEY / VITE_REVENUECAT_IOS_KEY: yoksa mağaza "satın alma kullanılamıyor" der.
 * Hata varsa çıkış kodu 1: yanlış ayarlı paket mağazaya gönderilmesin.
 */
import { loadEnv } from 'vite';

const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const errors = [];
const warnings = [];

const api = env.VITE_API_URL?.trim();
if (!api) {
  errors.push('VITE_API_URL tanımlı değil. Örnek: VITE_API_URL=https://api.kaptanpati.com (.env.production.local).');
} else {
  let url = null;
  try {
    url = new URL(api);
  } catch {
    errors.push(`VITE_API_URL geçerli bir adres değil: ${api}`);
  }
  if (url) {
    if (url.protocol !== 'https:') errors.push(`VITE_API_URL https:// olmalı (mağazalar düz HTTP'ye izin vermez): ${api}`);
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
      errors.push(`VITE_API_URL herkese açık bir alan adı olmalı (IP / yerel adres incelemede çalışmaz, IPv6 ağlarında da sorun çıkarır): ${api}`);
    }
    if (url.pathname !== '/' && url.pathname !== '') warnings.push(`VITE_API_URL bir yol içeriyor (${url.pathname}); sunucu kök adreste olmalı.`);
  }
}
if (!env.VITE_REVENUECAT_ANDROID_KEY) warnings.push('VITE_REVENUECAT_ANDROID_KEY yok: Android mağazasında altın satılamaz.');
if (!env.VITE_REVENUECAT_IOS_KEY) warnings.push('VITE_REVENUECAT_IOS_KEY yok: iOS mağazasında altın satılamaz.');

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✖ ${e}`);
if (errors.length > 0) {
  console.error('\nMağaza paketi derlenmedi. Ayrıntılar: docs/store/YAYIN-KONTROL-LISTESI.md');
  process.exit(1);
}
console.log(`✓ Mobil yayın ayarları tamam (sunucu: ${api}).`);
