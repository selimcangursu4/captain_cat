import { describe, expect, it } from 'vitest';
import { CHEST_IDS, ECONOMY, ITEM_IDS, MATERIAL_IDS, type RewardBundle } from '../../src/config/economy';
import { en } from '../../src/i18n/en';
import { tr } from '../../src/i18n/tr';
import { goldCostOf, marketBundle, missingMaterials, starCostOf, starValue } from '../../src/meta/pricing';
import { PRODUCT_IDS, applyPurchase, canBreakPiggy, productGrant } from '../../src/meta/purchases';
import { mergeBundles, rollChest } from '../../src/meta/rewards';
import { MemorySaveStorage, SaveService, emptyMaterials } from '../../src/services/SaveService';

describe('fiyatlar', () => {
  it('eksik malzeme: tarif − elde; yıldız bedeli yukarı yuvarlanır (en az 1); altın = yıldız değeri × altın/yıldız', () => {
    const have = { ...emptyMaterials(), wood: 4, nails: 10 };
    const missing = missingMaterials({ wood: 10, nails: 5, glass: 1 }, have);
    expect(missing).toEqual({ wood: 6, glass: 1 });
    expect(starValue(missing)).toBeCloseTo(1 + 1 / 3);
    expect(starCostOf(missing)).toBe(2);
    expect(starCostOf({ nails: 1 })).toBe(1);
    expect(starCostOf({})).toBe(0);
    expect(goldCostOf({ wood: 6 })).toBe(ECONOMY.goldPerStar);
    expect(goldCostOf({ wood: 3, stone: 5 })).toBe(Math.ceil(1.5 * ECONOMY.goldPerStar));
  });

  it('altınla tamamlamak, aynı yıldızı takasla almaktan ucuz olmaz (Pazar dengesi)', () => {
    const cheapestStar = Math.min(...ECONOMY.starPacks.map((p) => p.coins / p.stars));
    for (const id of MATERIAL_IDS) {
      const amount = ECONOMY.materials[id].perStar;
      expect(goldCostOf({ [id]: amount })).toBeGreaterThanOrEqual(cheapestStar);
    }
  });

  it('Pazar paketleri: küçük paket 1 yıldız; büyük pakette yıldız başına daha çok malzeme', () => {
    for (const id of MATERIAL_IDS) {
      const small = marketBundle(id, 0)!;
      const big = marketBundle(id, 1)!;
      expect(small).toEqual({ stars: 1, amount: ECONOMY.materials[id].perStar });
      expect(big.amount / big.stars).toBeGreaterThan(small.amount / small.stars);
    }
    expect(marketBundle('wood', 5)).toBeNull();
  });

  it('yıldız paketleri büyüdükçe yıldız başına altın azalır', () => {
    const perStar = ECONOMY.starPacks.map((p) => p.coins / p.stars);
    for (let i = 1; i < perStar.length; i++) expect(perStar[i]).toBeLessThan(perStar[i - 1]);
  });
});

