import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ECONOMY } from '../../src/config/economy';
import { buildApp, type AppOptions } from '../src/app';
import type { PurchaseVerifier } from '../src/purchases';
import { LevelCatalog, readLevelFiles } from '../src/levels';
import { MemoryStore, type LevelRow } from '../src/store';

let levelRows: LevelRow[];
beforeAll(async () => {
  levelRows = await readLevelFiles();
});

const clock = { now: Date.UTC(2026, 9, 8, 9, 0) };
let app: FastifyInstance;
let store: MemoryStore;

async function setup(devCommands = false, extra: Partial<AppOptions> = {}) {
  store = new MemoryStore();
  await store.upsertLevels(levelRows);
  const catalog = new LevelCatalog();
  catalog.load(await store.listLevels(0));
  app = await buildApp({ store, catalog, devCommands, corsOrigins: true, sessionDays: 90, now: () => clock.now, ...extra });
}

afterEach(async () => {
  await app?.close();
});

const post = (url: string, payload: unknown, token?: string) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers: token ? { authorization: `Bearer ${token}` } : {} });
const get = (url: string, token?: string) => app.inject({ method: 'GET', url, headers: token ? { authorization: `Bearer ${token}` } : {} });

async function registerUser(email = 'kaptan@example.com', displayName = 'Pati Reis') {
  const res = await post('/auth/register', { email, password: 'denizfeneri1', displayName });
  expect(res.statusCode).toBe(201);
  return res.json() as { token: string; user: { id: string; email: string; displayName: string } };
}

describe('hesap', () => {
  it('kayıt: hesap ve ilk kayıt oluşur; e-posta küçük harfe çevrilir; aynı e-posta ikinci kez kullanılamaz', async () => {
    await setup();
    const { token, user } = await registerUser('Kaptan@Example.COM ');
    expect(user).toMatchObject({ email: 'kaptan@example.com', displayName: 'Pati Reis' });
    expect(token.length).toBeGreaterThan(30);
    const again = await post('/auth/register', { email: 'kaptan@example.com', password: 'baskasifre1', displayName: 'Başka' });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe('email_taken');
    // Şifre düz metin saklanmaz.
    expect([...store.users.values()][0].passwordHash).toMatch(/^scrypt\$/);
    expect([...store.users.values()][0].passwordHash).not.toContain('denizfeneri1');
  });

  it('kayıt: geçersiz alanlar reddedilir', async () => {
    await setup();
    for (const body of [
      { email: 'kaptan', password: 'denizfeneri1', displayName: 'Pati' },
      { email: 'a@b.co', password: 'kisa', displayName: 'Pati' },
      { email: 'a@b.co', password: 'denizfeneri1', displayName: 'P' },
      { email: 'a@b.co', password: 'denizfeneri1', displayName: '<script>' },
      { email: 'a@b.co' },
    ]) {
      const res = await post('/auth/register', body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(res.json().error).toBe('invalid_input');
    }
  });

  it('giriş: yanlış şifre ve olmayan hesap aynı hatayı verir; doğru şifreyle yeni oturum', async () => {
    await setup();
    await registerUser();
    const wrong = await post('/auth/login', { email: 'kaptan@example.com', password: 'yanlis-sifre' });
    const missing = await post('/auth/login', { email: 'yok@example.com', password: 'denizfeneri1' });
    expect(wrong.statusCode).toBe(401);
    expect(missing.statusCode).toBe(401);
    expect(wrong.json().error).toBe('invalid_credentials');
    expect(missing.json().error).toBe('invalid_credentials');
    const ok = await post('/auth/login', { email: 'KAPTAN@example.com', password: 'denizfeneri1' });
    expect(ok.statusCode).toBe(200);
    const me = await get('/me', ok.json().token);
    expect(me.json().user.displayName).toBe('Pati Reis');
  });

  it('çok fazla yanlış girişte geçici olarak engellenir', async () => {
    await setup();
    await registerUser();
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push((await post('/auth/login', { email: 'kaptan@example.com', password: `yanlis${i}xx` })).statusCode);
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes[10]).toBe(429);
  });

  it('belirteç olmadan, çıkıştan sonra ya da süresi dolunca 401', async () => {
    await setup();
    const { token } = await registerUser();
    expect((await get('/me')).statusCode).toBe(401);
    expect((await get('/me', 'uydurma')).statusCode).toBe(401);
    expect((await get('/me', token)).statusCode).toBe(200);
    clock.now += 91 * 24 * 60 * 60_000;
    expect((await get('/me', token)).statusCode).toBe(401);
    const { token: fresh } = (await post('/auth/login', { email: 'kaptan@example.com', password: 'denizfeneri1' })).json();
    expect((await post('/auth/logout', {}, fresh)).statusCode).toBe(204);
    expect((await get('/me', fresh)).statusCode).toBe(401);
  });
});

