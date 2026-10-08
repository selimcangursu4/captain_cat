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

/** Ekonomi ayarları (cömert tutuldu). */
export const ECONOMY = {
  /** Yeni oyuncunun altını. */
  startingCoins: 300,
  /** Bölüm kazanınca verilen sabit altın. */
  levelWinCoins: 20,
  /** Kutlamada her kalan hamle için ek altın. */
  coinsPerBonusMove: 3,
  /** Hamleler bitince satın alınabilen ek hamle. */
  extraMoves: { count: 5, cost: 100 },

  /**
   * Can: bölüme başlarken 1 can düşer, kazanınca geri verilir (yani yalnızca kaybedince
   * ya da bölümden çıkınca gider). `max` altındaysa her `regenMinutes` dakikada 1 can gelir.
   * Seviye ödülü canları `max`'ı aşıp `maxStored`'a kadar birikebilir (zamanla yenilenmez).
   */
  lives: { max: 5, regenMinutes: 20, refillCost: 120, maxStored: 10 },

  items: {
    shovel: { unlockLevel: 11, gift: 3, pack: 3, price: 150 },
    helm: { unlockLevel: 12, gift: 3, pack: 3, price: 200 },
    storm: { unlockLevel: 13, gift: 3, pack: 3, price: 100 },
    harpoon: { unlockLevel: 14, gift: 3, pack: 3, price: 150 },
    cannon: { unlockLevel: 15, gift: 3, pack: 3, price: 150 },
    whirlpool: { unlockLevel: 16, gift: 3, pack: 3, price: 200 },
  } satisfies Record<ItemId, ItemConfig>,

  /** 7 günlük giriş ödülü; bir gün atlanırsa 1. güne dönülür, 7. günden sonra baştan başlar. */
  daily: [
    { coins: 50 },
    { coins: 80 },
    { items: { shovel: 1 } },
    { coins: 120 },
    { items: { harpoon: 1, storm: 1 } },
    { coins: 150 },
    { coins: 300, items: { cannon: 1, helm: 1 } },
  ] satisfies readonly DailyRewardConfig[] as readonly DailyRewardConfig[],

  /** Altın paketleri (gerçek ödeme entegrasyonu sonra). */
  shop: [
    { id: 'com.kaptanpati.game.coins_500', coins: 500, price: { tr: '₺19,99', en: '$0.99' } },
    { id: 'com.kaptanpati.game.coins_1200', coins: 1200, price: { tr: '₺44,99', en: '$1.99' } },
    { id: 'com.kaptanpati.game.coins_2500', coins: 2500, price: { tr: '₺84,99', en: '$3.99' }, tag: 'popular' },
    { id: 'com.kaptanpati.game.coins_5500', coins: 5500, price: { tr: '₺169,99', en: '$7.99' } },
    { id: 'com.kaptanpati.game.coins_12000', coins: 12000, price: { tr: '₺349,99', en: '$15.99' } },
    { id: 'com.kaptanpati.game.coins_30000', coins: 30000, price: { tr: '₺799,99', en: '$34.99' }, tag: 'best' },
  ] satisfies readonly ShopPackConfig[] as readonly ShopPackConfig[],
} as const;
