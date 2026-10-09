/**
 * Uygulama simgesi, açılış görseli ve mağaza görselleri: oyundaki Kaptan Pati çiziminden üretilir.
 *   npm run assets   → assets/*.png (Capacitor kaynakları) + store/*.png, ardından Android/iOS simgeleri
 * Kaynaklar (@capacitor/assets biçimi):
 *   assets/icon-only.png        1024² tam simge (iOS; saydamlık yok)
 *   assets/icon-foreground.png  1024² Android uyarlanabilir simge ön katmanı (saydam, güvenli alan içinde)
 *   assets/icon-background.png  1024² Android uyarlanabilir simge arka planı
 *   assets/splash(-dark).png    2732² yerel açılış ekranı (oyun kendi açılışını hemen çizer)
 *   store/play-icon-512.png, store/feature-graphic-1024x500.png  Google Play mağaza sayfası
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { captainPatiSvg } from '../src/assets/svg/characters';
import { tileSvg } from '../src/assets/svg/tiles';
import { TILE_COLORS } from '../src/core/types';

/** İç SVG belgesini dış belgeye x/y/boyut vererek yerleştirir. */
function nest(svg: string, x: number, y: number, size: number): string {
  return svg.replace(/^<svg ([^>]*?)width="[^"]*" height="[^"]*"/, `<svg $1x="${x}" y="${y}" width="${size}" height="${size}"`);
}

/** Okyanus zemini: ışık huzmeleri ve kabarcıklar (simge ve açılış ortak). */
function ocean(w: number, h: number): string {
  const cx = w / 2;
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const b = a + Math.PI / 24;
    const r = Math.max(w, h);
    return `<path d="M${cx} ${h / 2} L${cx + Math.cos(a) * r} ${h / 2 + Math.sin(a) * r} L${cx + Math.cos(b) * r} ${h / 2 + Math.sin(b) * r} Z" fill="#ffffff" opacity=".07"/>`;
  }).join('');
  const bubbles = [
    [0.18, 0.78, 0.035],
    [0.84, 0.22, 0.028],
    [0.8, 0.82, 0.02],
    [0.12, 0.25, 0.018],
  ]
    .map(([x, y, r]) => `<circle cx="${x * w}" cy="${y * h}" r="${r * w}" fill="none" stroke="#ffffff" stroke-width="${w * 0.008}" opacity=".45"/>`)
    .join('');
  return `<defs><radialGradient id="sea" cx="50%" cy="42%" r="70%">
      <stop offset="0" stop-color="#5fd0f5"/><stop offset=".55" stop-color="#1f8fc8"/><stop offset="1" stop-color="#0b4f79"/>
    </radialGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#sea)"/>${rays}${bubbles}`;
}

const doc = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

async function png(svg: string, file: string, opaque = false): Promise<void> {
  let image = sharp(Buffer.from(svg));
  // App Store 1024² simgede saydamlık (alfa kanalı) kabul etmez.
  if (opaque) image = image.flatten({ background: '#0b4f79' }).removeAlpha();
  writeFileSync(file, await image.png().toBuffer());
  console.log('yazıldı:', file);
}

async function main(): Promise<void> {
  mkdirSync('assets', { recursive: true });
  mkdirSync('store', { recursive: true });
  const S = 1024;
  const captain = captainPatiSvg(256);

  // Tam simge (iOS + yedek): kenara kadar dolu, köşeleri mağaza yuvarlar.
  await png(doc(S, S, ocean(S, S) + nest(captain, S * 0.12, S * 0.1, S * 0.76)), 'assets/icon-only.png', true);
  // Uyarlanabilir simge: Capacitor her iki katmanı da görünen alana (%66) yerleştirir; Kaptan maskeye sığsın.
  await png(doc(S, S, nest(captain, S * 0.16, S * 0.14, S * 0.68)), 'assets/icon-foreground.png');
  await png(doc(S, S, ocean(S, S)), 'assets/icon-background.png');

  // Yerel açılış: oyunun arka plan rengi + ortada Kaptan.
  const SP = 2732;
  const splash = doc(SP, SP, `<rect width="${SP}" height="${SP}" fill="#0b4f79"/>${nest(captain, SP / 2 - 360, SP / 2 - 400, 720)}`);
  await png(splash, 'assets/splash.png', true);
  await png(splash, 'assets/splash-dark.png', true);

  // Google Play: 512² simge ve 1024x500 öne çıkan görsel (yazısız; istenirse üstüne başlık eklenir).
  writeFileSync('store/play-icon-512.png', await sharp('assets/icon-only.png').resize(512, 512).png().toBuffer());
  console.log('yazıldı: store/play-icon-512.png');
  const tiles = TILE_COLORS.map((color, i) => nest(tileSvg(color, 144), 560 + (i % 3) * 150, 60 + Math.floor(i / 3) * 200 + (i % 2) * 40, 140)).join('');
  await png(doc(1024, 500, ocean(1024, 500) + nest(captain, 70, 40, 420) + tiles), 'store/feature-graphic-1024x500.png');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