describe('sandıklar', () => {
  it('aynı tohum aynı ödül; ödüller geçerli ve kesin ödüller her zaman çıkar', () => {
    for (const chest of CHEST_IDS) {
      const guaranteed: RewardBundle = ECONOMY.chests[chest].guaranteed;
      let seed = 12345;
      for (let i = 0; i < 50; i++) {
        const first = rollChest(chest, seed, ['shovel', 'harpoon']);
        expect(rollChest(chest, seed, ['shovel', 'harpoon'])).toEqual(first);
        expect(first.seed).not.toBe(seed);
        const r = first.reward;
        for (const v of [r.coins, r.stars, r.lives, ...Object.values(r.items ?? {}), ...Object.values(r.materials ?? {})]) {
          if (v !== undefined) expect(v).toBeGreaterThan(0);
        }
        expect(r.stars ?? 0).toBeGreaterThanOrEqual(guaranteed.stars ?? 0);
        expect(r.lives ?? 0).toBeGreaterThanOrEqual(guaranteed.lives ?? 0);
        for (const id of Object.keys(r.items ?? {})) expect(['shovel', 'harpoon']).toContain(id);
        seed = first.seed;
      }
    }
  });

  it('açılmamış eşya çıkmaz: yerine altın verilir', () => {
    let seed = 7;
    for (let i = 0; i < 100; i++) {
      const { reward, seed: next } = rollChest('treasure', seed, []);
      expect(reward.items).toBeUndefined();
      seed = next;
    }
  });

  it('sandığın ortalama değeri fiyatına yakın (ne bedava ne kazık)', () => {
    const goldValue = (r: ReturnType<typeof rollChest>['reward']) =>
      (r.coins ?? 0) +
      ((r.stars ?? 0) + starValue(r.materials ?? {})) * ECONOMY.goldPerStar +
      (r.lives ?? 0) * ECONOMY.lives.refillCost +
      ITEM_IDS.reduce((sum, id) => sum + (r.items?.[id] ?? 0) * ECONOMY.items[id].singlePrice, 0);
    for (const chest of CHEST_IDS) {
      let seed = 99;
      let total = 0;
      const n = 2000;
      for (let i = 0; i < n; i++) {
        const roll = rollChest(chest, seed, [...ITEM_IDS]);
        total += goldValue(roll.reward);
        seed = roll.seed;
      }
      const ratio = total / n / ECONOMY.chests[chest].price;
      expect(ratio, chest).toBeGreaterThan(0.85);
      expect(ratio, chest).toBeLessThan(1.6);
    }
  });

  it('ödül paketleri toplanır', () => {
    expect(mergeBundles([{ coins: 5, materials: { wood: 2 } }, { coins: 10, materials: { wood: 3, rope: 1 } }, {}])).toEqual({
      coins: 15,
      materials: { wood: 5, rope: 1 },
    });
  });

  it('her sandığın, malzemenin ve gemi yükseltmesinin adı iki dilde var', () => {
    const keys = [...CHEST_IDS.map((id) => `chest.${id}`), ...Object.keys(ECONOMY.ship).flatMap((id) => [`ship.${id}`, `ship.effect.${id}`])];
    for (const key of keys) {
      expect(tr, key).toHaveProperty([key]);
      expect(en, key).toHaveProperty([key]);
    }
  });
});

describe('gerçek para ürünleri', () => {
  it('altın paketleri ve kumbara tanımlı; bilinmeyen ürün yok sayılır', () => {
    expect(PRODUCT_IDS).toHaveLength(ECONOMY.shop.length + 1);
    expect(productGrant(ECONOMY.shop[0].id)).toEqual({ kind: 'coins', coins: ECONOMY.shop[0].coins });
    expect(productGrant(ECONOMY.piggyBank.productId)).toEqual({ kind: 'piggy' });
    expect(productGrant('com.baska.oyun')).toBeNull();
  });

  it('altın paketi altın verir; kumbara içindekini verir ve boşalır', () => {
    const save = new SaveService(new MemorySaveStorage());
    const coins = save.data.coins;
    expect(applyPurchase(save, ECONOMY.shop[2].id)).toBe(ECONOMY.shop[2].coins);
    expect(save.data.coins).toBe(coins + ECONOMY.shop[2].coins);
    expect(canBreakPiggy(save)).toBe(false);
    save.update((d) => void (d.piggyBank.coins = 900));
    expect(canBreakPiggy(save)).toBe(true);
    const before = save.data.coins;
    expect(applyPurchase(save, ECONOMY.piggyBank.productId)).toBe(900);
    expect(save.data).toMatchObject({ coins: before + 900, piggyBank: { coins: 0 } });
    // Ödenmiş kumbara boş çıkarsa (iki cihaz) en az minBreak verilir.
    expect(applyPurchase(save, ECONOMY.piggyBank.productId)).toBe(ECONOMY.piggyBank.minBreak);
    expect(applyPurchase(save, 'yok')).toBeNull();
  });
});
