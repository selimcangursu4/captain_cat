import { saveService, type SaveService } from './SaveService';

/**
 * Cüzdan: altın ve yıldız. Oyun kodu yalnızca bu arayüzü kullanır; değerler kayıt sisteminde tutulur.
 * Altın: gerçek parayla da alınan para birimi (can, güçlendirici, hızlandırma, sandık…).
 * Yıldız: seviyelerden gelir (altınla da takas edilir); Pazar'da malzemeye harcanır.
 */
export interface Wallet {
  readonly coins: number;
  readonly stars: number;

  addCoins(amount: number): void;
  addStars(amount: number): void;

  /** Yeterli altın varsa düşer ve true döner. */
  trySpendCoins(amount: number): boolean;
  /** Yeterli yıldız varsa düşer ve true döner. */
  trySpendStars(amount: number): boolean;

  /** Değişiklikleri dinler; dinlemeyi bırakmak için dönen fonksiyonu çağırın. */
  onCoinsChange(listener: (coins: number) => void): () => void;
}

/** Kayıt dosyasında tutulan cüzdan. */
export class SavedWallet implements Wallet {
  constructor(private readonly save: SaveService) {}

  get coins(): number {
    return this.save.data.coins;
  }

  get stars(): number {
    return this.save.data.stars;
  }

  addCoins(amount: number): void {
    if (amount <= 0) return;
    this.save.update((d) => {
      d.coins += amount;
    });
  }

  addStars(amount: number): void {
    if (amount <= 0) return;
    this.save.update((d) => {
      d.stars += amount;
    });
  }

  trySpendCoins(amount: number): boolean {
    if (amount < 0 || amount > this.coins) return false;
    if (amount === 0) return true;
    this.save.update((d) => {
      d.coins -= amount;
    });
    return true;
  }

  trySpendStars(amount: number): boolean {
    if (amount < 0 || amount > this.stars) return false;
    if (amount === 0) return true;
    this.save.update((d) => {
      d.stars -= amount;
    });
    return true;
  }

  onCoinsChange(listener: (coins: number) => void): () => void {
    let last = this.coins;
    return this.save.onChange((data) => {
      if (data.coins !== last) {
        last = data.coins;
        listener(data.coins);
      }
    });
  }
}

export const wallet: Wallet = new SavedWallet(saveService);
