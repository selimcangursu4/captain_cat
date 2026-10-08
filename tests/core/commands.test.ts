import { describe, expect, it } from 'vitest';
import { ECONOMY, MATERIAL_IDS, type RewardBundle } from '../../src/config/economy';
import { applyCommand, maxWinCoins, parseCommand, type Command, type CommandRules } from '../../src/meta/commands';
import { createGame } from '../../src/meta/game';
import { MemorySaveStorage, SaveService, defaultSave, type SaveData } from '../../src/services/SaveService';

const T0 = Date.UTC(2026, 9, 7, 10, 0);
const MINUTE = 60_000;
const rules: CommandRules = {
  level: (id) => (id >= 1 && id <= 200 ? { moves: 20, chests: 1 } : null),
  allowDev: false,
  minLevelMs: 3000,
};

function setup(mutate?: (d: SaveData) => void) {
  const save = new SaveService(new MemorySaveStorage());
  if (mutate) save.update(mutate);
  const game = createGame(save, () => 200);
  const run = (cmd: Command) => applyCommand(game, cmd, rules);
  return { save, game, run };
}

const rich = (d: SaveData) => {
  for (const id of MATERIAL_IDS) d.materials[id] = 1000;
  d.coins = 100_000;
  d.stars = 100;
};

describe('komutlar: seviye denemesi', () => {
  it('başlarken can düşer ve deneme açılır; kazanınca can geri gelir, ödül verilir, deneme kapanır', () => {
    const { save, run } = setup();
    expect(run({ type: 'startLevel', level: 1, boosters: [], at: T0 }).ok).toBe(true);
    expect(save.data.lives.count).toBe(4);
    expect(save.data.attempt).toEqual({ level: 1, startedAt: T0, extraMoves: 0 });
    const win = run({ type: 'winLevel', level: 1, coins: 50, at: T0 + MINUTE });
    expect(win).toMatchObject({ ok: true, value: { stars: 1, coins: 50, nextLevel: 2, material: { id: 'stone' } } });
    expect(save.data).toMatchObject({ level: 2, stars: 1, attempt: null, coins: ECONOMY.startingCoins + 50 });
    expect(save.data.lives.count).toBe(6); // geri gelen can + seviye ödülü
  });

  it('deneme açmadan, çok hızlı ya da sınırın üstünde altınla kazanılamaz (kayıt değişmez)', () => {
    const { save, run } = setup();
    const before = structuredClone(save.data);
    expect(run({ type: 'winLevel', level: 1, coins: 10, at: T0 })).toEqual({ ok: false, reason: 'no-attempt' });
    expect(save.data).toEqual(before);
    run({ type: 'startLevel', level: 1, boosters: [], at: T0 });
    expect(run({ type: 'winLevel', level: 1, coins: 10, at: T0 + 500 })).toEqual({ ok: false, reason: 'too-fast' });
    const cap = maxWinCoins(20, 0, 1);
    expect(run({ type: 'winLevel', level: 1, coins: cap + 1, at: T0 + MINUTE })).toEqual({ ok: false, reason: 'coins-limit' });
    expect(run({ type: 'winLevel', level: 2, coins: 10, at: T0 + MINUTE })).toEqual({ ok: false, reason: 'no-attempt' });
    expect(run({ type: 'winLevel', level: 1, coins: cap, at: T0 + MINUTE }).ok).toBe(true);
  });

  it('gemi gövdesi bonusu istemcinin bildirdiği altına kuralca eklenir (sınır bonusa göre gevşemez)', () => {
    const { save, run } = setup((d) => void (d.ship.hull = 3));
    run({ type: 'startLevel', level: 1, boosters: [], at: T0 });
    const cap = maxWinCoins(20, 0, 1);
    expect(run({ type: 'winLevel', level: 1, coins: cap + 1, at: T0 + MINUTE })).toEqual({ ok: false, reason: 'coins-limit' });
    const coins = save.data.coins;
    expect(run({ type: 'winLevel', level: 1, coins: 50, at: T0 + MINUTE })).toMatchObject({ ok: true, value: { coins: 65 } });
    expect(save.data.coins).toBe(coins + 65);
  });

  it('açılmamış seviye başlatılamaz; can yoksa başlatılamaz', () => {
    const { save, run } = setup((d) => {
      d.lives = { count: 0, nextAt: T0 + MINUTE };
    });
    expect(run({ type: 'startLevel', level: 5, boosters: [], at: T0 })).toEqual({ ok: false, reason: 'level-locked' });
    expect(run({ type: 'startLevel', level: 1, boosters: [], at: T0 })).toEqual({ ok: false, reason: 'no-lives' });
    expect(save.data.attempt).toBeNull();
    // Can zamanla gelince (komutun anına göre) başlatılabilir.
    expect(run({ type: 'startLevel', level: 1, boosters: [], at: T0 + 61_000 }).ok).toBe(true);
  });

  it('güçlendirici sahip olunmadan kullanılamaz; olunca harcanır', () => {
    const { save, run } = setup((d) => {
      d.unlocked = ['harpoon'];
      d.inventory.harpoon = 1;
    });
    expect(run({ type: 'startLevel', level: 1, boosters: ['cannon'], at: T0 })).toEqual({ ok: false, reason: 'booster-missing' });
    expect(save.data.lives.count).toBe(5);
    expect(run({ type: 'startLevel', level: 1, boosters: ['harpoon'], at: T0 }).ok).toBe(true);
    expect(save.data.inventory.harpoon).toBe(0);
  });

  it('kaybedince deneme kapanır, can geri gelmez; ek hamlenin fiyatı her alımda artar', () => {
    const { save, run } = setup();
    run({ type: 'startLevel', level: 1, boosters: [], at: T0 });
    expect(run({ type: 'buyExtraMoves', at: T0 + 1000 })).toEqual({ ok: true, value: 100 });
    expect(run({ type: 'buyExtraMoves', at: T0 + 2000 })).toEqual({ ok: true, value: 150 });
    expect(save.data.attempt?.extraMoves).toBe(2 * ECONOMY.extraMoves.count);
    expect(save.data.coins).toBe(ECONOMY.startingCoins - 250);
    expect(run({ type: 'buyExtraMoves', at: T0 + 3000 })).toEqual({ ok: false, reason: 'coins' }); // 200 gerekir, 50 var
    expect(run({ type: 'loseLevel', level: 1, at: T0 + 4000 }).ok).toBe(true);
    expect(save.data).toMatchObject({ attempt: null, stats: { levelsLost: 1 } });
    expect(save.data.lives.count).toBe(4);
    expect(run({ type: 'buyExtraMoves', at: T0 + 5000 })).toEqual({ ok: false, reason: 'no-attempt' });
  });

  it('yardımcı yalnızca seviye içinde ve sahip olunursa kullanılır', () => {
    const { save, run } = setup((d) => {
      d.unlocked = ['shovel'];
      d.inventory.shovel = 1;
    });
    expect(run({ type: 'useItem', item: 'shovel', at: T0 })).toEqual({ ok: false, reason: 'no-attempt' });
    run({ type: 'startLevel', level: 1, boosters: [], at: T0 });
    expect(run({ type: 'useItem', item: 'shovel', at: T0 + 1 }).ok).toBe(true);
    expect(run({ type: 'useItem', item: 'shovel', at: T0 + 2 })).toEqual({ ok: false, reason: 'item-missing' });
    expect(run({ type: 'useItem', item: 'helm', at: T0 + 3 })).toEqual({ ok: false, reason: 'item-locked' });
    expect(save.data.inventory.shovel).toBe(0);
  });
});

