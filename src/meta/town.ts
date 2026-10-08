import { MATERIAL_IDS, type MaterialId, type Materials } from '../config/economy';

/**
 * Kasaba: bölgeler ve görevler (saf veri). Görevler bölge içinde sırayla açılır.
 * Her görev malzeme ister (tarif) ve inşaatı belli bir süre sürer; aynı anda tek inşaat yapılır.
 * Bölgenin bütün inşaatları bitmeden sıradaki bölge açılmaz.
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
  /** Gereken malzemeler. */
  readonly recipe: Readonly<Materials>;
  /** İnşaat süresi (dakika). */
  readonly minutes: number;
}

export interface TownRegion {
  readonly id: RegionId;
  readonly tasks: readonly TownTask[];
  /** Bölge tamamlanınca ödül sandığından çıkan altın. */
  readonly chestCoins: number;
}

type TaskDef = readonly [part: string, minutes: number, recipe: Materials];

function region(id: RegionId, chestCoins: number, parts: readonly TaskDef[]): TownRegion {
  return { id, chestCoins, tasks: parts.map(([part, minutes, recipe]) => ({ id: `${id}.${part}`, region: id, recipe, minutes })) };
}

const HOUR = 60;

export const TOWN: readonly TownRegion[] = [
  region('lighthouse', 100, [
    ['tower', 1, { stone: 8, paint: 2 }],
    ['lantern', 3, { glass: 4, nails: 4 }],
    ['door', 5, { wood: 10, nails: 5 }],
    ['fence', 10, { wood: 12, nails: 6, paint: 3 }],
    ['garden', 15, { stone: 6, wood: 6, paint: 4 }],
  ]),
  region('pier', 150, [
    ['deck', 15, { wood: 18, nails: 8 }],
    ['bollards', 20, { stone: 8, rope: 6 }],
    ['lamps', 30, { glass: 5, nails: 6, paint: 3 }],
    ['boat', 30, { wood: 12, paint: 4, rope: 4 }],
    ['buoys', 45, { rope: 10, paint: 4 }],
    ['sign', HOUR, { wood: 8, paint: 6, nails: 6 }],
  ]),
  region('fishShop', 200, [
    ['walls', 30, { stone: 14, wood: 6 }],
    ['roof', 45, { wood: 14, nails: 10 }],
    ['awning', HOUR, { cloth: 12, rope: 5 }],
    ['stall', HOUR, { wood: 14, nails: 8, paint: 4 }],
    ['sign', 1.5 * HOUR, { wood: 8, paint: 8 }],
    ['plants', 2 * HOUR, { stone: 10, paint: 6, glass: 3 }],
  ]),
  region('cafe', 250, [
    ['walls', HOUR, { stone: 18, paint: 6 }],
    ['roof', HOUR, { wood: 16, nails: 12 }],
    ['windows', 1.5 * HOUR, { glass: 12, wood: 6 }],
    ['tables', 2 * HOUR, { wood: 18, nails: 8 }],
    ['umbrellas', 2 * HOUR, { cloth: 14, wood: 6 }],
    ['sign', 3 * HOUR, { wood: 10, paint: 10, nails: 6 }],
    ['lights', 3 * HOUR, { glass: 12, rope: 8 }],
  ]),
  region('ship', 400, [
    ['hull', 2 * HOUR, { wood: 24, nails: 12 }],
    ['cabin', 2 * HOUR, { wood: 18, glass: 6, paint: 4 }],
    ['mast', 3 * HOUR, { wood: 24, rope: 8 }],
    ['sails', 3 * HOUR, { cloth: 20, rope: 10 }],
    ['flag', 4 * HOUR, { cloth: 12, paint: 8 }],
    ['wheel', 4 * HOUR, { wood: 14, nails: 10, paint: 6 }],
    ['figurehead', 6 * HOUR, { wood: 18, paint: 12, glass: 6 }],
    ['rings', 8 * HOUR, { rope: 14, paint: 10 }],
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

/** Tarifin malzemeleri sabit sırayla (simgeler hep aynı sırada çizilsin). */
export function recipeEntries(recipe: Readonly<Materials>): [MaterialId, number][] {
  return MATERIAL_IDS.filter((id) => (recipe[id] ?? 0) > 0).map((id) => [id, recipe[id]!]);
}
