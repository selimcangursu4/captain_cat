import { PrismaPg } from '@prisma/adapter-pg';
import type { SaveData } from '../../src/services/SaveService';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import {
  EmailTakenError,
  type EventRecord,
  type LevelRow,
  type PurchaseOutcome,
  type PurchaseRecord,
  type SaveRecord,
  type SessionRecord,
  type Store,
  type UserRecord,
} from './store';

const json = (value: unknown) => value as Prisma.InputJsonValue;

/** İşlem içinde kayıt başka bir istekçe değiştirildi: işlem geri alınır. */
class RevisionConflict extends Error {}

/** PostgreSQL deposu (Prisma 7 + pg sürücü adaptörü). */
export class PrismaStore implements Store {
  private constructor(private readonly db: PrismaClient) {}

  static async connect(databaseUrl: string): Promise<PrismaStore> {
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    await db.$connect();
    return new PrismaStore(db);
  }

  async createUser(input: { email: string; displayName: string; passwordHash: string }, save: SaveData): Promise<UserRecord> {
    try {
      return await this.db.user.create({
        data: {
          ...input,
          save: { create: { data: json(save), revision: 0, level: save.level, stars: save.stars, coins: save.coins } },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new EmailTakenError();
      throw error;
    }
  }

  findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  findUserById(id: string): Promise<UserRecord | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async markLogin(userId: string, at: Date): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
  }

  async createSession(input: { userId: string; tokenHash: string; expiresAt: Date; userAgent?: string }): Promise<void> {
    await this.db.session.create({ data: { ...input, userAgent: input.userAgent?.slice(0, 255) } });
  }

  findSession(tokenHash: string): Promise<SessionRecord | null> {
    return this.db.session.findUnique({ where: { tokenHash }, select: { userId: true, expiresAt: true, lastUsedAt: true } });
  }

  async touchSession(tokenHash: string, lastUsedAt: Date, expiresAt: Date): Promise<void> {
    await this.db.session.updateMany({ where: { tokenHash }, data: { lastUsedAt, expiresAt } });
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.session.deleteMany({ where: { tokenHash } });
  }

  getSave(userId: string): Promise<SaveRecord | null> {
    return this.db.gameSave.findUnique({ where: { userId }, select: { data: true, revision: true } });
  }

  async writeSave(userId: string, expectedRevision: number, data: SaveData): Promise<boolean> {
    const result = await this.db.gameSave.updateMany({
      where: { userId, revision: expectedRevision },
      data: { data: json(data), revision: expectedRevision + 1, level: data.level, stars: data.stars, coins: data.coins },
    });
    return result.count === 1;
  }

  async logEvents(userId: string, events: readonly EventRecord[]): Promise<void> {
    if (events.length === 0) return;
    await this.db.gameEvent.createMany({
      data: events.map((e) => ({ userId, type: e.type, payload: json(e.payload), clientAt: e.clientAt, accepted: e.accepted, reason: e.reason })),
    });
  }

  async recordPurchase(userId: string, purchase: PurchaseRecord, expectedRevision: number, data: SaveData): Promise<PurchaseOutcome> {
    try {
      await this.db.$transaction(async (tx) => {
        await tx.purchase.create({ data: { userId, ...purchase } });
        const result = await tx.gameSave.updateMany({
          where: { userId, revision: expectedRevision },
          data: { data: json(data), revision: expectedRevision + 1, level: data.level, stars: data.stars, coins: data.coins },
        });
        if (result.count !== 1) throw new RevisionConflict();
      });
      return 'ok';
    } catch (error) {
      if (error instanceof RevisionConflict) return 'conflict';
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return 'duplicate';
      throw error;
    }
  }

  listLevels(afterId: number): Promise<LevelRow[]> {
    return this.db.level.findMany({ where: { id: { gt: afterId }, published: true }, orderBy: { id: 'asc' }, select: { id: true, data: true } });
  }

  async upsertLevels(levels: readonly LevelRow[]): Promise<void> {
    await this.db.$transaction(
      levels.map((level) =>
        this.db.level.upsert({ where: { id: level.id }, create: { id: level.id, data: json(level.data) }, update: { data: json(level.data) } }),
      ),
    );
  }

  async close(): Promise<void> {
    await this.db.$disconnect();
  }
}
