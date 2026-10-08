import { BOOSTER_IDS, ECONOMY, HELPER_IDS, ITEM_IDS, type BoosterId, type HelperId, type ItemId } from '../config/economy';
import { OBSTACLE_CONFIG } from '../config/obstacles';
import type { GameServices } from './game';

/**
 * Oyuncunun ekonomiyi değiştiren her işlemi bir komuttur. İstemci komutu hemen yerelde uygular
 * (internetsiz oynanabilsin) ve günlüğe yazar; sunucu aynı komutları aynı kurallarla (bu dosya)
 * kendi kaydında yeniden oynatır. Kural tek yerde olduğu için istemci ve sunucu ayrışmaz;
 * kurala uymayan komut (hile ya da bozuk istemci) sunucuda reddedilir.
 *
 * `at`: komutun anı (ms). Can yenilenmesi ve günlük ödül bu ana göre hesaplanır.
 */
export type Command =
  | { readonly type: 'claimUnlocks'; readonly level: number; readonly at: number }
  | { readonly type: 'startLevel'; readonly level: number; readonly boosters: readonly BoosterId[]; readonly at: number }
  | { readonly type: 'buyExtraMoves'; readonly at: number }
  | { readonly type: 'useItem'; readonly item: HelperId; readonly at: number }
  | { readonly type: 'winLevel'; readonly level: number; readonly coins: number; readonly at: number }
  | { readonly type: 'loseLevel'; readonly level: number; readonly at: number }
  | { readonly type: 'buyPack'; readonly item: ItemId; readonly at: number }
  | { readonly type: 'refillLives'; readonly at: number }
  | { readonly type: 'buyOneLife'; readonly at: number }
  | { readonly type: 'buySingleItem'; readonly item: ItemId; readonly at: number }
  | { readonly type: 'buyMissingMaterial'; readonly missingAmount: number; readonly at: number }
  | { readonly type: 'buyChest'; readonly chestId: string; readonly at: number }
  | { readonly type: 'buyShipUpgrade'; readonly upgradeId: string; readonly at: number }
  | { readonly type: 'buyPiggyBank'; readonly at: number }
  | { readonly type: 'claimDaily'; readonly tz: number; readonly at: number }
  | { readonly type: 'build'; readonly task: string; readonly design: number; readonly at: number }
  | { readonly type: 'changeDesign'; readonly task: string; readonly design: number; readonly at: number }
  | { readonly type: 'buyCoinsPack'; readonly coins: number; readonly at: number }
  // Yalnızca geliştirme sunucusunda kabul edilir (DEV_COMMANDS=1).
  | { readonly type: 'devAddStars'; readonly amount: number; readonly at: number }
  | { readonly type: 'devSetLevel'; readonly level: number; readonly at: number }
  | { readonly type: 'devStartLevel'; readonly level: number; readonly at: number }
  | { readonly type: 'devReset'; readonly at: number };

export type CommandType = Command['type'];

export type CommandResult = { readonly ok: true; readonly value?: unknown } | { readonly ok: false; readonly reason: string };

/** Komutları doğrulamak için seviye bilgisi ve ortam kuralları. */
export interface CommandRules {
  /** Seviyenin hamle ve sandık sayısı; seviye yoksa null. */
  level(id: number): { readonly moves: number; readonly chests: number } | null;
  /** Geliştirici komutlarına izin var mı. */
  readonly allowDev: boolean;
  /** Bir seviyenin en kısa süresi (ms): başlatıp anında "kazandım" denemesin. */
  readonly minLevelMs: number;
}

export const DEFAULT_MIN_LEVEL_MS = 3000;

/** Bir seviyeyi kazanınca alınabilecek en fazla altın (bölüm altını + her hamle bonus + sandıklar). */
export function maxWinCoins(moves: number, extraMoves: number, chests: number): number {
  return (ECONOMY.levelWinCoins + (moves + extraMoves) * ECONOMY.coinsPerBonusMove + chests * OBSTACLE_CONFIG.chestCoins) * 2;
}

const fail = (reason: string): CommandResult => ({ ok: false, reason });
const ok = (value?: unknown): CommandResult => ({ ok: true, value });

/**
 * Komutu oyun servislerine uygular. Başarısız komut kaydı değiştirmez (önce koşullar denetlenir).
 * Saat komutun anına sabitlenir.
 */
export function applyCommand(game: GameServices, cmd: Command, rules: CommandRules): CommandResult {
  game.clock.fixed = cmd.at;
  game.clock.tz = cmd.type === 'claimDaily' ? cmd.tz : null;
  try {
    return run(game, cmd, rules);
  } finally {
    game.clock.fixed = null;
    game.clock.tz = null;
  }
}

