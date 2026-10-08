import { getLevel, levelCount } from '../data/levels';
import { saveService } from '../services/SaveService';
import { DEFAULT_MIN_LEVEL_MS, type CommandRules } from './commands';
import { createGame } from './game';

/** İstemcinin oyun servisleri (giriş yapan hesabın kaydı üzerinde). Değişiklikler komutlarla yapılır. */
export const game = createGame(saveService, levelCount);
export const lives = game.lives;
export const levelProgress = game.levels;
export const townProgress = game.town;
export const inventory = game.inventory;
export const dailyReward = game.daily;
export const market = game.market;

/** İstemcideki komut kuralları (sunucunun kurallarıyla aynı; seviye bilgisi pakete gömülü seviyelerden). */
export const clientRules: CommandRules = {
  level(id) {
    if (id < 1 || id > levelCount()) return null;
    const level = getLevel(id);
    return { moves: level.moves, chests: level.obstacles.filter((o) => o.kind === 'chest').length };
  },
  allowDev: import.meta.env.DEV,
  minLevelMs: DEFAULT_MIN_LEVEL_MS,
};
