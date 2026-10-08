import type { ItemId } from './economy';

/**
 * Seviye sistemi: her bölüm bir seviyedir. Yeni bir seviyeyi ilk kez geçince ödül verilir;
 * her `chestEvery` seviyede bir hediye sandığı açılır. Tekrar oynanan seviyeler ödül vermez.
 */
export const LEVEL_REWARDS = {
  /** Her yeni seviyede verilen can (5 can sınırını aşabilir, en çok maxStoredLives). */
  livesPerLevel: 1,
  /** Hediye sandığı: kaç seviyede bir, altın (seviyeyle artar) ve dönüşümlü eşyalar. */
  chestEvery: 10,
  chestBaseCoins: 100,
  chestCoinsStep: 20,
  chestMaxCoins: 500,
  /** Her 50 seviyede bir büyük sandık: altın ve eşyalar bu katla çarpılır. */
  bigChestEvery: 50,
  bigChestMultiplier: 2,
  /** Sandıklarda sırayla verilen eşya ikilileri (yalnızca o seviyede açılmış olanlar verilir). */
  chestItems: [
    { shovel: 1, harpoon: 1 },
    { helm: 1, cannon: 1 },
    { storm: 1, whirlpool: 1 },
  ] satisfies readonly Partial<Record<ItemId, number>>[] as readonly Partial<Record<ItemId, number>>[],
} as const;
