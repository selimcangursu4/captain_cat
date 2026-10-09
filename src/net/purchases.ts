import { Capacitor } from '@capacitor/core';
import type { PurchasesStoreProduct } from '@revenuecat/purchases-capacitor';
import { PRODUCT_IDS } from '../meta/purchases';
import { LocalStorageSaveStorage } from '../services/SaveService';
import { currentToken, currentUser } from './account';
import { ApiError, api } from './api';
import { sync } from './sync';

/**
 * Gerçek parayla satın alma (altın paketleri, kumbara).
 *  1) Telefonda RevenueCat ile mağazadan (Google Play / App Store) satın alınır. RevenueCat hesap
 *     kimliğiyle kurulur (appUserID = hesap), böylece sunucu ödemeyi o hesapta doğrulayabilir.
 *  2) İşlem kimliği sunucuya gider (POST /purchases); sunucu ödemeyi RevenueCat'ten doğrular ve
 *     altını esas kayda işler. İstemci kendi kendine altın yazamaz.
 *  3) Sunucuya ulaşılamazsa ödeme telefonda bekletilir ve bağlanınca yeniden gönderilir; aynı işlem
 *     iki kez işlenmez (sunucu işlem kimliğini saklar).
 * Geliştirmede (tarayıcı) mağaza yoktur: sunucu DEV_COMMANDS=1 iken deneme alımı yapılır.
 */
export type PurchaseOutcome =
  /** Altın hesaba eklendi. */
  | 'ok'
  | 'cancelled'
  /** Ödeme alındı ama henüz hesaba işlenemedi (internet yok / mağaza onayı bekliyor): sonra eklenecek. */
  | 'pending'
  /** Bu cihazda satın alma yapılamıyor (mağaza yapılandırılmamış). */
  | 'unavailable'
  | 'failed';

export interface PurchaseResult {
  readonly outcome: PurchaseOutcome;
  readonly coins?: number;
}

interface PendingPurchase {
  readonly productId: string;
  readonly transactionId: string;
}

interface PurchaseResponse {
  readonly coins: number;
  readonly duplicate: boolean;
}

type StoreMode = 'native' | 'sandbox' | 'none';

function revenueCatKey(): string | undefined {
  const platform = Capacitor.getPlatform();
  const env = import.meta.env as Record<string, string | undefined>;
  if (platform === 'android') return env.VITE_REVENUECAT_ANDROID_KEY;
  if (platform === 'ios') return env.VITE_REVENUECAT_IOS_KEY;
  return undefined;
}

function storeMode(): StoreMode {
  if (Capacitor.isNativePlatform()) return revenueCatKey() ? 'native' : 'none';
  return import.meta.env.DEV ? 'sandbox' : 'none';
}

/** Uygulamanın çalıştığı mağaza (metinlerde yalnızca o mağazanın adı geçer: App Store 2.3.10). */
export function storePlatform(): 'android' | 'ios' | 'web' {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios' ? platform : 'web';
}

/**
 * Fiyatlar mağazadan mı gelmeli? Telefonda yalnızca mağazanın yerel fiyatı gösterilir (yazılı yedek
 * fiyat gösterilmez: para birimi ve vergi ülkeye göre değişir); tarayıcıda yedek fiyatlar kullanılır.
 */
export function usesStorePrices(): boolean {
  return storeMode() === 'native';
}

/** Mağazada satın alma yapılabilir mi? (Değilse mağaza düğmeleri bilgi verir.) */
export function purchasesAvailable(): boolean {
  return storeMode() !== 'none';
}

// ───────────────────────── RevenueCat ─────────────────────────

let configuredFor: string | null = null;
const products = new Map<string, PurchasesStoreProduct>();

async function revenueCat() {
  const module = await import('@revenuecat/purchases-capacitor');
  const user = currentUser();
  if (!user) throw new Error('Giriş yapılmamış');
  if (configuredFor !== user.id) {
    const { isConfigured } = await module.Purchases.isConfigured();
    if (!isConfigured) await module.Purchases.configure({ apiKey: revenueCatKey()!, appUserID: user.id });
    else await module.Purchases.logIn({ appUserID: user.id });
    configuredFor = user.id;
  }
  return module;
}