describe('komutlar: kasaba', () => {
  it('inşaat malzeme harcar ve süre ister; süre dolmadan bitmez; tasarım ancak bitince değişir', () => {
    const { save, run } = setup(rich);
    expect(run({ type: 'build', task: 'lighthouse.lantern', design: 0, at: T0 })).toEqual({ ok: false, reason: 'locked' });
    expect(run({ type: 'build', task: 'lighthouse.tower', design: 2, at: T0 }).ok).toBe(true);
    expect(save.data.town.construction).toEqual({ task: 'lighthouse.tower', design: 2, startedAt: T0, endsAt: T0 + MINUTE });
    expect(run({ type: 'changeDesign', task: 'lighthouse.tower', design: 1, at: T0 })).toEqual({ ok: false, reason: 'not-built' });
    expect(run({ type: 'build', task: 'lighthouse.lantern', design: 0, at: T0 + 1 })).toEqual({ ok: false, reason: 'busy' });
    expect(run({ type: 'finishBuild', at: T0 + MINUTE - 1 })).toEqual({ ok: false, reason: 'not-ready' });
    expect(run({ type: 'finishBuild', at: T0 + MINUTE }).ok).toBe(true);
    expect(save.data.town.built).toEqual({ 'lighthouse.tower': 2 });
    expect(run({ type: 'changeDesign', task: 'lighthouse.tower', design: 1, at: T0 + MINUTE }).ok).toBe(true);
    expect(run({ type: 'changeDesign', task: 'lighthouse.door', design: 1, at: T0 }).ok).toBe(false);
  });

  it('hızlandırma altın harcar; eksik malzeme yıldızla ya da altınla tamamlanır', () => {
    const { save, run } = setup();
    expect(run({ type: 'build', task: 'lighthouse.tower', design: 0, at: T0 })).toEqual({ ok: false, reason: 'materials' });
    expect(run({ type: 'fillMaterials', task: 'lighthouse.tower', currency: 'stars', at: T0 })).toEqual({ ok: false, reason: 'stars' });
    expect(run({ type: 'fillMaterials', task: 'lighthouse.tower', currency: 'coins', at: T0 })).toMatchObject({ ok: true });
    expect(run({ type: 'build', task: 'lighthouse.tower', design: 0, at: T0 }).ok).toBe(true);
    const coins = save.data.coins;
    expect(run({ type: 'speedUpBuild', at: T0 + 10_000 })).toMatchObject({ ok: true, value: { paid: 10 } });
    expect(save.data.coins).toBe(coins - 10);
    expect(save.data.town.built).toHaveProperty(['lighthouse.tower']);
    expect(run({ type: 'speedUpBuild', at: T0 + 20_000 })).toEqual({ ok: false, reason: 'none' });
  });

  it('kaydın saati geri gitmez: önceki komuttan daha eski anla inşaat başlatılamaz', () => {
    const { save, run } = setup(rich);
    run({ type: 'claimDaily', tz: 0, at: T0 + 60 * MINUTE });
    expect(save.data.clock).toBe(T0 + 60 * MINUTE);
    run({ type: 'build', task: 'lighthouse.tower', design: 0, at: T0 }); // telefon saati geri alındı
    expect(save.data.town.construction?.endsAt).toBe(T0 + 61 * MINUTE);
    expect(run({ type: 'finishBuild', at: T0 + 2 * MINUTE })).toEqual({ ok: false, reason: 'not-ready' });
  });
});

