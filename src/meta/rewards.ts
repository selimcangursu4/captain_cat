import { ECONOMY, ITEM_IDS, MATERIAL_IDS, type ChestDrop, type ChestId, type ItemId, type MaterialId, type RewardBundle } from '../config/economy';
import { Random } from '../core/Random';
import type { SaveService } from '../services/SaveService';
import type { Lives } from './Lives';

/** Ödül paketini kayda işler (altın, yıldız, eşya, malzeme; can Lives üzerinden: sayaç doğru güncellensin). */
export function grantBundle(save: SaveService, lives: Lives, bundle: RewardBundle): void {
  save.update((d) => {
    d.coins += bundle.coins ?? 0;
    d.stars += bundle.stars ?? 0;
    for (const id of ITEM_IDS) d.inventory[id] += bundle.items?.[id] ?? 0;
    for (const id of MATERIAL_IDS) d.materials[id] += bundle.materials?.[id] ?? 0;
  });
  if (bundle.lives) lives.grant(bundle.lives);
}

/** Paketleri toplar (sandığın çekilişleri tek ödül olarak gösterilsin). */
export function mergeBundles(list: readonly RewardBundle[]): RewardBundle {
  const items: Partial<Record<ItemId, number>> = {};
  const materials: Partial<Record<MaterialId, number>> = {};
  let coins = 0;
  let stars = 0;
  let lives = 0;
  for (const b of list) {
    coins += b.coins ?? 0;
    stars += b.stars ?? 0;
    lives += b.lives ?? 0;
    for (const id of ITEM_IDS) if (b.items?.[id]) items[id] = (items[id] ?? 0) + b.items[id]!;
    for (const id of MATERIAL_IDS) if (b.materials?.[id]) materials[id] = (materials[id] ?? 0) + b.materials[id]!;
  }
  return {
    ...(coins ? { coins } : {}),
    ...(stars ? { stars } : {}),
    ...(lives ? { lives } : {}),
    ...(Object.keys(items).length ? { items } : {}),
    ...(Object.keys(materials).length ? { materials } : {}),
  };
}

/**
 * Sandıktaki her ödül türünün bir çekilişte çıkma olasılığı (yüzde, toplamı 100). Mağaza kuralları
 * (App Store 3.1.1, Google Play) parayla alınan rastgele ödüllerde olasılıkların satın almadan önce
 * gösterilmesini ister; Pazar'daki sandık kartı bunu gösterir.
 */
export function chestOdds(chest: ChestId): { readonly kind: ChestDrop['kind']; readonly percent: number }[] {
  const drops = ECONOMY.chests[chest].drops;
  const total = drops.reduce((sum, d) => sum + d.weight, 0);
  const byKind = new Map<ChestDrop['kind'], number>();
  for (const d of drops) byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + d.weight);
  const odds = [...byKind].map(([kind, weight]) => ({ kind, percent: Math.round((weight / total) * 100) }));
  // Yuvarlama artığı en olası türe eklenir: toplam her zaman 100.
  const diff = 100 - odds.reduce((sum, o) => sum + o.percent, 0);
  if (diff !== 0) odds.reduce((a, b) => (b.percent > a.percent ? b : a)).percent += diff;
  return odds;
}

/** Eşya açılmamışsa sandıktaki eşya yerine verilen altın (adet başına). */
const ITEM_FALLBACK_COINS = 50;

function rollDrop(drop: ChestDrop, rng: Random, unlocked: readonly ItemId[]): RewardBundle {
  const between = (min: number, max: number) => min + rng.int(max - min + 1);
  switch (drop.kind) {
    case 'material':
      return { materials: { [rng.pick(MATERIAL_IDS)]: between(drop.min, drop.max) } };
    case 'coins':
      return { coins: Math.round(between(drop.min, drop.max) / 5) * 5 };
    case 'item':
      return unlocked.length > 0 ? { items: { [rng.pick(unlocked)]: drop.amount } } : { coins: ITEM_FALLBACK_COINS * drop.amount };
    case 'lives':
      return { lives: drop.amount };
    case 'stars':
      return { stars: drop.amount };
  }
}

/**
 * Sandığı açar: kesin ödüller + ağırlıklı çekilişler. Saf fonksiyon: aynı tohum aynı sonucu verir;
 * kayıttaki tohumla çağrıldığı için istemci ve sunucu aynı ödülü bulur. Yeni tohumu da döndürür.
 */
export function rollChest(chest: ChestId, seed: number, unlocked: readonly ItemId[]): { reward: RewardBundle; seed: number } {
  const config = ECONOMY.chests[chest];
  const rng = new Random(seed);
  const total = config.drops.reduce((sum, d) => sum + d.weight, 0);
  const rolls: RewardBundle[] = [config.guaranteed];
  for (let i = 0; i < config.rolls; i++) {
    let pick = rng.next() * total;
    const drop = config.drops.find((d) => (pick -= d.weight) < 0) ?? config.drops[config.drops.length - 1];
    rolls.push(rollDrop(drop, rng, unlocked));
  }
  return { reward: mergeBundles(rolls), seed: rng.snapshot() };
}
