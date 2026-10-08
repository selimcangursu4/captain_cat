/// <reference types="node" />
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { isValidEmail, isValidName, isValidPassword, normalizeEmail, normalizeName } from '../../src/meta/accountRules';
import { applyCommand, parseCommand } from '../../src/meta/commands';
import { createGame } from '../../src/meta/game';
import { MemorySaveStorage, SaveService, defaultSave } from '../../src/services/SaveService';
import type { LevelCatalog } from './levels';
import { RateLimiter, dummyPasswordHash, hashPassword, hashToken, newToken, verifyPassword } from './security';
import { EmailTakenError, type EventRecord, type Store, type UserRecord } from './store';

export interface AppOptions {
  readonly store: Store;
  readonly catalog: LevelCatalog;
  readonly devCommands: boolean;
  readonly corsOrigins: string[] | true;
  readonly sessionDays: number;
  /** Kayıt (IP başına saatte) ve giriş (IP+e-posta başına 10 dakikada) deneme sınırları. */
  readonly registerPerHour?: number;
  readonly loginPer10Min?: number;
  readonly now?: () => number;
  readonly logger?: boolean;
}

/** İsteği belirli bir HTTP durumu ve hata koduyla bitirir (istemci src/net/api.ts ApiError). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Komut zamanı sunucu saatinden bu kadar ileride olamaz (telefon saati ileri alınarak can üretilmesin). */
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
/** Tek eşitlemede en fazla komut. */
const MAX_COMMANDS = 500;
/** Oturumun "son kullanım" kaydı en sık bu aralıkla güncellenir. */
const TOUCH_INTERVAL_MS = 60 * 60_000;