function run(game: GameServices, cmd: Command, rules: CommandRules): CommandResult {
  const { save, lives, inventory, levels, town, daily, wallet } = game;
  const data = save.data;

  switch (cmd.type) {
    case 'claimUnlocks': {
      if (cmd.level > data.level) return fail('level-locked');
      return ok(inventory.claimUnlocks(cmd.level));
    }

    case 'startLevel': {
      if (cmd.level > data.level || !rules.level(cmd.level)) return fail('level-locked');
      if (new Set(cmd.boosters).size !== cmd.boosters.length) return fail('booster-duplicate');
      for (const id of cmd.boosters) {
        if (!inventory.isUnlocked(id) || inventory.count(id) <= 0) return fail('booster-missing');
      }
      if (!lives.spend()) return fail('no-lives');
      for (const id of cmd.boosters) inventory.use(id);
      save.update((d) => {
        d.attempt = { level: cmd.level, startedAt: cmd.at, extraMoves: 0 };
      });
      return ok();
    }

    case 'buyExtraMoves': {
      if (!data.attempt) return fail('no-attempt');
      if (!wallet.trySpendCoins(ECONOMY.extraMoves.cost)) return fail('coins');
      save.update((d) => {
        if (d.attempt) d.attempt.extraMoves += ECONOMY.extraMoves.count;
      });
      return ok();
    }

    case 'useItem': {
      if (!data.attempt) return fail('no-attempt');
      if (!inventory.isUnlocked(cmd.item)) return fail('item-locked');
      return inventory.use(cmd.item) ? ok() : fail('item-missing');
    }

    case 'winLevel': {
      const attempt = data.attempt;
      if (!attempt || attempt.level !== cmd.level) return fail('no-attempt');
      const level = rules.level(cmd.level);
      if (!level) return fail('level-unknown');
      if (cmd.at - attempt.startedAt < rules.minLevelMs) return fail('too-fast');
      if (cmd.coins < 0 || cmd.coins > maxWinCoins(level.moves, attempt.extraMoves, level.chests)) return fail('coins-limit');
      save.update((d) => {
        d.attempt = null;
      });
      lives.refund();
      return ok(levels.recordWin(cmd.level, cmd.coins));
    }

    case 'loseLevel': {
      if (!data.attempt || data.attempt.level !== cmd.level) return fail('no-attempt');
      save.update((d) => {
        d.attempt = null;
      });
      levels.recordLoss();
      return ok();
    }

    case 'buyPack': {
      if (!inventory.isUnlocked(cmd.item)) return fail('item-locked');
      return inventory.buyPack(cmd.item) ? ok() : fail('coins');
    }

    case 'buySingleItem': {
      if (!inventory.isUnlocked(cmd.item)) return fail('item-locked');
      const itemConfig = ECONOMY.items[cmd.item];
      if (!wallet.trySpendCoins(itemConfig.singlePrice)) return fail('coins');
      save.update((d) => {
        d.inventory[cmd.item] = (d.inventory[cmd.item] || 0) + 1;
      });
      return ok();
    }

    case 'buyMissingMaterial': {
      const cost = cmd.missingAmount * ECONOMY.missingMaterialGoldCost;
      if (!wallet.trySpendCoins(cost)) return fail('coins');
      save.update((d) => {
        d.materials += cmd.missingAmount;
      });
      return ok();
    }

    case 'buyChest': {
      const chestConfig = Object.values(ECONOMY.chests).find(c => c.id === cmd.chestId);
      if (!chestConfig) return fail('chest-unknown');
      if (!wallet.trySpendCoins(chestConfig.priceGold)) return fail('coins');
      
      save.update((d) => {
        d.materials += chestConfig.guaranteedMaterial;
        // Opsiyonel: Sandık içinden çıkan rastgele eşyaları (booster vs.) da burada d'ye ekleyebiliriz.
      });
      return ok();
    }

    case 'buyShipUpgrade': {
      // TypeScript type assertion required for shipUpgrades as it's an object with known keys
      const config = (ECONOMY.shipUpgrades as Record<string, any>)[cmd.upgradeId];
      if (!config) return fail('upgrade-unknown');
      const currentLevel = data.ship[cmd.upgradeId] || 0;
      if (currentLevel >= config.maxLevel) return fail('max-level');
      
      const nextLevelConfig = config.levels.find((l: any) => l.level === currentLevel + 1);
      if (!nextLevelConfig) return fail('level-config-missing');
      
      if (data.materials < nextLevelConfig.costMaterial) return fail('materials');
      if (nextLevelConfig.costGold > 0 && data.coins < nextLevelConfig.costGold) return fail('coins');
      
      if (nextLevelConfig.costGold > 0) {
        if (!wallet.trySpendCoins(nextLevelConfig.costGold)) return fail('coins');
      }
      
      save.update((d) => {
        d.materials -= nextLevelConfig.costMaterial;
        d.ship[cmd.upgradeId] = currentLevel + 1;
      });
      return ok();
    }

    case 'buyPiggyBank': {
      const piggy = data.piggyBank?.coins || 0;
      if (piggy < ECONOMY.piggyBank.maxCoins) return fail('piggy-not-full');
      if (data.coins < ECONOMY.piggyBank.priceGold) return fail('coins');

      save.update((d) => {
        d.coins -= ECONOMY.piggyBank.priceGold;
        d.coins += piggy;
        if (d.piggyBank) d.piggyBank.coins = 0;
      });
      return ok();
    }

    case 'refillLives':
      return lives.buyRefill() ? ok() : fail('refill');
      
    case 'buyOneLife':
      return lives.buyOneLife() ? ok() : fail('refill');

    case 'claimDaily': {
      const reward = daily.claim();
      return reward ? ok(reward) : fail('already-claimed');
    }

    case 'build': {
      const result = town.build(cmd.task, cmd.design);
      return result.ok ? ok(result) : fail(result.reason);
    }

    case 'changeDesign':
      return town.changeDesign(cmd.task, cmd.design) ? ok() : fail('not-built');

    case 'buyCoinsPack': {
      save.update((d) => void (d.coins += cmd.coins));
      return ok();
    }

    case 'devAddStars':
    case 'devSetLevel':
    case 'devStartLevel':
    case 'devReset': {
      if (!rules.allowDev) return fail('dev-disabled');
      if (cmd.type === 'devReset') save.reset();
      else if (cmd.type === 'devAddStars') save.update((d) => void (d.stars += cmd.amount));
      else if (cmd.type === 'devSetLevel') save.update((d) => void (d.level = cmd.level));
      else {
        if (!rules.level(cmd.level)) return fail('level-unknown');
        save.update((d) => {
          d.attempt = { level: cmd.level, startedAt: cmd.at, extraMoves: 0 };
        });
      }
      return ok();
    }
  }
}