describe('komutlar: Pazar, sandık, gemi', () => {
  it('malzeme yıldızla alınır (büyük pakette %20 fazla); yıldız altınla alınır', () => {
    const { save, run } = setup();
    expect(run({ type: 'buyMaterial', material: 'wood', bundle: 0, at: T0 })).toEqual({ ok: false, reason: 'stars' });
    expect(run({ type: 'buyStars', pack: 0, at: T0 })).toEqual({ ok: true, value: 1 });
    expect(save.data).toMatchObject({ stars: 1, coins: ECONOMY.startingCoins - ECONOMY.starPacks[0].coins });
    const wood = save.data.materials.wood;
    expect(run({ type: 'buyMaterial', material: 'wood', bundle: 0, at: T0 })).toEqual({ ok: true, value: 6 });
    expect(save.data.materials.wood).toBe(wood + 6);
    expect(save.data.stars).toBe(0);
    const big = setup((d) => void (d.stars = 5));
    expect(big.run({ type: 'buyMaterial', material: 'glass', bundle: 1, at: T0 })).toEqual({ ok: true, value: 18 });
    expect(run({ type: 'buyStars', pack: 2, at: T0 })).toEqual({ ok: false, reason: 'coins' });
  });

  it('sandık: altın harcanır, ödül kayıttaki tohumla belirlenir ve kayda işlenir; tohum ilerler', () => {
    const a = setup((d) => void (d.coins = 10_000));
    const b = setup((d) => void (d.coins = 10_000));
    const ra = a.run({ type: 'openChest', chest: 'captain', at: T0 });
    const rb = b.run({ type: 'openChest', chest: 'captain', at: T0 });
    expect(ra).toEqual(rb);
    expect(a.save.data).toEqual(b.save.data);
    expect(a.save.data.rng).not.toBe(defaultSave().rng);
    const reward = (ra as { value: RewardBundle }).value;
    expect(a.save.data.coins).toBe(10_000 - ECONOMY.chests.captain.price + (reward.coins ?? 0));
    expect(a.save.data.stars).toBe(reward.stars ?? 0);
    // Sonraki sandık farklı tohumla açılır.
    const again = a.run({ type: 'openChest', chest: 'legend', at: T0 + 1 });
    expect(again.ok).toBe(true);
    expect((again as { value: RewardBundle }).value.stars).toBeGreaterThanOrEqual(ECONOMY.chests.legend.guaranteed.stars);
    expect(setup().run({ type: 'openChest', chest: 'legend', at: T0 })).toEqual({ ok: false, reason: 'coins' });
  });

  it('gemi atölyesi: seviye seviye altınla; en üst seviyede durur', () => {
    const { save, run } = setup((d) => void (d.coins = 100_000));
    for (const [i, level] of ECONOMY.ship.engine.levels.entries()) {
      const coins = save.data.coins;
      expect(run({ type: 'upgradeShip', upgrade: 'engine', at: T0 + i })).toEqual({ ok: true, value: i + 1 });
      expect(save.data.coins).toBe(coins - level.cost);
    }
    expect(run({ type: 'upgradeShip', upgrade: 'engine', at: T0 + 9 })).toEqual({ ok: false, reason: 'max-level' });
    expect(setup().run({ type: 'upgradeShip', upgrade: 'hull', at: T0 })).toEqual({ ok: false, reason: 'coins' });
  });
});