const publicUser = (u: UserRecord) => ({ id: u.id, email: u.email, displayName: u.displayName });

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { store, catalog } = options;
  const now = options.now ?? Date.now;
  const sessionMs = options.sessionDays * 24 * 60 * 60_000;
  const loginLimiter = new RateLimiter(options.loginPer10Min ?? 10, 10 * 60_000);
  const registerLimiter = new RateLimiter(options.registerPerHour ?? 5, 60 * 60_000);

  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 1024 * 1024 });
  await app.register(cors, { origin: options.corsOrigins, methods: ['GET', 'POST'] });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) return reply.code(error.status).send({ error: error.code, message: error.message });
    if ((error as { validation?: unknown }).validation) {
      return reply.code(400).send({ error: 'invalid_input', message: (error as Error).message });
    }
    app.log.error(error);
    return reply.code(500).send({ error: 'server_error', message: 'Sunucu hatası' });
  });

  /** Authorization: Bearer <belirteç> → hesap kimliği; geçersizse 401. */
  async function requireUser(request: FastifyRequest): Promise<{ userId: string; tokenHash: string }> {
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new HttpError(401, 'unauthorized', 'Giriş gerekli');
    const tokenHash = hashToken(token);
    const session = await store.findSession(tokenHash);
    const time = now();
    if (!session || session.expiresAt.getTime() <= time) throw new HttpError(401, 'unauthorized', 'Oturum geçersiz');
    // Kayan süre: kullanılan oturum uzar.
    if (time - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await store.touchSession(tokenHash, new Date(time), new Date(time + sessionMs));
    }
    return { userId: session.userId, tokenHash };
  }

  async function openSession(user: UserRecord, request: FastifyRequest): Promise<string> {
    const token = newToken();
    await store.createSession({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(now() + sessionMs),
      userAgent: request.headers['user-agent'],
    });
    return token;
  }

  const credentialsSchema = {
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', maxLength: 254 },
        password: { type: 'string', maxLength: 128 },
        displayName: { type: 'string', maxLength: 64 },
      },
    },
  } as const;

  app.get('/health', async () => ({ ok: true, levels: catalog.count, time: new Date(now()).toISOString() }));

  app.post<{ Body: { email: string; password: string; displayName?: string } }>(
    '/auth/register',
    { schema: credentialsSchema },
    async (request, reply) => {
      if (!registerLimiter.hit(request.ip, now())) throw new HttpError(429, 'too_many_requests', 'Çok fazla kayıt denemesi');
      const email = normalizeEmail(request.body.email);
      const displayName = normalizeName(request.body.displayName ?? '');
      const { password } = request.body;
      if (!isValidEmail(email)) throw new HttpError(400, 'invalid_input', 'Geçersiz e-posta');
      if (!isValidPassword(password)) throw new HttpError(400, 'invalid_input', 'Şifre en az 8 karakter olmalı');
      if (!isValidName(displayName)) throw new HttpError(400, 'invalid_input', 'Kaptan adı 3-16 karakter olmalı');
      let user: UserRecord;
      try {
        user = await store.createUser({ email, displayName, passwordHash: await hashPassword(password) }, defaultSave());
      } catch (error) {
        if (error instanceof EmailTakenError) throw new HttpError(409, 'email_taken', error.message);
        throw error;
      }
      const token = await openSession(user, request);
      return reply.code(201).send({ token, user: publicUser(user) });
    },
  );

  app.post<{ Body: { email: string; password: string } }>('/auth/login', { schema: credentialsSchema }, async (request) => {
    const email = normalizeEmail(request.body.email);
    if (!loginLimiter.hit(`${request.ip}:${email}`, now())) throw new HttpError(429, 'too_many_requests', 'Çok fazla giriş denemesi');
    const user = await store.findUserByEmail(email);
    // Hesap yoksa da şifre özeti hesaplanır: yanıt süresi e-postanın kayıtlı olup olmadığını ele vermesin.
    const valid = await verifyPassword(request.body.password, user?.passwordHash ?? (await dummyPasswordHash()));
    if (!user || !valid) throw new HttpError(401, 'invalid_credentials', 'E-posta ya da şifre yanlış');
    await store.markLogin(user.id, new Date(now()));
    return { token: await openSession(user, request), user: publicUser(user) };
  });

  app.post('/auth/logout', async (request, reply) => {
    const { tokenHash } = await requireUser(request);
    await store.deleteSession(tokenHash);
    return reply.code(204).send();
  });

  app.get('/me', async (request) => {
    const { userId } = await requireUser(request);
    const user = await store.findUserById(userId);
    if (!user) throw new HttpError(401, 'unauthorized', 'Hesap bulunamadı');
    return { user: publicUser(user) };
  });

  app.get('/save', async (request) => {
    const { userId } = await requireUser(request);
    const record = await store.getSave(userId);
    return { revision: record?.revision ?? 0, save: new SaveService(new MemorySaveStorage(JSON.stringify(record?.data ?? null))).data };
  });

  /**
   * Eşitleme: istemcinin günlüğündeki komutlar, hesabın esas kaydında aynı kurallarla
   * (src/meta/commands.ts) yeniden oynatılır. Kurala uymayan komut reddedilir ve kayda girmez.
   * Yanıt: esas kayıt + her komutun sonucu. İki istek aynı anda yazmaya kalkarsa (iki cihaz)
   * iyimser kilit yeniden dener.
   */
  app.post<{ Body: { baseRevision?: number; commands: unknown[] } }>(
    '/sync',
    {
      schema: {
        body: {
          type: 'object',
          required: ['commands'],
          properties: {
            baseRevision: { type: 'integer', minimum: 0 },
            commands: { type: 'array', maxItems: MAX_COMMANDS, items: { type: 'object' } },
          },
        },
      },
    },
    async (request) => {
      const { userId } = await requireUser(request);
      const rules = catalog.rules(options.devCommands);
      for (let attempt = 0; attempt < 5; attempt++) {
        const record = (await store.getSave(userId)) ?? { data: null, revision: 0 };
        const save = new SaveService(new MemorySaveStorage(JSON.stringify(record.data)));
        const game = createGame(save, () => catalog.count);
        const time = now();
        const results: { ok: boolean; reason?: string }[] = [];
        const events: EventRecord[] = [];
        for (const raw of request.body.commands) {
          const command = parseCommand(raw);
          const result = !command
            ? { ok: false as const, reason: 'invalid' }
            : command.at > time + MAX_CLOCK_SKEW_MS
              ? { ok: false as const, reason: 'clock' }
              : applyCommand(game, command, rules);
          results.push(result.ok ? { ok: true } : { ok: false, reason: result.reason });
          events.push({
            type: command?.type ?? 'invalid',
            payload: raw,
            clientAt: new Date(command?.at ?? time),
            accepted: result.ok,
            reason: result.ok ? undefined : result.reason,
          });
        }
        const changed = results.some((r) => r.ok);
        if (changed && !(await store.writeSave(userId, record.revision, save.data))) continue; // başka istek yazdı: yeniden dene
        await store.logEvents(userId, events);
        return { revision: changed ? record.revision + 1 : record.revision, save: save.data, results };
      }
      throw new HttpError(409, 'conflict', 'Kayıt aynı anda değişti, tekrar deneyin');
    },
  );

  /** Pakette olmayan yeni seviyeler (istemci önbelleğe alır, internetsiz de oynanır). */
  app.get<{ Querystring: { after?: string } }>('/levels', async (request) => {
    const after = Math.max(0, Number.parseInt(request.query.after ?? '0', 10) || 0);
    const rows = await store.listLevels(after);
    return { levels: rows.slice(0, 200).map((r) => r.data) };
  });

  return app;
}
