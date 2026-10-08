import type { RewardBundle } from '../config/economy';
import type { SaveService } from '../services/SaveService';
import { SavedWallet, type Wallet } from '../services/Wallet';
import { DailyReward } from './DailyReward';
import { Inventory } from './Inventory';
import { LevelProgress } from './LevelProgress';
import { Lives } from './Lives';
import { Market } from './Market';
import { grantBundle } from './rewards';
import { TownProgress } from './TownProgress';

/**
 * Oyun saati. Normalde gerçek zaman; bir komut uygulanırken komutun anına sabitlenir.
 * Böylece istemci ve sunucu aynı komutu aynı anla (can yenilenmesi, inşaat süresi, günlük ödül günü) işler.
 */
export interface GameClock {
  fixed: number | null;
  /** Günlük ödül için oyuncunun saat dilimi (komut uygulanırken). */
  tz: number | null;
}

export function createClock(): GameClock {
  return { fixed: null, tz: null };
}

/** Bir kaydın üzerinde çalışan tüm oyun servisleri. */
export interface GameServices {
  readonly save: SaveService;
  readonly clock: GameClock;
  readonly wallet: Wallet;
  readonly lives: Lives;
  readonly inventory: Inventory;
  readonly levels: LevelProgress;
  readonly town: TownProgress;
  readonly daily: DailyReward;
  readonly market: Market;
  /** Ödül paketini kayda işler (altın, yıldız, can, eşya, malzeme). */
  grant(bundle: RewardBundle): void;
}

/** İstemci (tarayıcı kaydı) ve sunucu (veritabanındaki kayıt) aynı fabrikayla kurar. */
export function createGame(save: SaveService, levelCount: () => number, clock: GameClock = createClock()): GameServices {
  const now = () => clock.fixed ?? Date.now();
  const tz = () => clock.tz ?? new Date().getTimezoneOffset();
  const wallet = new SavedWallet(save);
  const lives = new Lives(save, wallet, now);
  const inventory = new Inventory(save, wallet);
  const town = new TownProgress(save, wallet, now);
  const grant = (bundle: RewardBundle) => grantBundle(save, lives, bundle);
  return {
    save,
    clock,
    wallet,
    lives,
    inventory,
    levels: new LevelProgress(save, levelCount, lives, town),
    town,
    daily: new DailyReward(save, grant, now, tz),
    market: new Market(save, wallet, grant),
    grant,
  };
}