describe('eşitleme', () => {
  it('komutlar sunucuda yeniden oynatılır; kayıt ve sürüm güncellenir; komutlar kaydedilir', async () => {
    await setup();
    const { token } = await registerUser();
    const t0 = clock.now;
    const res = await post('/sync', {
      baseRevision: 0,
      commands: [
        { type: 'startLevel', level: 1, boosters: [], at: t0 },
        { type: 'winLevel', level: 1, coins: 40, at: t0 + 90_000 },
        { type: 'build', task: 'lighthouse.tower', design: 2, at: t0 + 95_000 },
        { type: 'finishBuild', at: t0 + 95_000 + 60_000 },
      ],
    }, token);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results).toEqual([{ ok: true }, { ok: true }, { ok: true }, { ok: true }]);
    expect(body.revision).toBe(1);
    expect(body.save).toMatchObject({ level: 2, stars: 1, town: { built: { 'lighthouse.tower': 2 }, construction: null } });
    expect(store.events.map((e) => e.type)).toEqual(['startLevel', 'winLevel', 'build', 'finishBuild']);
    const saved = (await get('/save', token)).json();
    expect(saved).toMatchObject({ revision: 1, save: { level: 2 } });
  });

  it('hile denemeleri reddedilir ve kayda girmez', async () => {
    await setup();
    const { token } = await registerUser();
    const t0 = clock.now;
    const res = await post('/sync', {
      commands: [
        { type: 'winLevel', level: 1, coins: 50, at: t0 }, // deneme açmadan kazanma
        { type: 'startLevel', level: 9, boosters: [], at: t0 }, // açılmamış seviye
        { type: 'startLevel', level: 1, boosters: [], at: t0 + 1000 },
        { type: 'winLevel', level: 1, coins: 999_999, at: t0 + 90_000 }, // altın sınırı
        { type: 'winLevel', level: 1, coins: 30, at: t0 + 2000 }, // çok hızlı
        { type: 'refillLives', at: t0 + 99 * 60 * 60_000 }, // gelecekten
        { type: 'buyCoinsPack', coins: 30_000, at: t0 }, // altın komutla yazılamaz
        { type: 'devAddStars', amount: 50, at: t0 }, // geliştirici komutu
        { type: 'buyPack', item: 'shovel', at: t0 }, // açılmamış eşya
        { type: 'hack', at: t0 },
      ],
    }, token);
    const body = res.json();
    expect(body.results.map((r: { reason?: string }) => r.reason ?? 'ok')).toEqual([
      'no-attempt',
      'level-locked',
      'ok',
      'coins-limit',
      'too-fast',
      'clock',
      'invalid',
      'dev-disabled',
      'item-locked',
      'invalid',
    ]);
    expect(body.save).toMatchObject({ level: 1, stars: 0, coins: 300, attempt: { level: 1 } });
    expect(store.events.filter((e) => !e.accepted)).toHaveLength(9);
  });

  it('geliştirme sunucusunda geliştirici komutları kabul edilir', async () => {
    await setup(true);
    const { token } = await registerUser();
    const body = (await post('/sync', { commands: [{ type: 'devAddStars', amount: 5, at: clock.now }] }, token)).json();
    expect(body.results).toEqual([{ ok: true }]);
    expect(body.save.stars).toBe(5);
  });

  it('iki cihaz: sonra eşitleyen cihazın komutları diğerinin ilerlemesinin üstüne uygulanır', async () => {
    await setup();
    const { token: phone } = await registerUser();
    const { token: tablet } = (await post('/auth/login', { email: 'kaptan@example.com', password: 'denizfeneri1' })).json();
    const t0 = clock.now;
    await post('/sync', { commands: [{ type: 'startLevel', level: 1, boosters: [], at: t0 }, { type: 'winLevel', level: 1, coins: 20, at: t0 + 60_000 }] }, phone);
    // Tablet eski sürümü bildiği halde komutu gönderir: telefonun kazancı korunur, kule yapılır.
    const body = (await post('/sync', { baseRevision: 0, commands: [{ type: 'build', task: 'lighthouse.tower', design: 0, at: t0 + 70_000 }] }, tablet)).json();
    expect(body.results).toEqual([{ ok: true }]);
    expect(body.revision).toBe(2);
    expect(body.save).toMatchObject({ level: 2, stars: 1, town: { construction: { task: 'lighthouse.tower', design: 0 } } });
  });

  it('komutsuz eşitleme yalnızca son kaydı döndürür (sürüm artmaz)', async () => {
    await setup();
    const { token } = await registerUser();
    const body = (await post('/sync', { commands: [] }, token)).json();
    expect(body).toMatchObject({ revision: 0, results: [], save: { level: 1, coins: 300 } });
  });
});

