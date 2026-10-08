import { parseLevel, type LevelDefinition } from '../../core/level';

/**
 * Seviye deposu. Pakete gömülü seviyeler (level-001.json, level-002.json, …) derleme sırasında
 * eklenir; oyun internetsiz çalışır. Yeni seviye eklemek için bu klasöre dosya koymak yeterli
 * (`npm run levels` aracı üretir). Sunucudan gelen yeni seviyeler registerLevels ile listeye eklenir.
 */
const files = import.meta.glob('./level-*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

const levels: LevelDefinition[] = Object.keys(files)
  .sort()
  .map((path) => parseLevel(files[path]));

levels.forEach((level, i) => {
  if (level.id !== i + 1) {
    throw new Error(`Seviye numaraları ardışık olmalı: ${i + 1}. dosyanın id'si ${level.id}`);
  }
});

/** Pakete gömülü seviyeler (testler ve araçlar için). */
export const LEVELS: readonly LevelDefinition[] = levels.slice();

/** Oyundaki toplam seviye sayısı (sunucudan eklenenler dahil). */
export function levelCount(): number {
  return levels.length;
}

export function getLevel(id: number): LevelDefinition {
  const level = levels[id - 1];
  if (!level) throw new Error(`Seviye ${id} yok (toplam ${levels.length})`);
  return level;
}

/**
 * Yeni seviyeleri ekler (ör. sunucudan). Mevcut seviyeler değişmez; yalnızca sondan devam eden,
 * geçerli seviyeler alınır (bozuk olan atlanır, oyun çökmez). Eklenen seviye sayısını döndürür.
 */
export function registerLevels(raw: readonly unknown[]): number {
  let added = 0;
  const parsed: LevelDefinition[] = [];
  for (const r of raw) {
    try {
      parsed.push(parseLevel(r));
    } catch (error) {
      console.warn('[Kaptan Pati] Seviye atlandı:', (error as Error).message);
    }
  }
  parsed.sort((a, b) => a.id - b.id);
  for (const level of parsed) {
    if (level.id !== levels.length + 1) continue;
    levels.push(level);
    added++;
  }
  return added;
}
