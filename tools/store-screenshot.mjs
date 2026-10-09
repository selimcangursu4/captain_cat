/**
 * Mağaza ekran görüntüsü: kablolu telefonun ekranını alır, mağaza boyutlarına getirir.
 *   npm run screenshot -- harita     → store/screenshots/play-harita.png (1080x2160, Google Play ≤ 2:1)
 *                                      store/screenshots/appstore-harita.png (1290x2796, 6,9" iPhone)
 * Durum ve gezinme çubukları atılır (oyun güvenli alanda çizildiği için onları otomatik bulur):
 * App Store ekran görüntüsünde başka bir platformun arayüzü görünmemeli (2.3.10). Kenarlar kesilmez;
 * oran gerekirse oyunun üst/alt kenarı uzatılarak tamamlanır (göstergeler kırpılmasın).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const name = process.argv[2] ?? String(Date.now());
const capture = spawnSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' });
if (capture.status !== 0 || !capture.stdout?.length) {
  console.error('Ekran alınamadı: telefon bağlı ve USB hata ayıklama açık mı? (adb devices)');
  process.exit(1);
}
const { data, info } = await sharp(capture.stdout).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const pixel = (x, y) => {
  const i = (y * width + x) * 3;
  return [data[i], data[i + 1], data[i + 2]];
};
const differs = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 36;

/** Sistem çubuğunun bittiği satır: çubuğun düz renginden ayrılan ilk satır (simgesiz bir sütunda). */
function edge(fromTop, x) {
  const start = fromTop ? 2 : height - 3;
  const base = pixel(x, start);
  for (let k = 0; k < height * 0.12; k++) {
    const y = fromTop ? start + k : start - k;
    if (differs(pixel(x, y), base)) return fromTop ? y : height - 1 - y;
  }
  return 0;
}
const top = edge(true, Math.round(width / 2));
const bottom = edge(false, Math.round(width * 0.06));
const game = { left: 0, top, width, height: height - top - bottom };
// Sağ kenardaki ince şerit (Samsung kenar paneli tutamacı gibi sistem arayüzü) komşu sütunla örtülür.
const EDGE = Math.round(width * 0.013);

async function store(outWidth, outHeight, file) {
  const ratio = outWidth / outHeight;
  let image = sharp(
    await sharp(capture.stdout).extract({ ...game, width: game.width - EDGE }).extend({ right: EDGE, extendWith: 'copy' }).png().toBuffer(),
  );
  const wantHeight = Math.round(game.width / ratio);
  if (wantHeight > game.height) {
    // Daha uzun oran: üst ve alt kenar kopyalanarak uzatılır (gökyüzü ve kum), yan kenarlar kesilmez.
    const extra = wantHeight - game.height;
    image = sharp(await image.png().toBuffer()).extend({ top: Math.floor(extra / 2), bottom: Math.ceil(extra / 2), extendWith: 'copy' });
  } else if (wantHeight < game.height) {
    const cut = game.height - wantHeight;
    image = sharp(await image.png().toBuffer()).extract({ left: 0, top: Math.floor(cut / 2), width: game.width, height: wantHeight });
  }
  // sharp boyutlandırmayı uzatmadan önce uygular: önce ara görüntü üretilir.
  await sharp(await image.png().toBuffer()).resize(outWidth, outHeight).png().toFile(file);
  console.log('yazıldı:', file);
}

mkdirSync('store/screenshots', { recursive: true });
await store(1080, 2160, `store/screenshots/play-${name}.png`);
await store(1290, 2796, `store/screenshots/appstore-${name}.png`);
