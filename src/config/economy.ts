/** Bölüm içi yardımcılar: Kürek (tek kare), Dümen (bir satır), Fırtına (karıştırma). */
export const HELPER_IDS = ['shovel', 'helm', 'storm'] as const;
/** Bölüm öncesi seçilen güçlendiriciler: bölüme tahtada hazır bir Harpun/Gülle/Girdap ile başlanır. */
export const BOOSTER_IDS = ['harpoon', 'cannon', 'whirlpool'] as const;
export const ITEM_IDS = [...HELPER_IDS, ...BOOSTER_IDS] as const;

export type HelperId = (typeof HELPER_IDS)[number];
export type BoosterId = (typeof BOOSTER_IDS)[number];
export type ItemId = (typeof ITEM_IDS)[number];

/** Kasaba inşaatlarının malzemeleri. Seviyelerden, sandıklardan ve Pazar'dan (yıldızla) gelir. */
export const MATERIAL_IDS = ['wood', 'stone', 'nails', 'rope', 'paint', 'glass', 'cloth'] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];
export type Materials = Partial<Record<MaterialId, number>>;

/** Gemi atölyesi yükseltmeleri (altınla). */
export const SHIP_UPGRADE_IDS = ['hull', 'storage', 'engine'] as const;
export type ShipUpgradeId = (typeof SHIP_UPGRADE_IDS)[number];

export const CHEST_IDS = ['captain', 'treasure', 'legend'] as const;
export type ChestId = (typeof CHEST_IDS)[number];

export interface ItemConfig {
  /** Bu bölüme gelince açılır ve hediye verilir (öğretici bölümler 1-10'dan sonra). */
  readonly unlockLevel: number;
  /** Açılınca verilen ücretsiz adet. */
  readonly gift: number;
  /** Altınla satın alınan paket: adet ve fiyat. */
  readonly pack: number;
  readonly price: number;
  /** Tek adet fiyatı (bölüm içinde bitince). */
  readonly singlePrice: number;
}

/** Ödül paketi: günlük ödül, sandıklar ve satın alımlar aynı biçimi kullanır. */
export interface RewardBundle {
  readonly coins?: number;
  readonly stars?: number;
  readonly lives?: number;
  readonly items?: Partial<Record<ItemId, number>>;
  readonly materials?: Materials;
}

export type DailyRewardConfig = RewardBundle;

export interface MaterialConfig {
  /** 1 yıldıza Pazar'da alınan adet (malzemenin değeri). */
  readonly perStar: number;
}

/** Sandıktaki bir çekilişin sonucu: ağırlığına göre seçilir. */
export type ChestDrop =
  | { readonly weight: number; readonly kind: 'material'; readonly min: number; readonly max: number }
  | { readonly weight: number; readonly kind: 'coins'; readonly min: number; readonly max: number }
  | { readonly weight: number; readonly kind: 'item'; readonly amount: number }
  | { readonly weight: number; readonly kind: 'lives'; readonly amount: number }
  | { readonly weight: number; readonly kind: 'stars'; readonly amount: number };

export interface ChestConfig {
  readonly price: number;
  /** Kaç kez çekiliş yapılır. */
  readonly rolls: number;
  /** Her açılışta kesin çıkanlar. */
  readonly guaranteed: RewardBundle;
  readonly drops: readonly ChestDrop[];
}

export interface ShipUpgradeConfig {
  /** Seviye seviye altın bedeli ve etkisi (hull: % altın, storage: +malzeme, engine: başlangıç güçlendiricisi). */
  readonly levels: readonly { readonly cost: number; readonly bonus: number }[];
}

/** Gerçek parayla satılan ürünler (Google Play / App Store kimlikleri RevenueCat'teki ürünlerle aynı). */
export interface CoinPackConfig {
  readonly id: string;
  readonly coins: number;
  /** Mağaza fiyatı yüklenemezse gösterilen yedek fiyat. */
  readonly price: { readonly tr: string; readonly en: string };
  readonly tag?: 'popular' | 'best';
}

