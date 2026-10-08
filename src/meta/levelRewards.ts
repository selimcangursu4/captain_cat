import { ECONOMY, type ItemId } from '../config/economy';
import { LEVEL_REWARDS } from '../config/levels';

/** Bir seviyeyi ilk kez geçince verilen ödül. */
export interface LevelReward {
  readonly lives: number;
  readonly coins: number;
  readonly items: Readonly<Partial<Record<ItemId, number>>>;
  /** Bu seviyede hediye sandığı var mı (büyük sandık: her 50 seviyede). */
  readonly chest: 'none' | 'normal' | 'big';
}

export function hasChest(levelId: number): boolean {
  return levelId > 0 && levelId % LEVEL_REWARDS.chestEvery === 0;
}

/** levelId'den sonraki (ya da kendisi) hediye sandığı seviyesi. */
export function nextChestLevel(levelId: number): number {
  return Math.ceil(Math.max(1, levelId) / LEVEL_REWARDS.chestEvery) * LEVEL_REWARDS.chestEvery;
}

/** Seviye ödülü (saf hesap). Sandık eşyaları yalnızca o seviyeye kadar açılmış eşyalardan seçilir. */
export function levelReward(levelId: number): LevelReward {
  if (!hasChest(levelId)) return { lives: LEVEL_REWARDS.livesPerLevel, coins: 0, items: {}, chest: 'none' };
  const index = levelId / LEVEL_REWARDS.chestEvery;
  const big = levelId % LEVEL_REWARDS.bigChestEvery === 0;
  const factor = big ? LEVEL_REWARDS.bigChestMultiplier : 1;
  const coins = Math.min(LEVEL_REWARDS.chestMaxCoins, LEVEL_REWARDS.chestBaseCoins + (index - 1) * LEVEL_REWARDS.chestCoinsStep);
  const pair = LEVEL_REWARDS.chestItems[(index - 1) % LEVEL_REWARDS.chestItems.length];
  const items: Partial<Record<ItemId, number>> = {};
  for (const [id, n] of Object.entries(pair) as [ItemId, number][]) {
    // Sandıktan sonra oynanacak seviyede açılacak eşyalar da verilebilir (hediyesi zaten gelir).
    if (ECONOMY.items[id].unlockLevel <= levelId + 1) items[id] = n * factor;
  }
  return { lives: LEVEL_REWARDS.livesPerLevel, coins: coins * factor, items, chest: big ? 'big' : 'normal' };
}
