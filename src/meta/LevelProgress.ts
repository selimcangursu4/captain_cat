import { ECONOMY, type MaterialId } from '../config/economy';
import type { SaveService } from '../services/SaveService';
import { levelReward, type LevelReward } from './levelRewards';
import type { Lives } from './Lives';
import { shipBonus } from './pricing';
import type { TownProgress } from './TownProgress';

/** Bölüm sonucu kaydedildikten sonra ne değişti? */
export interface LevelRewardResult {
  /** Yeni bir seviye geçildiyse kazanılan yıldız (tekrar oynanan seviyede 0). */
  readonly stars: number;
  /** Yeni seviyede gelen malzeme (kasabanın en çok ihtiyaç duyduğu); tekrar oynanan seviyede null. */
  readonly material: { readonly id: MaterialId; readonly amount: number } | null;
  /** Kazanılan bölüm altını (gemi gövdesi yükseltmesi dahil). */
  readonly coins: number;
  readonly nextLevel: number;
  /** Yeni seviyenin ödülü (can, sandık); tekrar oynanan seviyede null. */
  readonly reward: LevelReward | null;
}

/**
 * Seviye ilerlemesi: her bölüm bir seviyedir. Sıradaki (yeni) seviyeyi geçmek yıldız, malzeme,
 * kumbara altını ve seviye ödülü verir (can; her 10 seviyede hediye sandığı). Tekrar oynanan eski
 * seviyeler (geliştirici paneli) yalnızca bölüm altınını verir.
 */
export class LevelProgress {
  constructor(
    private readonly save: SaveService,
    /** Şu an oyunda olan seviye sayısı (zamanla artar; sunucudan da gelebilir). */
    private readonly levelCount: () => number,
    private readonly lives?: Lives,
    private readonly town?: TownProgress,
  ) {}

  /** Oynanacak sıradaki seviye; tüm seviyeler bittiyse null. */
  get currentLevel(): number | null {
    return this.save.data.level <= this.levelCount() ? this.save.data.level : null;
  }

  get allLevelsDone(): boolean {
    return this.save.data.level > this.levelCount();
  }

  /** baseCoins: bölümde kazanılan altın (bölüm + kalan hamle + sandıklar); gemi gövdesi bonusu burada eklenir. */
  recordWin(levelId: number, baseCoins: number): LevelRewardResult {
    const data = this.save.data;
    const isNew = levelId === data.level;
    const reward = isNew ? levelReward(levelId) : null;
    const coins = Math.floor((baseCoins * (100 + shipBonus('hull', data.ship.hull))) / 100);
    const stars = isNew ? ECONOMY.levelWinStars : 0;
    const material = isNew
      ? {
          id: this.town?.mostNeededMaterial(levelId) ?? 'wood',
          amount: ECONOMY.levelWinMaterial + shipBonus('storage', data.ship.storage),
        }
      : null;
    this.save.update((d) => {
      d.coins += coins + (reward?.coins ?? 0);
      d.stats.levelsWon += 1;
      if (!isNew) return;
      d.level += 1;
      d.stars += stars;
      if (material) d.materials[material.id] += material.amount;
      d.piggyBank.coins = Math.min(ECONOMY.piggyBank.maxCoins, d.piggyBank.coins + ECONOMY.piggyBank.coinsPerWin);
      for (const [id, n] of Object.entries(reward?.items ?? {})) d.inventory[id as keyof typeof d.inventory] += n ?? 0;
    });
    // Can ödülü Lives üzerinden: yenilenme sayacı da doğru güncellensin.
    if (reward) this.lives?.grant(reward.lives);
    return { stars, material, coins, nextLevel: this.save.data.level, reward };
  }

  recordLoss(): void {
    this.save.update((d) => {
      d.stats.levelsLost += 1;
    });
  }
}