/** Ekonomi ayarları. Bütün denge sayıları buradadır. */
export const ECONOMY = {
  /** Yeni oyuncu: altın, yıldız ve ilk inşaatları hemen yapabileceği malzeme. */
  startingCoins: 300,
  startingStars: 0,
  startingMaterials: { wood: 6, stone: 5, nails: 6, paint: 2 } satisfies Materials as Materials,

  /** Bölüm kazanınca verilen sabit altın; kutlamada her kalan hamle için ek altın. */
  levelWinCoins: 20,
  coinsPerBonusMove: 3,
  /** Yeni bir seviyeyi ilk kez geçince: yıldız ve kasabanın en çok ihtiyaç duyduğu malzemeden bu kadar. */
  levelWinStars: 1,
  levelWinMaterial: 3,

  /** Hamleler bitince: +5 hamle. Aynı denemede her alımda fiyat artar (100, 150, 200…). */
  extraMoves: { count: 5, cost: 100, costStep: 50 },

  /**
   * Can: bölüme başlarken 1 can düşer, kazanınca geri verilir. `max` altındaysa her
   * `regenMinutes` dakikada 1 can gelir. Ödül canları `maxStored`'a kadar birikir.
   */
  lives: { max: 5, regenMinutes: 20, refillCost: 50, fullRefillCost: 200, maxStored: 10 },

  items: {
    shovel: { unlockLevel: 11, gift: 3, pack: 3, price: 150, singlePrice: 60 },
    helm: { unlockLevel: 12, gift: 3, pack: 3, price: 200, singlePrice: 80 },
    storm: { unlockLevel: 13, gift: 3, pack: 3, price: 100, singlePrice: 40 },
    harpoon: { unlockLevel: 14, gift: 3, pack: 3, price: 150, singlePrice: 60 },
    cannon: { unlockLevel: 15, gift: 3, pack: 3, price: 150, singlePrice: 60 },
    whirlpool: { unlockLevel: 16, gift: 3, pack: 3, price: 200, singlePrice: 80 },
  } satisfies Record<ItemId, ItemConfig>,

  /** Malzemelerin yıldız değeri. Eksik malzemenin altınla fiyatı da buradan çıkar. */
  materials: {
    wood: { perStar: 6 },
    stone: { perStar: 5 },
    nails: { perStar: 8 },
    rope: { perStar: 5 },
    paint: { perStar: 4 },
    glass: { perStar: 3 },
    cloth: { perStar: 4 },
  } satisfies Record<MaterialId, MaterialConfig>,

  /** Pazar: her malzemenin iki paketi (yıldızla). Büyük pakette %20 fazlası verilir. */
  market: [
    { stars: 1, bonus: 1 },
    { stars: 5, bonus: 1.2 },
  ],

  /** Altın → yıldız takası (Pazar). */
  starPacks: [
    { stars: 1, coins: 120 },
    { stars: 5, coins: 550 },
    { stars: 15, coins: 1500 },
  ],

  /** 1 yıldızın altın karşılığı: eksik malzemeyi doğrudan altınla tamamlarken kullanılır. */
  goldPerStar: 120,

  /**
   * İnşaatı hızlandırma (zaman atlama): kalan dakikaya göre altın.
   * bedel = katsayı × dakika^üs, `round`'a yuvarlanır; son `freeSeconds` saniye ücretsizdir.
   */
  speedUp: { factor: 10, exponent: 0.8, min: 5, round: 5, freeSeconds: 30 },

  /** Sandıklar (Pazar, altınla). İçerik kayıttaki tohumla belirlenir: istemci ve sunucu aynı sonucu bulur. */
  chests: {
    captain: {
      price: 250,
      rolls: 3,
      guaranteed: {},
      drops: [
        { weight: 40, kind: 'material', min: 4, max: 8 },
        { weight: 25, kind: 'coins', min: 40, max: 120 },
        { weight: 20, kind: 'item', amount: 1 },
        { weight: 10, kind: 'lives', amount: 1 },
        { weight: 5, kind: 'stars', amount: 1 },
      ],
    },
    treasure: {
      price: 750,
      rolls: 5,
      guaranteed: { stars: 1 },
      drops: [
        { weight: 40, kind: 'material', min: 6, max: 12 },
        { weight: 20, kind: 'coins', min: 80, max: 200 },
        { weight: 25, kind: 'item', amount: 1 },
        { weight: 8, kind: 'lives', amount: 2 },
        { weight: 7, kind: 'stars', amount: 1 },
      ],
    },
    legend: {
      price: 2000,
      rolls: 8,
      guaranteed: { stars: 3, lives: 5 },
      drops: [
        { weight: 40, kind: 'material', min: 10, max: 18 },
        { weight: 20, kind: 'coins', min: 150, max: 400 },
        { weight: 25, kind: 'item', amount: 2 },
        { weight: 15, kind: 'stars', amount: 2 },
      ],
    },
  } satisfies Record<ChestId, ChestConfig>,

  /** Gemi atölyesi (altınla, kalıcı). */
  ship: {
    /** Gövde: bölüm altınına +%bonus. */
    hull: { levels: [{ cost: 800, bonus: 10 }, { cost: 2000, bonus: 20 }, { cost: 4000, bonus: 30 }] },
    /** Ambar: yeni seviyede gelen malzemeye +bonus adet. */
    storage: { levels: [{ cost: 600, bonus: 1 }, { cost: 1500, bonus: 2 }, { cost: 3500, bonus: 3 }] },
    /** Motor: her bölüme tahtada bonus adet hazır güçlendiriciyle başlanır. */
    engine: { levels: [{ cost: 1500, bonus: 1 }, { cost: 4000, bonus: 2 }] },
  } satisfies Record<ShipUpgradeId, ShipUpgradeConfig>,

  /** Kumbara: her yeni seviyede altın biriktirir; dolunca (en az minBreak) gerçek parayla kırılır. */
  piggyBank: {
    productId: 'com.kaptanpati.game.piggy_bank',
    coinsPerWin: 25,
    maxCoins: 1500,
    minBreak: 500,
    price: { tr: '₺44,99', en: '$1.99' },
  },

  /** 7 günlük giriş ödülü; bir gün atlanırsa 1. güne dönülür. */
  daily: [
    { coins: 50 },
    { items: { shovel: 1 } },
    { coins: 100, stars: 1 },
    { items: { harpoon: 1, storm: 1 } },
    { coins: 150 },
    { items: { cannon: 2, helm: 1 } },
    { coins: 300, stars: 2 },
  ] satisfies readonly DailyRewardConfig[] as readonly DailyRewardConfig[],

  /** Altın paketleri (gerçek ödeme RevenueCat üzerinden; sunucu doğrular). */
  shop: [
    { id: 'com.kaptanpati.game.coins_500', coins: 500, price: { tr: '₺19,99', en: '$0.99' } },
    { id: 'com.kaptanpati.game.coins_1200', coins: 1200, price: { tr: '₺44,99', en: '$1.99' } },
    { id: 'com.kaptanpati.game.coins_2500', coins: 2500, price: { tr: '₺84,99', en: '$3.99' }, tag: 'popular' },
    { id: 'com.kaptanpati.game.coins_5500', coins: 5500, price: { tr: '₺169,99', en: '$7.99' } },
    { id: 'com.kaptanpati.game.coins_12000', coins: 12000, price: { tr: '₺349,99', en: '$15.99' } },
    { id: 'com.kaptanpati.game.coins_30000', coins: 30000, price: { tr: '₺799,99', en: '$34.99' }, tag: 'best' },
  ] satisfies readonly CoinPackConfig[] as readonly CoinPackConfig[],

  /** Eski kayıtlarda (sürüm 4-5) tek tür "malzeme" vardı: bu kadarı 1 yıldıza çevrilir. */
  legacyMaterialsPerStar: 25,
} as const;
