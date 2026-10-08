import { saveService, type SaveService } from './SaveService';

/**
 * Altın cüzdanı. Oyun kodu yalnızca bu arayüzü kullanır; altın kayıt sisteminde tutulur.
 */
export interface Wallet {
  readonly coins: number;
  add(amount: number): void;
  /** Yeterli altın varsa düşer ve true döner. */
  trySpend(amount: number): boolean;
  /** Değişiklikleri dinler; dinlemeyi bırakmak için dönen fonksiyonu çağırın. */
  onChange(listener: (coins: number) => void): () => void;
}

/** Altını kayıt dosyasında tutan cüzdan. */
export class SavedWallet implements Wallet {
  constructor(private readonly save: SaveService) {}

  get coins(): number {
    return this.save.data.coins;
  }

  add(amount: number): void {
    if (amount <= 0) return;
    this.save.update((d) => {
      d.coins += amount;
    });
  }

  trySpend(amount: number): boolean {
    if (amount > this.coins) return false;
    this.save.update((d) => {
      d.coins -= amount;
    });
    return true;
  }

  onChange(listener: (coins: number) => void): () => void {
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