// ───────────────────────── sunucuya gelen veriyi doğrulama ─────────────────────────

const isInt = (v: unknown, min = -Infinity, max = Infinity): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

/** Ağdan gelen ham komutu doğrular; biçimi bozuksa null (sunucu "invalid" olarak reddeder). */
export function parseCommand(raw: unknown): Command | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (!isInt(c.at, 0)) return null;
  const at = c.at;
  switch (c.type) {
    case 'claimUnlocks':
    case 'loseLevel':
    case 'devSetLevel':
    case 'devStartLevel':
      return isInt(c.level, 1, 100_000) ? { type: c.type, level: c.level, at } : null;
    case 'startLevel':
      return isInt(c.level, 1, 100_000) && Array.isArray(c.boosters) && c.boosters.length <= BOOSTER_IDS.length && c.boosters.every((b) => oneOf(BOOSTER_IDS, b))
        ? { type: 'startLevel', level: c.level, boosters: c.boosters as BoosterId[], at }
        : null;
    case 'buyExtraMoves':
    case 'refillLives':
    case 'buyOneLife':
    case 'devReset':
      return { type: c.type, at };
    case 'useItem':
      return oneOf(HELPER_IDS, c.item) ? { type: 'useItem', item: c.item, at } : null;
    case 'winLevel':
      return isInt(c.level, 1, 100_000) && isInt(c.coins, 0, 1_000_000) ? { type: 'winLevel', level: c.level, coins: c.coins, at } : null;
    case 'buyPack':
      return oneOf(ITEM_IDS, c.item) ? { type: 'buyPack', item: c.item, at } : null;
    case 'buySingleItem':
      return oneOf(ITEM_IDS, c.item) ? { type: 'buySingleItem', item: c.item, at } : null;
    case 'buyMissingMaterial':
      return isInt(c.missingAmount, 1, 1000) ? { type: 'buyMissingMaterial', missingAmount: c.missingAmount, at } : null;
    case 'buyChest':
      return typeof c.chestId === 'string' ? { type: 'buyChest', chestId: c.chestId, at } : null;
    case 'buyShipUpgrade':
      return typeof c.upgradeId === 'string' ? { type: 'buyShipUpgrade', upgradeId: c.upgradeId, at } : null;
    case 'buyPiggyBank':
      return { type: 'buyPiggyBank', at };
    case 'claimDaily':
      // Gerçek saat dilimleri -14 ile +12 saat arasıdır.
      return isInt(c.tz, -840, 720) ? { type: 'claimDaily', tz: c.tz, at } : null;
    case 'build':
    case 'changeDesign':
      return typeof c.task === 'string' && c.task.length <= 64 && isInt(c.design, 0, 2)
        ? { type: c.type, task: c.task, design: c.design, at }
        : null;
    case 'buyCoinsPack':
      return isInt(c.coins, 1, 100_000) ? { type: 'buyCoinsPack', coins: c.coins, at } : null;
    case 'devAddStars':
      return isInt(c.amount, 1, 100) ? { type: 'devAddStars', amount: c.amount, at } : null;
    default:
      return null;
  }
}
