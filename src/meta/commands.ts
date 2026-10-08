import {
  BOOSTER_IDS,
  CHEST_IDS,
  ECONOMY,
  HELPER_IDS,
  ITEM_IDS,
  MATERIAL_IDS,
  SHIP_UPGRADE_IDS,
  type BoosterId,
  type ChestId,
  type HelperId,
  type ItemId,
  type MaterialId,
  type ShipUpgradeId,
} from '../config/economy';
import { OBSTACLE_CONFIG } from '../config/obstacles';
import type { GameServices } from './game';
import { extraMovesBought, extraMovesCost } from './pricing';

/**
 * Oyuncunun ekonomiyi değiştiren her işlemi bir komuttur. İstemci komutu hemen yerelde uygular
 * (internetsiz oynanabilsin) ve günlüğe yazar; sunucu aynı komutları aynı kurallarla (bu dosya)
 * kendi kaydında yeniden oynatır. Kural tek yerde olduğu için istemci ve sunucu ayrışmaz;
 * kurala uymayan komut (hile ya da bozuk istemci) sunucuda reddedilir.
 *
 * Gerçek parayla alınan altın komut değildir: sunucu ödemeyi mağazadan doğrulayıp kayda kendisi
 * işler (server/src/app.ts POST /purchases). Böylece istemci kendine altın yazamaz.
 *
 * `at`: komutun anı (ms). Can yenilenmesi, inşaat süresi ve günlük ödül bu ana göre hesaplanır.
 */
export type Command =
  | { readonly type: 'claimUnlocks'; readonly level: number; readonly at: number }
  | { readonly type: 'startLevel'; readonly level: number; readonly boosters: readonly BoosterId[]; readonly at: number }
  | { readonly type: 'buyExtraMoves'; readonly at: number }
  | { readonly type: 'useItem'; readonly item: HelperId; readonly at: number }
  | { readonly type: 'winLevel'; readonly level: number; readonly coins: number; readonly at: number }
  | { readonly type: 'loseLevel'; readonly level: number; readonly at: number }
  | { readonly type: 'buyPack'; readonly item: ItemId; readonly at: number }
  | { readonly type: 'buySingleItem'; readonly item: ItemId; readonly at: number }
  | { readonly type: 'refillLives'; readonly at: number }
  | { readonly type: 'buyOneLife'; readonly at: number }
  | { readonly type: 'claimDaily'; readonly tz: number; readonly at: number }
  | { readonly type: 'build'; readonly task: string; readonly design: number; readonly at: number }
  | { readonly type: 'finishBuild'; readonly at: number }
  | { readonly type: 'speedUpBuild'; readonly at: number }
  | { readonly type: 'fillMaterials'; readonly task: string; readonly currency: 'stars' | 'coins'; readonly at: number }
  | { readonly type: 'changeDesign'; readonly task: string; readonly design: number; readonly at: number }
  | { readonly type: 'buyMaterial'; readonly material: MaterialId; readonly bundle: number; readonly at: number }
  | { readonly type: 'buyStars'; readonly pack: number; readonly at: number }
  | { readonly type: 'openChest'; readonly chest: ChestId; readonly at: number }
  | { readonly type: 'upgradeShip'; readonly upgrade: ShipUpgradeId; readonly at: number }
  | { readonly type: 'resetProgress'; readonly at: number }
  // Yalnızca geliştirme sunucusunda kabul edilir (DEV_COMMANDS=1).
  | { readonly type: 'devAddStars'; readonly amount: number; readonly at: number }
  | { readonly type: 'devSetLevel'; readonly level: number; readonly at: number }
  | { readonly type: 'devStartLevel'; readonly level: number; readonly at: number };

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

/**
 * Bir seviyeyi kazanınca bildirilebilecek en fazla bölüm altını: bölüm altını + her hamle (ek hamleler
 * dahil) bonus + sandıklar. Gemi gövdesi bonusunu istemci değil kural ekler (LevelProgress.recordWin).
 */
export function maxWinCoins(moves: number, extraMoves: number, chests: number): number {
  return ECONOMY.levelWinCoins + (moves + extraMoves) * ECONOMY.coinsPerBonusMove + chests * OBSTACLE_CONFIG.chestCoins;
}

const fail = (reason: string): CommandResult => ({ ok: false, reason });
const ok = (value?: unknown): CommandResult => ({ ok: true, value });
const fromResult = (r: { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly reason: string }): CommandResult =>
  r.ok ? ok(r.value) : fail(r.reason);

/**
 * Komutu oyun servislerine uygular. Başarısız komut kaydı değiştirmez (önce koşullar denetlenir).
 * Saat komutun anına sabitlenir; başarılı komut kaydın saatini ileri taşır.
 */
