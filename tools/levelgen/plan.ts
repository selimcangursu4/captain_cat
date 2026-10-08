/**
 * Seviye planı: kaç seviye olacağı ve zorluk eğrisi.
 * Yeni seviye eklemek için TARGET_LEVELS'ı artırıp `npm run levels` çalıştırın; var olan
 * seviye dosyalarına dokunulmaz (elle düzeltilmiş seviyeler korunur).
 */

/** Elle tasarlanan son seviye (1-10 öğretici, 11-30 elle). Üretici bundan sonrasını yazar. */
export const HANDMADE_LEVELS = 30;
/** `npm run levels` bu sayıya kadar eksik seviyeleri üretir. */
export const TARGET_LEVELS = 200;

/**
 * 10'luk blok içinde zorluk dalgası, id % 10'a göre (0 = 10'un katı: sandık seviyesi, zor).
 * Pozitif = daha zor, negatif = rahatlatan seviye.
 */
const BLOCK_WAVE = [0.18, -0.1, -0.05, 0, 0.05, 0.12, -0.12, 0, 0.05, 0.1] as const;

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Oyunun genel ilerleyişi (0'dan 1'e yaklaşır; 100. seviye ≈ 0.47, 200. seviye ≈ 0.79). */
export function progress(id: number): number {
  return 1 - Math.exp(-Math.max(0, id - HANDMADE_LEVELS) / 110);
}

export function wave(id: number): number {
  return BLOCK_WAVE[id % 10];
}

/** İçerik yoğunluğu (engel sayısı, katman, hedef miktarı) için 0-1.2 arası zorluk. */
export function density(id: number): number {
  return clamp(0.15 + 0.85 * progress(id) + wave(id), 0, 1.2);
}

/**
 * Sıradan botun (beceri 0.6, ek hamle yok) hedef kazanma oranı. Hamle sayısı buna göre ayarlanır.
 * 31. seviye ≈ %90, sandık seviyeleri (10'un katları) daha zor; 200. seviyede ortalama ≈ %64.
 */
export function targetWinRate(id: number): number {
  return clamp(0.82 - 0.2 * progress(id) - 0.9 * wave(id), MIN_TARGET, 0.95);
}

/** En zor seviyede bile sıradan bot en az bu oranda kazanmalı (denge testi %40 altını reddeder). */
export const MIN_TARGET = 0.5;