describe('kayıt ve saat', () => {
  it('her hesabın sandık tohumu farklı; eşitleme kaydın saatini sunucu saatine ilerletir', async () => {
    await setup();
    const a = await registerUser('a@example.com', 'Kaptan A');
    const b = await registerUser('b@example.com', 'Kaptan B');
    const rngA = (await get('/save', a.token)).json().save.rng;
    const rngB = (await get('/save', b.token)).json().save.rng;
    expect(rngA).not.toBe(rngB);
    const t0 = clock.now;
    const body = (await post('/sync', { commands: [{ type: 'claimDaily', tz: 0, at: t0 - 60 * 60_000 }] }, a.token)).json();
    expect(body.save.clock).toBe(t0);
    // Telefon saati geri alınsa da inşaat sunucunun bildiği andan önce başlamaz.
    const late = (
      await post('/sync', {
        commands: [
          { type: 'fillMaterials', task: 'lighthouse.tower', currency: 'coins', at: t0 - 2 * 60 * 60_000 },
          { type: 'build', task: 'lighthouse.tower', design: 0, at: t0 - 2 * 60 * 60_000 },
          { type: 'finishBuild', at: t0 - 2 * 60 * 60_000 + 60_000 },
        ],
      }, a.token)
    ).json();
    expect(late.results).toEqual([{ ok: true }, { ok: true }, { ok: false, reason: 'not-ready' }]);
    expect(late.save.town.construction).toMatchObject({ startedAt: t0, endsAt: t0 + 60_000 });
  });
});

