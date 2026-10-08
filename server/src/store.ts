import { randomUUID } from 'node:crypto';
import type { SaveData } from '../../src/services/SaveService';

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
}

export interface SessionRecord {
  readonly userId: string;
  readonly expiresAt: Date;
  readonly lastUsedAt: Date;
}

export interface SaveRecord {
  readonly data: unknown;
  readonly revision: number;
}

export interface EventRecord {
  readonly type: string;
  readonly payload: unknown;
  readonly clientAt: Date;
  readonly accepted: boolean;
  readonly reason?: string;
}

export interface LevelRow {
  readonly id: number;
  readonly data: unknown;
}

export class EmailTakenError extends Error {
  constructor() {
    super('Bu e-postayla zaten bir hesap var');
  }
}

/**
 * Veri deposu arayüzü. Sunucu yalnızca bunu bilir: üretimde PostgreSQL (PrismaStore),
 * testlerde bellek (MemoryStore). Böylece sunucu testleri veritabanı olmadan çalışır.
 */
export interface Store {
  /** Hesabı ilk kaydıyla birlikte oluşturur; e-posta varsa EmailTakenError. */
  createUser(input: { email: string; displayName: string; passwordHash: string }, save: SaveData): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  markLogin(userId: string, at: Date): Promise<void>;

  createSession(input: { userId: string; tokenHash: string; expiresAt: Date; userAgent?: string }): Promise<void>;
  findSession(tokenHash: string): Promise<SessionRecord | null>;
  touchSession(tokenHash: string, lastUsedAt: Date, expiresAt: Date): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;

  getSave(userId: string): Promise<SaveRecord | null>;
  /** İyimser kilit: kayıt hâlâ expectedRevision'daysa yazar ve revision'ı artırır; değilse false. */
  writeSave(userId: string, expectedRevision: number, data: SaveData): Promise<boolean>;
  logEvents(userId: string, events: readonly EventRecord[]): Promise<void>;

  listLevels(afterId: number): Promise<LevelRow[]>;
  upsertLevels(levels: readonly LevelRow[]): Promise<void>;

  close(): Promise<void>;
}

/** Bellek içi depo (testler ve veritabanısız deneme için). */
export class MemoryStore implements Store {
  readonly users = new Map<string, UserRecord>();
  readonly sessions = new Map<string, SessionRecord>();
  readonly saves = new Map<string, { data: unknown; revision: number }>();
  readonly events: (EventRecord & { userId: string })[] = [];
  readonly levels = new Map<number, unknown>();

  async createUser(input: { email: string; displayName: string; passwordHash: string }, save: SaveData): Promise<UserRecord> {
    if ([...this.users.values()].some((u) => u.email === input.email)) throw new EmailTakenError();
    const user: UserRecord = { id: randomUUID(), createdAt: new Date(), ...input };
    this.users.set(user.id, user);
    this.saves.set(user.id, { data: structuredClone(save), revision: 0 });
    return user;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async markLogin(): Promise<void> {}

  async createSession(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    this.sessions.set(input.tokenHash, { userId: input.userId, expiresAt: input.expiresAt, lastUsedAt: new Date() });
  }

  async findSession(tokenHash: string): Promise<SessionRecord | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async touchSession(tokenHash: string, lastUsedAt: Date, expiresAt: Date): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session) this.sessions.set(tokenHash, { ...session, lastUsedAt, expiresAt });
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async getSave(userId: string): Promise<SaveRecord | null> {
    const save = this.saves.get(userId);
    return save ? { data: structuredClone(save.data), revision: save.revision } : null;
  }

  async writeSave(userId: string, expectedRevision: number, data: SaveData): Promise<boolean> {
    const save = this.saves.get(userId);
    if (!save || save.revision !== expectedRevision) return false;
    this.saves.set(userId, { data: structuredClone(data), revision: expectedRevision + 1 });
    return true;
  }

  async logEvents(userId: string, events: readonly EventRecord[]): Promise<void> {
    this.events.push(...events.map((e) => ({ ...e, userId })));
  }

  async listLevels(afterId: number): Promise<LevelRow[]> {
    return [...this.levels.entries()]
      .filter(([id]) => id > afterId)
      .sort(([a], [b]) => a - b)
      .map(([id, data]) => ({ id, data }));
  }

  async upsertLevels(levels: readonly LevelRow[]): Promise<void> {
    for (const level of levels) this.levels.set(level.id, level.data);
  }

  async close(): Promise<void> {}
}
