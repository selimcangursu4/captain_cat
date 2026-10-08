/**
 * Kasaba: bölgeler ve görevler (saf veri). Görevler bölge içinde sırayla açılır.
 * Her görevin 3 tasarımı vardır (DESIGN_THEMES): oyuncu birini seçer, sonradan değiştirebilir.
 * Görseller src/assets/svg/town altında, aynı görev kimlikleriyle çizilir.
 */
export const DESIGN_THEMES = ['classic', 'ocean', 'sunset'] as const;
export type DesignTheme = (typeof DESIGN_THEMES)[number];

export const REGION_IDS = ['lighthouse', 'pier', 'fishShop', 'cafe', 'ship'] as const;
export type RegionId = (typeof REGION_IDS)[number];

export interface TownTask {
  /** "bölge.parça" — kayıtta ve görsellerde anahtar. */
  readonly id: string;
  readonly region: RegionId;
  /** Yıldız bedeli. */
  readonly cost: number;
}

export interface TownRegion {
  readonly id: RegionId;
  readonly tasks: readonly TownTask[];
  /** Bölge tamamlanınca ödül sandığından çıkan altın. */
  readonly chestCoins: number;
}

function region(id: RegionId, chestCoins: number, parts: readonly [string, number][]): TownRegion {
  return { id, chestCoins, tasks: parts.map(([part, cost]) => ({ id: `${id}.${part}`, region: id, cost })) };
}

export const TOWN: readonly TownRegion[] = [
  region('lighthouse', 100, [['tower', 1], ['lantern', 1], ['door', 1], ['fence', 2], ['garden', 2]]),
  region('pier', 150, [['deck', 2], ['bollards', 2], ['lamps', 2], ['boat', 2], ['buoys', 2], ['sign', 3]]),
  region('fishShop', 200, [['walls', 2], ['roof', 2], ['awning', 3], ['stall', 3], ['sign', 3], ['plants', 3]]),
  region('cafe', 250, [['walls', 3], ['roof', 3], ['windows', 3], ['tables', 3], ['umbrellas', 3], ['sign', 4], ['lights', 4]]),
  region('ship', 400, [
    ['hull', 3], ['cabin', 3], ['mast', 4], ['sails', 4], ['flag', 4], ['wheel', 4], ['figurehead', 5], ['rings', 5],
  ]),
];

export function getRegion(id: RegionId): TownRegion {
  return TOWN.find((r) => r.id === id)!;
}

export function getTask(id: string): TownTask | undefined {
  for (const r of TOWN) {
    const task = r.tasks.find((t) => t.id === id);
    if (task) return task;
  }
  return undefined;
}

/** Görevin bölge içindeki kısa adı ("lighthouse.tower" → "tower"). */
export function partOf(taskId: string): string {
  return taskId.slice(taskId.indexOf('.') + 1);
}