describe('komutlar: günlük ödül, sıfırlama, geliştirici', () => {
  it('günlük ödül oyuncunun saat diliminde hesaplanır', () => {
    // 22:30 UTC: İstanbul'da (UTC+3) ertesi gün 01:30.
    const late = Date.UTC(2026, 9, 7, 22, 30);
    const istanbul = setup();
    expect(istanbul.run({ type: 'claimDaily', tz: -180, at: late }).ok).toBe(true);
    expect(istanbul.save.data.daily.lastClaim).toBe('2026-10-08');
    const london = setup();
    london.run({ type: 'claimDaily', tz: 0, at: late });
    expect(london.save.data.daily.lastClaim).toBe('2026-10-07');
    expect(london.run({ type: 'claimDaily', tz: 0, at: late + MINUTE })).toEqual({ ok: false, reason: 'already-claimed' });
  });

  it('kaydı sıfırlama her oyuncuya açık; sandık tohumu ve saat korunur', () => {
    const { save, run } = setup((d) => void (d.coins = 10_000));
    run({ type: 'openChest', chest: 'captain', at: T0 });
    run({ type: 'startLevel', level: 1, boosters: [], at: T0 + 1 });
    const rng = save.data.rng;
    expect(run({ type: 'resetProgress', at: T0 + 2 }).ok).toBe(true);
    expect(save.data).toEqual({ ...defaultSave(rng), clock: T0 + 2 });
  });

  it('geliştirici komutları kapalıyken reddedilir', () => {
    const { save, run } = setup();
    expect(run({ type: 'devAddStars', amount: 50, at: T0 })).toEqual({ ok: false, reason: 'dev-disabled' });
    expect(save.data.stars).toBe(0);
  });
});

