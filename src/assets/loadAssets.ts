import type Phaser from 'phaser';
import { ASSET_MANIFEST, type AssetEntry } from './AssetManifest';

/** preload() içinde çağrılır: dosya tabanlı (PNG vb.) ve tembel olmayan girdileri yükleyiciye ekler. */
export function queueFileAssets(scene: Phaser.Scene): void {
  for (const [key, entry] of Object.entries(ASSET_MANIFEST)) {
    if (entry.kind === 'image' && !entry.lazy) scene.load.image(key, entry.url);
  }
}

/**
 * Açılışta: tembel olmayan tüm SVG girdilerini dokuya dönüştürür. onProgress(0..1) yükleme
 * çubuğu içindir; dokular paralel üretildiği için açılış animasyonu bu sırada akmaya devam eder.
 */
export async function buildSvgTextures(scene: Phaser.Scene, onProgress?: (fraction: number) => void): Promise<void> {
  const keys = Object.entries(ASSET_MANIFEST)
    .filter(([, entry]) => !entry.lazy)
    .map(([key]) => key);
  await ensureTextures(scene, keys, onProgress);
}

/**
 * Verilen dokuları (henüz yoksa) hazırlar. Tembel girdiler (kasaba bölgeleri) ekranda
 * gösterilmeden önce bununla yüklenir.
 */
export async function ensureTextures(
  scene: Phaser.Scene,
  keys: readonly string[],
  onProgress?: (fraction: number) => void,
): Promise<void> {
  let done = 0;
  const jobs = keys.map(async (key) => {
    if (!scene.textures.exists(key)) {
      const entry = ASSET_MANIFEST[key];
      if (!entry) throw new Error(`AssetManifest'te olmayan doku: ${key}`);
      await loadEntry(scene, key, entry);
    }
    onProgress?.(++done / keys.length);
  });
  await Promise.all(jobs);
}

/** Artık görünmeyen dokuları bellekten bırakır (önce onları kullanan nesneler yok edilmeli). */
export function releaseTextures(scene: Phaser.Scene, keys: readonly string[]): void {
  for (const key of keys) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
  }
}

async function loadEntry(scene: Phaser.Scene, key: string, entry: AssetEntry): Promise<void> {
  if (entry.kind === 'image') {
    await new Promise<void>((resolve, reject) => {
      scene.load.image(key, entry.url);
      scene.load.once(`filecomplete-image-${key}`, () => resolve());
      scene.load.once('loaderror', (file: { key: string }) => {
        if (file.key === key) reject(new Error(`Görsel yüklenemedi: ${key}`));
      });
      scene.load.start();
    });
    return;
  }
  const canvas = await rasterizeSvg(entry.render(), entry.width, entry.height, key);
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
}

function rasterizeSvg(markup: string, width: number, height: number, key: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D bağlamı alınamadı'));
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      resolve(canvas);
    };
    image.onerror = () => reject(new Error(`SVG dokusu oluşturulamadı: ${key}`));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}
