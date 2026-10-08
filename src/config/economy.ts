/** Bölüm içi yardımcılar: Kürek (tek kare), Dümen (bir satır), Fırtına (karıştırma). */
export const HELPER_IDS = ['shovel', 'helm', 'storm'] as const;
/** Bölüm öncesi seçilen güçlendiriciler: bölüme tahtada hazır bir Harpun/Gülle/Girdap ile başlanır. */
export const BOOSTER_IDS = ['harpoon', 'cannon', 'whirlpool'] as const;
export const ITEM_IDS = [...HELPER_IDS, ...BOOSTER_IDS] as const;

export type HelperId = (typeof HELPER_IDS)[number];
export type BoosterId = (typeof BOOSTER_IDS)[number];
export type ItemId = (typeof ITEM_IDS)[number];

export interface ItemConfig {
  /** Bu bölüme gelince açılır ve hediye verilir (öğretici bölümler 1-10'dan sonra). */
  readonly unlockLevel: number;
  /** Açılınca verilen ücretsiz adet. */
  readonly gift: number;
  /** Altınla satın alınan paket: adet ve fiyat. */
  readonly pack: number;
  readonly price: number;
  readonly singlePrice: number;
}

export interface DailyRewardConfig {
  readonly coins?: number;
  readonly items?: Partial<Record<ItemId, number>>;
}

export interface ShopPackConfig {
  /** RevenueCat / Store product ID */
  readonly id: string;
  readonly coins: number;
  /** Mağaza şimdilik yalnızca arayüz: fiyatlar gösterim içindir. (RevenueCat gerçeğini çekecek) */
  readonly price: { readonly tr: string; readonly en: string };
  /** Öne çıkan paket etiketi ("En popüler" vb.). */
  readonly tag?: 'popular' | 'best';
}

export interface ChestConfig {
  readonly id: string;
  readonly priceGold: number;
  readonly guaranteedMaterial: number;
  readonly drops: {
    readonly type: 'booster' | 'cosmetic' | 'gold' | 'energy';
    readonly chance: number;
    readonly amount?: number;
    readonly rarity?: 'common' | 'rare' | 'epic';
  }[];
}

export interface ShipUpgradeConfig {
  readonly id: string;
  readonly name: string;
  readonly maxLevel: number;
  readonly levels: {
    readonly level: number;
    readonly costMaterial: number;
    readonly costGold: number;
    readonly bonusValue: number;
  }[];
}

