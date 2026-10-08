import { ECONOMY, ITEM_IDS, type ItemId } from '../config/economy';
import type { SaveService } from '../services/SaveService';
import type { Wallet } from '../services/Wallet';

/**
 * Yardımcılar ve bölüm öncesi güçlendiriciler. Her eşya belirli bir bölümde açılır
 * (açılınca hediye verilir); bitince altınla paket alınır.
 */
export class Inventory {
  constructor(
    private readonly save: SaveService,
    private readonly wallet: Wallet,
  ) {}

  count(id: ItemId): number {
    return this.save.data.inventory[id];
  }

  isUnlocked(id: ItemId): boolean {
    return this.save.data.unlocked.includes(id);
  }

  /** 1 adet kullanır; yoksa false. */
  use(id: ItemId): boolean {
    if (this.count(id) <= 0) return false;
    this.save.update((d) => {
      d.inventory[id] -= 1;
    });
    return true;
  }

  add(items: Partial<Record<ItemId, number>>): void {
    const entries = Object.entries(items).filter(([, n]) => (n ?? 0) > 0) as [ItemId, number][];
    if (entries.length === 0) return;
    this.save.update((d) => {
      for (const [id, n] of entries) d.inventory[id] += n;
    });
  }

  /** Altınla paket alır (ECONOMY.items[id].pack adet). Altın yetmezse false. */
  buyPack(id: ItemId): boolean {
    const { pack, price } = ECONOMY.items[id];
    if (!this.wallet.trySpend(price)) return false;
    this.add({ [id]: pack });
    return true;
  }

  /**
   * Bu bölüme kadar açılan ama hediyesi henüz verilmemiş eşyaları açar ve hediyelerini verir.
   * Yeni açılanları döndürür (tanıtım penceresi için).
   */
  claimUnlocks(levelId: number): ItemId[] {
    const fresh = ITEM_IDS.filter((id) => ECONOMY.items[id].unlockLevel <= levelId && !this.isUnlocked(id));
    if (fresh.length === 0) return [];
    this.save.update((d) => {
      for (const id of fresh) {
        d.unlocked.push(id);
        d.inventory[id] += ECONOMY.items[id].gift;
      }
    });
    return fresh;
  }
}