describe('komutlar: istemci-sunucu eşliği ve ağdan gelen veri', () => {
  it('aynı komutlar iki ayrı kayıtta aynı sonucu verir', () => {
    const commands: Command[] = [
      { type: 'claimDaily', tz: -180, at: T0 },
      { type: 'startLevel', level: 1, boosters: [], at: T0 + 1000 },
      { type: 'winLevel', level: 1, coins: 40, at: T0 + 90_000 },
      { type: 'build', task: 'lighthouse.tower', design: 1, at: T0 + 100_000 },
      { type: 'finishBuild', at: T0 + 160_000 },
      { type: 'buyStars', pack: 0, at: T0 + 161_000 },
      { type: 'fillMaterials', task: 'lighthouse.lantern', currency: 'stars', at: T0 + 162_000 },
      { type: 'build', task: 'lighthouse.lantern', design: 0, at: T0 + 163_000 },
      { type: 'speedUpBuild', at: T0 + 164_000 },
      { type: 'openChest', chest: 'captain', at: T0 + 165_000 },
      { type: 'startLevel', level: 2, boosters: [], at: T0 + 170_000 },
      { type: 'loseLevel', level: 2, at: T0 + 200_000 },
      { type: 'refillLives', at: T0 + 210_000 },
    ];
    const client = setup((d) => void (d.coins = 2000));
    const server = setup((d) => void (d.coins = 2000));
    const a = commands.map((c) => client.run(c));
    const b = commands.map((c) => server.run(c));
    expect(a).toEqual(b);
    expect(client.save.data).toEqual(server.save.data);
  });

  it('bozuk ya da bilinmeyen komutlar ayrıştırılmaz', () => {
    expect(parseCommand({ type: 'winLevel', level: 3, coins: 40, at: 5 })).toEqual({ type: 'winLevel', level: 3, coins: 40, at: 5 });
    expect(parseCommand({ type: 'winLevel', level: '3', coins: 40, at: 5 })).toBeNull();
    expect(parseCommand({ type: 'winLevel', level: 3, coins: -1, at: 5 })).toBeNull();
    expect(parseCommand({ type: 'startLevel', level: 1, boosters: ['roket'], at: 5 })).toBeNull();
    expect(parseCommand({ type: 'claimDaily', tz: 5000, at: 5 })).toBeNull();
    expect(parseCommand({ type: 'buyMaterial', material: 'altın', bundle: 0, at: 5 })).toBeNull();
    expect(parseCommand({ type: 'buyMaterial', material: 'wood', bundle: 9, at: 5 })).toBeNull();
    expect(parseCommand({ type: 'buyStars', pack: 1.5, at: 5 })).toBeNull();
    expect(parseCommand({ type: 'openChest', chest: 'bedava', at: 5 })).toBeNull();
    expect(parseCommand({ type: 'fillMaterials', task: 'lighthouse.tower', currency: 'para', at: 5 })).toBeNull();
    expect(parseCommand({ type: 'upgradeShip', upgrade: 'roket', at: 5 })).toBeNull();
    expect(parseCommand({ type: 'buyCoinsPack', coins: 99_999, at: 5 })).toBeNull(); // altın komutla alınamaz
    expect(parseCommand({ type: 'speedUpBuild', at: 5 })).toEqual({ type: 'speedUpBuild', at: 5 });
    expect(parseCommand({ type: 'hack', at: 5 })).toBeNull();
    expect(parseCommand(null)).toBeNull();
    expect(parseCommand({ type: 'refillLives' })).toBeNull();
  });
});