/** Ekonomi ayarları (cömert tutuldu). */
export const ECONOMY = {
  /** Yeni oyuncunun altını (Premium) ve malzemesi (Material). */
  startingCoins: 300,
  startingMaterial: 50,
  missingMaterialGoldCost: 10,
  
  /** Bölüm kazanınca verilen sabit altın ve malzeme. */
  levelWinCoins: 10,
  levelWinMaterial: 25,
  /** Kutlamada her kalan hamle için ek altın. */
  coinsPerBonusMove: 2,
  
  /** Hamleler bitince satın alınabilen ek hamle. */
  extraMoves: { count: 5, cost: 100 },

  /** Kumbara (Piggy Bank) mekaniği: Bölüm kazanınca eklenen altınlar birikir, oyuncu belli bir fiyata hepsini alır. */
  piggyBank: {
    maxCoins: 2000,
    coinsPerWin: 50,
    priceGold: 250, // Opsiyonel: 2000 altın 250 golda veya IAP'ye dönüştürülebilir. Şimdilik gerçek para mantığında RevenueCat paketi gibi düşünülebilir veya indirimli gold karşılığı. 
  },

  /**
   * Can: bölüme başlarken 1 can düşer, kazanınca geri verilir.
   * `max` altındaysa her `regenMinutes` dakikada 1 can gelir.
   */
  lives: { max: 5, regenMinutes: 20, refillCost: 50, fullRefillCost: 200, maxStored: 10 },

  items: {
    shovel: { unlockLevel: 11, gift: 3, pack: 3, price: 50, singlePrice: 20 },
    helm: { unlockLevel: 12, gift: 3, pack: 3, price: 75, singlePrice: 30 },
    storm: { unlockLevel: 13, gift: 3, pack: 3, price: 40, singlePrice: 15 },
    harpoon: { unlockLevel: 14, gift: 3, pack: 3, price: 75, singlePrice: 30 },
    cannon: { unlockLevel: 15, gift: 3, pack: 3, price: 75, singlePrice: 30 },
    whirlpool: { unlockLevel: 16, gift: 3, pack: 3, price: 100, singlePrice: 40 },
  } satisfies Record<ItemId, ItemConfig>,

  /** Sandık Sistemi */
  chests: {
    common: {
      id: 'chest_common',
      priceGold: 300,
      guaranteedMaterial: 50,
      drops: [
        { type: 'booster', chance: 0.5, amount: 1 },
        { type: 'energy', chance: 0.3, amount: 1 },
      ]
    },
    rare: {
      id: 'chest_rare',
      priceGold: 800,
      guaranteedMaterial: 150,
      drops: [
        { type: 'booster', chance: 1.0, amount: 3 },
        { type: 'cosmetic', chance: 0.2, rarity: 'common' },
      ]
    },
    epic: {
      id: 'chest_epic',
      priceGold: 2500,
      guaranteedMaterial: 500,
      drops: [
        { type: 'cosmetic', chance: 1.0, rarity: 'rare' },
        { type: 'booster', chance: 1.0, amount: 10 },
      ]
    },
    lucky_spin: {
      id: 'lucky_spin',
      priceGold: 200,
      guaranteedMaterial: 50,
      drops: [
        { type: 'booster', chance: 0.5, amount: 1 },
        { type: 'gold', chance: 0.2, amount: 300 },
      ]
    }
  } satisfies Record<string, ChestConfig>,

  /** Gemi Yükseltmeleri (Ship Upgrade Tree) */
  shipUpgrades: {
    hull: {
      id: 'hull',
      name: 'Hull',
      maxLevel: 3,
      levels: [
        { level: 1, costMaterial: 500, costGold: 0, bonusValue: 5 }, // +5% level reward
        { level: 2, costMaterial: 1500, costGold: 200, bonusValue: 10 },
        { level: 3, costMaterial: 3000, costGold: 500, bonusValue: 15 },
      ]
    },
    storage: {
      id: 'storage',
      name: 'Storage',
      maxLevel: 3,
      levels: [
        { level: 1, costMaterial: 300, costGold: 0, bonusValue: 5 }, // +5% material reward
        { level: 2, costMaterial: 1000, costGold: 150, bonusValue: 10 },
        { level: 3, costMaterial: 2500, costGold: 400, bonusValue: 15 },
      ]
    },
    engine: {
      id: 'engine',
      name: 'Engine',
      maxLevel: 2,
      levels: [
        { level: 1, costMaterial: 1000, costGold: 500, bonusValue: 1 }, // start with +1 random special
        { level: 2, costMaterial: 3000, costGold: 1500, bonusValue: 2 }, // start with +2 random specials
      ]
    }
  } satisfies Record<string, any>,

  /** 7 günlük giriş ödülü; bir gün atlanırsa 1. güne dönülür. */
  daily: [
    { coins: 50 },
    { items: { shovel: 1 } },
    { coins: 100 },
    { items: { harpoon: 1, storm: 1 } },
    { coins: 150 },
    { items: { cannon: 2, helm: 1 } },
    { coins: 400 }, // Premium Reward
  ] satisfies readonly DailyRewardConfig[] as readonly DailyRewardConfig[],

  /** Altın paketleri (gerçek ödeme entegrasyonu RevenueCat üzerinden) */
  shop: [
    { id: 'com.kaptanpati.game.coins_500', coins: 500, price: { tr: '₺19,99', en: '$0.99' } },
    { id: 'com.kaptanpati.game.coins_1200', coins: 1200, price: { tr: '₺44,99', en: '$1.99' } },
    { id: 'com.kaptanpati.game.coins_2500', coins: 2500, price: { tr: '₺84,99', en: '$3.99' }, tag: 'popular' },
    { id: 'com.kaptanpati.game.coins_5500', coins: 5500, price: { tr: '₺169,99', en: '$7.99' } },
    { id: 'com.kaptanpati.game.coins_12000', coins: 12000, price: { tr: '₺349,99', en: '$15.99' } },
    { id: 'com.kaptanpati.game.coins_30000', coins: 30000, price: { tr: '₺799,99', en: '$34.99' }, tag: 'best' },
  ] satisfies readonly ShopPackConfig[] as readonly ShopPackConfig[],
} as const;
