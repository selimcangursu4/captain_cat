import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/economy';
import { applyCommand, maxWinCoins, parseCommand, type Command, type CommandRules } from '../../src/meta/commands';
import { createGame } from '../../src/meta/game';
import { MemorySaveStorage, SaveService, type SaveData } from '../../src/services/SaveService';

const T0 = Date.UTC(2026, 9, 7, 10, 0);
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

describe('komutlar: seviye denemesi', () => {
  it('başlarken can düşer ve deneme açılır; kazanınca can geri gelir, ödül verilir, deneme kapanır', () => {
    const { save, run } = setup();
    expect(run({ type: 'startLevel', level: 1, boosters: [], at: T0 }).ok).toBe(true);
    expect(save.data.lives.count).toBe(4);
    expect(save.data.attempt).toEqual({ level: 1, startedAt: T0, extraMoves: 0 });
    const win = run({ type: 'winLevel', level: 1, coins: 50, at: T0 + 60_000 });
    expect(win).toMatchObject({ ok: true, value: { stars: 1, nextLevel: 2 } });
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
    expect(run({ type: 'winLevel', level: 1, coins: cap + 1, at: T0 + 60_000 })).toEqual({ ok: false, reason: 'coins-limit' });
    expect(run({ type: 'winLevel', level: 2, coins: 10, at: T0 + 60_000 })).toEqual({ ok: false, reason: 'no-attempt' });
    expect(run({ type: 'winLevel', level: 1, coins: cap, at: T0 + 60_000 }).ok).toBe(true);
  });

  it('açılmamış seviye başlatılamaz; can yoksa başlatılamaz', () => {
    const { save, run } = setup((d) => {
      d.lives = { count: 0, nextAt: T0 + 60_000 };
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

  it('kaybedince deneme kapanır, can geri gelmez; ek hamle altın sınırını artırır', () => {
    const { save, run } = setup();
    run({ type: 'startLevel', level: 1, boosters: [], at: T0 });
    expect(run({ type: 'buyExtraMoves', at: T0 + 1000 }).ok).toBe(true);
    expect(save.data.attempt?.extraMoves).toBe(ECONOMY.extraMoves.count);
    expect(save.data.coins).toBe(ECONOMY.startingCoins - ECONOMY.extraMoves.cost);
    expect(run({ type: 'loseLevel', level: 1, at: T0 + 2000 }).ok).toBe(true);
    expect(save.data).toMatchObject({ attempt: null, stats: { levelsLost: 1 } });
    expect(save.data.lives.count).toBe(4);
    expect(run({ type: 'buyExtraMoves', at: T0 + 3000 })).toEqual({ ok: false, reason: 'no-attempt' });
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

describe('komutlar: kasaba, günlük ödül, geliştirici', () => {
  it('günlük ödül oyuncunun saat diliminde hesaplanır', () => {
    // 22:30 UTC: İstanbul'da (UTC+3) ertesi gün 01:30.
    const late = Date.UTC(2026, 9, 7, 22, 30);
    const istanbul = setup();
    expect(istanbul.run({ type: 'claimDaily', tz: -180, at: late }).ok).toBe(true);
    expect(istanbul.save.data.daily.lastClaim).toBe('2026-10-08');
    const london = setup();
    london.run({ type: 'claimDaily', tz: 0, at: late });
    expect(london.save.data.daily.lastClaim).toBe('2026-10-07');
    expect(london.run({ type: 'claimDaily', tz: 0, at: late + 60_000 })).toEqual({ ok: false, reason: 'already-claimed' });
  });

  it('inşa ve tasarım değişikliği kurallara uyar', () => {
    const { save, run } = setup((d) => {
      d.stars = 1;
    });
    expect(run({ type: 'build', task: 'lighthouse.lantern', design: 0, at: T0 })).toEqual({ ok: false, reason: 'locked' });
    expect(run({ type: 'build', task: 'lighthouse.tower', design: 2, at: T0 }).ok).toBe(true);
    expect(save.data.town.built).toEqual({ 'lighthouse.tower': 2 });
    expect(run({ type: 'changeDesign', task: 'lighthouse.tower', design: 1, at: T0 }).ok).toBe(true);
    expect(run({ type: 'changeDesign', task: 'lighthouse.door', design: 1, at: T0 })).toEqual({ ok: false, reason: 'not-built' });
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
      { type: 'startLevel', level: 2, boosters: [], at: T0 + 110_000 },
      { type: 'loseLevel', level: 2, at: T0 + 200_000 },
      { type: 'refillLives', at: T0 + 210_000 },
    ];
    const client = setup();
    const server = setup();
    const a = commands.map((c) => client.run(c).ok);
    const b = commands.map((c) => server.run(c).ok);
    expect(a).toEqual(b);
    expect(client.save.data).toEqual(server.save.data);
  });

  it('bozuk ya da bilinmeyen komutlar ayrıştırılmaz', () => {
    expect(parseCommand({ type: 'winLevel', level: 3, coins: 40, at: 5 })).toEqual({ type: 'winLevel', level: 3, coins: 40, at: 5 });
    expect(parseCommand({ type: 'winLevel', level: '3', coins: 40, at: 5 })).toBeNull();
    expect(parseCommand({ type: 'winLevel', level: 3, coins: -1, at: 5 })).toBeNull();
    expect(parseCommand({ type: 'startLevel', level: 1, boosters: ['roket'], at: 5 })).toBeNull();
    expect(parseCommand({ type: 'claimDaily', tz: 5000, at: 5 })).toBeNull();
    expect(parseCommand({ type: 'hack', at: 5 })).toBeNull();
    expect(parseCommand(null)).toBeNull();
    expect(parseCommand({ type: 'refillLives' })).toBeNull();
  });
});
