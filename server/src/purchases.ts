/// <reference types="node" />

/** Ödemenin mağazada gerçekten bu hesap için yapıldığını doğrular. */
export interface PurchaseVerifier {
  verify(userId: string, productId: string, transactionId: string): Promise<boolean>;
}

interface RevenueCatSubscriber {
  readonly subscriber?: {
    readonly non_subscriptions?: Record<string, readonly { readonly id?: string; readonly store_transaction_id?: string }[]>;
  };
}

/**
 * RevenueCat REST API (v1) ile doğrulama. İstemci RevenueCat'i hesap kimliğiyle (appUserID = User.id)
 * kurar; böylece satın alma bu hesabın abone kaydında görünür. Tek seferlik ürünler
 * `non_subscriptions[ürün]` listesindedir; mağazanın işlem kimliği `store_transaction_id`'dir.
 * Gizli anahtar (sk_…) yalnızca sunucudadır (.env REVENUECAT_SECRET_KEY).
 */
export class RevenueCatVerifier implements PurchaseVerifier {
  constructor(
    private readonly secretKey: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly baseUrl = 'https://api.revenuecat.com/v1',
  ) {}

  async verify(userId: string, productId: string, transactionId: string): Promise<boolean> {
    const response = await this.fetchFn(`${this.baseUrl}/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${this.secretKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`RevenueCat yanıtı: ${response.status}`);
    const body = (await response.json()) as RevenueCatSubscriber;
    const transactions = body.subscriber?.non_subscriptions?.[productId] ?? [];
    return transactions.some((t) => t.store_transaction_id === transactionId || t.id === transactionId);
  }
}
