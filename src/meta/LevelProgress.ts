import type { SaveService } from '../services/SaveService';
import { levelReward, type LevelReward } from './levelRewards';
import type { Lives } from './Lives';

/** Bölüm sonucu kaydedildikten sonra ne değişti? */
export interface LevelRewardResult {
  /** Yeni bir seviye geçildiyse kazanılan yıldız (tekrar oynanan seviyede 0). */
  readonly stars: number;
  readonly coins: number;
  readonly nextLevel: number;
  /** Yeni seviyenin ödülü (can, sandık); tekrar oynanan seviyede null. */
  readonly reward: LevelReward | null;
}

/**
 * Seviye ilerlemesi: her bölüm bir seviyedir. Sıradaki (yeni) seviyeyi geçmek yıldız, ilerleme
 * ve seviye ödülü verir (can; her 10 seviyede hediye sandığı). Tekrar oynanan eski seviyeler
 * (geliştirici paneli) yalnızca bölüm altınını verir.
 */
export class LevelProgress {
  constructor(
    private readonly save: SaveService,
    /** Şu an oyunda olan seviye sayısı (zamanla artar; sunucudan da gelebilir). */
    private readonly levelCount: () => number,
    private readonly lives?: Lives,
  ) {}

  /** Oynanacak sıradaki seviye; tüm seviyeler bittiyse null. */
  get currentLevel(): number | null {
    return this.save.data.level <= this.levelCount() ? this.save.data.level : null;
  }

  get allLevelsDone(): boolean {
    return this.save.data.level > this.levelCount();
  }

  recordWin(levelId: number, coins: number): LevelRewardResult {
    const isNew = levelId === this.save.data.level;
    const reward = isNew ? levelReward(levelId) : null;
    this.save.update((d) => {
      d.coins += coins + (reward?.coins ?? 0);
      d.stats.levelsWon += 1;
      if (!isNew) return;
      d.stars += 1;
      d.level += 1;
      for (const [id, n] of Object.entries(reward?.items ?? {})) d.inventory[id as keyof typeof d.inventory] += n ?? 0;
    });
    // Can ödülü Lives üzerinden: yenilenme sayacı da doğru güncellensin.
    if (reward) this.lives?.grant(reward.lives);
    return { stars: isNew ? 1 : 0, coins, nextLevel: this.save.data.level, reward };
  }

  recordLoss(): void {
    this.save.update((d) => {
      d.stats.levelsLost += 1;
    });
  }
}