export function applyCommand(game: GameServices, cmd: Command, rules: CommandRules): CommandResult {
  game.clock.fixed = cmd.at;
  game.clock.tz = cmd.type === 'claimDaily' ? cmd.tz : null;
  try {
    const result = run(game, cmd, rules);
    if (result.ok && cmd.at > game.save.data.clock) game.save.update((d) => void (d.clock = cmd.at));
    return result;
  } finally {
    game.clock.fixed = null;
    game.clock.tz = null;
  }
}

function run(game: GameServices, cmd: Command, rules: CommandRules): CommandResult {
  const { save, lives, inventory, levels, town, daily, wallet, market } = game;
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
      const cost = extraMovesCost(extraMovesBought(data.attempt.extraMoves));
      if (!wallet.trySpendCoins(cost)) return fail('coins');
      save.update((d) => {
        if (d.attempt) d.attempt.extraMoves += ECONOMY.extraMoves.count;
      });
      return ok(cost);
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
      if (!wallet.trySpendCoins(ECONOMY.items[cmd.item].singlePrice)) return fail('coins');
      inventory.add({ [cmd.item]: 1 });
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

    case 'finishBuild': {
      const result = town.finish();
      return result.ok ? ok(result) : fail(result.reason);
    }

    case 'speedUpBuild': {
      const result = town.speedUp();
      return result.ok ? ok(result) : fail(result.reason);
    }

    case 'fillMaterials': {
      const result = town.fillMissing(cmd.task, cmd.currency);
      return result.ok ? ok(result) : fail(result.reason);
    }

    case 'changeDesign':
      return town.changeDesign(cmd.task, cmd.design) ? ok() : fail('not-built');

    case 'buyMaterial':
      return fromResult(market.buyMaterial(cmd.material, cmd.bundle));

    case 'buyStars':
      return fromResult(market.buyStars(cmd.pack));

    case 'openChest':
      return fromResult(market.openChest(cmd.chest));

    case 'upgradeShip':
      return fromResult(market.upgradeShip(cmd.upgrade));

    case 'resetProgress':
      save.reset();
      return ok();

    case 'devAddStars':
    case 'devSetLevel':
    case 'devStartLevel': {
      if (!rules.allowDev) return fail('dev-disabled');
      if (cmd.type === 'devAddStars') save.update((d) => void (d.stars += cmd.amount));
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
const isTaskId = (v: unknown): v is string => typeof v === 'string' && v.length <= 64;

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
    case 'finishBuild':
    case 'speedUpBuild':
    case 'resetProgress':
      return { type: c.type, at };
    case 'useItem':
      return oneOf(HELPER_IDS, c.item) ? { type: 'useItem', item: c.item, at } : null;
    case 'winLevel':
      return isInt(c.level, 1, 100_000) && isInt(c.coins, 0, 1_000_000) ? { type: 'winLevel', level: c.level, coins: c.coins, at } : null;
    case 'buyPack':
    case 'buySingleItem':
      return oneOf(ITEM_IDS, c.item) ? { type: c.type, item: c.item, at } : null;
    case 'claimDaily':
      // Gerçek saat dilimleri -14 ile +12 saat arasıdır.
      return isInt(c.tz, -840, 720) ? { type: 'claimDaily', tz: c.tz, at } : null;
    case 'build':
    case 'changeDesign':
      return isTaskId(c.task) && isInt(c.design, 0, 2) ? { type: c.type, task: c.task, design: c.design, at } : null;
    case 'fillMaterials':
      return isTaskId(c.task) && (c.currency === 'stars' || c.currency === 'coins')
        ? { type: 'fillMaterials', task: c.task, currency: c.currency, at }
        : null;
    case 'buyMaterial':
      return oneOf(MATERIAL_IDS, c.material) && isInt(c.bundle, 0, ECONOMY.market.length - 1)
        ? { type: 'buyMaterial', material: c.material, bundle: c.bundle, at }
        : null;
    case 'buyStars':
      return isInt(c.pack, 0, ECONOMY.starPacks.length - 1) ? { type: 'buyStars', pack: c.pack, at } : null;
    case 'openChest':
      return oneOf(CHEST_IDS, c.chest) ? { type: 'openChest', chest: c.chest, at } : null;
    case 'upgradeShip':
      return oneOf(SHIP_UPGRADE_IDS, c.upgrade) ? { type: 'upgradeShip', upgrade: c.upgrade, at } : null;
    case 'devAddStars':
      return isInt(c.amount, 1, 100) ? { type: 'devAddStars', amount: c.amount, at } : null;
    default:
      return null;
  }
}