/** Mağazadaki yerel fiyatlar (ürün → "₺44,99"). Yüklenemezse boş: yedek fiyatlar gösterilir. */
export async function loadStorePrices(): Promise<Record<string, string>> {
  if (storeMode() !== 'native') return {};
  try {
    const { Purchases, PRODUCT_CATEGORY } = await revenueCat();
    const result = await Purchases.getProducts({ productIdentifiers: [...PRODUCT_IDS], type: PRODUCT_CATEGORY.NON_SUBSCRIPTION });
    for (const product of result.products) products.set(product.identifier, product);
    return Object.fromEntries(result.products.map((p) => [p.identifier, p.priceString]));
  } catch {
    return {};
  }
}

// ───────────────────────── bekleyen ödemeler ─────────────────────────

function pendingStore(): LocalStorageSaveStorage | null {
  const user = currentUser();
  return user ? new LocalStorageSaveStorage(`kaptan-pati/purchases/${user.id}`) : null;
}

function readPending(): PendingPurchase[] {
  try {
    return JSON.parse(pendingStore()?.read() ?? '[]') as PendingPurchase[];
  } catch {
    return [];
  }
}

function writePending(list: readonly PendingPurchase[]): void {
  pendingStore()?.write(JSON.stringify(list));
}

/** Ödemeyi sunucuya bildirir. 'pending': sunucuya ulaşılamadı, ödeme bekletiliyor. */
async function deliver(body: { productId: string; transactionId?: string; sandbox?: boolean }): Promise<PurchaseResult> {
  const pending: PendingPurchase | null = body.transactionId ? { productId: body.productId, transactionId: body.transactionId } : null;
  const forget = () => {
    if (pending) writePending(readPending().filter((p) => p.transactionId !== pending.transactionId));
  };
  try {
    const res = await api<PurchaseResponse>('/purchases', { body, token: currentToken(), timeoutMs: 20_000 });
    forget();
    await sync.refresh();
    return { outcome: 'ok', coins: res.coins };
  } catch (error) {
    // Kesin ret (bilinmeyen ürün, doğrulanamayan ödeme): tekrar denemenin anlamı yok.
    if (error instanceof ApiError && [400, 402, 403].includes(error.status)) {
      forget();
      return { outcome: 'failed' };
    }
    return { outcome: pending ? 'pending' : 'failed' };
  }
}

/** Telefonda bekleyen (sunucuya ulaşamamış) ödemeleri yeniden gönderir; işlenen altını döndürür. */
export async function retryPendingPurchases(): Promise<number> {
  let coins = 0;
  for (const p of readPending()) {
    const result = await deliver(p);
    coins += result.coins ?? 0;
    if (result.outcome === 'pending') break; // hâlâ çevrimdışı
  }
  return coins;
}

/** Ürünü satın alır ve hesaba işletir. */
export async function buyProduct(productId: string): Promise<PurchaseResult> {
  const mode = storeMode();
  if (mode === 'none') return { outcome: 'unavailable' };
  if (mode === 'sandbox') return deliver({ productId, sandbox: true });

  const module = await revenueCat().catch(() => null);
  if (!module) return { outcome: 'unavailable' };
  try {
    if (!products.has(productId)) await loadStorePrices();
    const product = products.get(productId);
    if (!product) return { outcome: 'unavailable' };
    const { transaction } = await module.Purchases.purchaseStoreProduct({ product });
    const pending = { productId, transactionId: transaction.transactionIdentifier };
    // Önce telefona yazılır: uygulama tam şimdi kapansa bile ödeme kaybolmaz.
    writePending([...readPending(), pending]);
    return deliver(pending);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === module.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { outcome: 'cancelled' };
    if (code === module.PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return { outcome: 'pending' };
    return { outcome: 'failed' };
  }
}