describe('satın alma', () => {
  const packId = ECONOMY.shop[0].id;
  const packCoins = ECONOMY.shop[0].coins;

  /** Sahte RevenueCat: yalnızca listedeki işlemleri geçerli sayar. */
  function verifier(valid: Record<string, string>): PurchaseVerifier & { calls: number } {
    const v = {
      calls: 0,
      async verify(_userId: string, productId: string, transactionId: string) {
        v.calls += 1;
        return valid[transactionId] === productId;
      },
    };
    return v;
  }

  it('geliştirmede deneme alımı altını esas kayda işler ve kaydedilir', async () => {
    await setup(true, { sandboxPurchases: true });
    const { token } = await registerUser();
    const res = await post('/purchases', { productId: packId, sandbox: true }, token);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ coins: packCoins, duplicate: false, revision: 1, save: { coins: 300 + packCoins } });
    expect([...store.purchases.values()]).toMatchObject([{ productId: packId, coins: packCoins, sandbox: true }]);
    expect(store.events.map((e) => e.type)).toEqual(['purchase']);
    expect((await get('/save', token)).json().save.coins).toBe(300 + packCoins);
  });

  it('yayında deneme alımı kapalı; doğrulayıcı yoksa gerçek alım da kabul edilmez', async () => {
    await setup(false);
    const { token } = await registerUser();
    expect((await post('/purchases', { productId: packId, sandbox: true }, token)).statusCode).toBe(403);
    expect((await post('/purchases', { productId: packId, transactionId: 'GPA.1' }, token)).statusCode).toBe(503);
    expect((await post('/purchases', { productId: 'com.baska.urun', sandbox: true }, token)).statusCode).toBe(400);
    expect((await post('/purchases', { productId: packId, transactionId: 'GPA.1' })).statusCode).toBe(401);
    expect((await get('/save', token)).json().save.coins).toBe(300);
  });

  it('gerçek alım mağazadan doğrulanır; aynı işlem ikinci kez altın vermez; sahte işlem reddedilir', async () => {
    const store = verifier({ 'GPA.1111': packId, 'GPA.2222': ECONOMY.piggyBank.productId });
    await setup(false, { purchaseVerifier: store });
    const { token } = await registerUser();
    const first = await post('/purchases', { productId: packId, transactionId: 'GPA.1111' }, token);
    expect(first.json()).toMatchObject({ coins: packCoins, duplicate: false });
    const again = await post('/purchases', { productId: packId, transactionId: 'GPA.1111' }, token);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ coins: 0, duplicate: true, save: { coins: 300 + packCoins } });
    // Başka ürünün işlem kimliğiyle ya da uydurma kimlikle altın alınamaz.
    expect((await post('/purchases', { productId: ECONOMY.shop[5].id, transactionId: 'GPA.1111' }, token)).statusCode).toBe(402);
    expect((await post('/purchases', { productId: packId, transactionId: 'GPA.0000' }, token)).statusCode).toBe(402);
    expect((await get('/save', token)).json().save.coins).toBe(300 + packCoins);
    expect(store.calls).toBe(4);
  });

  it('kumbara: içindeki altın verilir ve kumbara boşalır', async () => {
    await setup(true, { purchaseVerifier: verifier({ 'GPA.2222': ECONOMY.piggyBank.productId }) });
    const { token } = await registerUser();
    const t0 = clock.now;
    // İki seviye geç: kumbara dolar.
    await post('/sync', {
      commands: [
        { type: 'startLevel', level: 1, boosters: [], at: t0 },
        { type: 'winLevel', level: 1, coins: 0, at: t0 + 60_000 },
        { type: 'startLevel', level: 2, boosters: [], at: t0 + 70_000 },
        { type: 'winLevel', level: 2, coins: 0, at: t0 + 130_000 },
      ],
    }, token);
    const res = (await post('/purchases', { productId: ECONOMY.piggyBank.productId, transactionId: 'GPA.2222' }, token)).json();
    // Kumbarada 2 × 25 vardı; ödenmiş kumbara en az minBreak verir.
    expect(res.coins).toBe(ECONOMY.piggyBank.minBreak);
    expect(res.save.piggyBank.coins).toBe(0);
  });

  it('doğrulayıcı hata verirse (mağazaya ulaşılamadı) 502: istemci ödemeyi saklayıp sonra yeniden dener', async () => {
    await setup(false, {
      purchaseVerifier: {
        async verify() {
          throw new Error('ağ');
        },
      },
    });
    const { token } = await registerUser();
    expect((await post('/purchases', { productId: packId, transactionId: 'GPA.3' }, token)).statusCode).toBe(502);
    expect(store.purchases.size).toBe(0);
  });
});

describe('seviyeler', () => {
  it('istenen seviyeden sonrakiler döner', async () => {
    await setup();
    const body = (await get('/levels?after=198')).json();
    expect(body.levels.map((l: { id: number }) => l.id)).toEqual([199, 200]);
    expect((await get('/health')).json()).toMatchObject({ ok: true, levels: 200 });
  });
});
