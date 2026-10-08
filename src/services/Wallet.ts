import { saveService, type SaveService } from './SaveService';

/**
 * Altın cüzdanı. Oyun kodu yalnızca bu arayüzü kullanır; altın kayıt sisteminde tutulur.
 */
export interface Wallet {
  readonly coins: number;
  readonly materials: number;
  
  addCoins(amount: number): void;
  addMaterials(amount: number): void;
  
  /** Yeterli altın varsa düşer ve true döner. */
  trySpendCoins(amount: number): boolean;
  /** Yeterli material varsa düşer ve true döner. */
  trySpendMaterials(amount: number): boolean;
  
  /** Değişiklikleri dinler; dinlemeyi bırakmak için dönen fonksiyonu çağırın. */
  onCoinsChange(listener: (coins: number) => void): () => void;
  onMaterialsChange(listener: (materials: number) => void): () => void;
}

/** Kayıt dosyasında tutulan cüzdan. */
export class SavedWallet implements Wallet {
  constructor(private readonly save: SaveService) {}

  get coins(): number {
    return this.save.data.coins;
  }
  
  get materials(): number {
    return this.save.data.materials;
  }

  addCoins(amount: number): void {
    if (amount <= 0) return;
    this.save.update((d) => {
      d.coins += amount;
    });
  }
  
  addMaterials(amount: number): void {
    if (amount <= 0) return;
    this.save.update((d) => {
      d.materials += amount;
    });
  }

  trySpendCoins(amount: number): boolean {
    if (amount > this.coins) return false;
    this.save.update((d) => {
      d.coins -= amount;
    });
    return true;
  }
  
  trySpendMaterials(amount: number): boolean {
    if (amount > this.materials) return false;
    this.save.update((d) => {
      d.materials -= amount;
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
  
  onMaterialsChange(listener: (materials: number) => void): () => void {
    let last = this.materials;
    return this.save.onChange((data) => {
      if (data.materials !== last) {
        last = data.materials;
        listener(data.materials);
      }
    });
  }
}

export const wallet: Wallet = new SavedWallet(saveService);
