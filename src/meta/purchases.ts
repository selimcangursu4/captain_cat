import { ECONOMY } from '../config/economy';
import type { SaveService } from '../services/SaveService';

/**
 * Gerçek parayla satılan ürünler. Bunlar komut değildir: istemci mağazadan (RevenueCat) satın alır,
 * sunucu ödemeyi doğrular ve ürünü kayda kendisi işler (server/src/app.ts POST /purchases).
 * Aynı işlem (transactionId) iki kez işlenmez.
 */
export type ProductGrant = { readonly kind: 'coins'; readonly coins: number } | { readonly kind: 'piggy' };

export const PRODUCT_IDS: readonly string[] = [...ECONOMY.shop.map((p) => p.id), ECONOMY.piggyBank.productId];

export function productGrant(productId: string): ProductGrant | null {
  const pack = ECONOMY.shop.find((p) => p.id === productId);
  if (pack) return { kind: 'coins', coins: pack.coins };
  if (productId === ECONOMY.piggyBank.productId) return { kind: 'piggy' };
  return null;
}

/** Kumbara kırılabilir mi (gerçek parayla satın alınmadan önce)? */
export function canBreakPiggy(save: SaveService): boolean {
  return save.data.piggyBank.coins >= ECONOMY.piggyBank.minBreak;
}

/**
 * Ödenmiş ürünü kayda işler; verilen altını döndürür. Kumbara ödenmişse içindeki altın verilir
 * (iki cihaz arasında boşalmış olsa bile ödeme karşılıksız kalmasın diye en az `minBreak`).
 */
export function applyPurchase(save: SaveService, productId: string): number | null {
  const grant = productGrant(productId);
  if (!grant) return null;
  const coins = grant.kind === 'coins' ? grant.coins : Math.max(ECONOMY.piggyBank.minBreak, save.data.piggyBank.coins);
  save.update((d) => {
    d.coins += coins;
    if (grant.kind === 'piggy') d.piggyBank.coins = 0;
  });
  return coins;
}
