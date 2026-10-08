import { describe, expect, it } from 'vitest';
import { LevelError, parseLevel } from '../../src/core/level/parseLevel';
import { createLevelBoard, LevelSession } from '../../src/core/level/LevelSession';
import { GoalTracker, goalTargetPicker } from '../../src/core/level/goals';
import { hasAnyMatch } from '../../src/core/matchFinder';
import { hasPossibleMove } from '../../src/core/possibleMoves';
import { Random } from '../../src/core/Random';
import { resolveTutorialStep, tutorialAllows } from '../../src/core/level/tutorial';
import { LEVELS } from '../../src/data/levels';
import { en } from '../../src/i18n/en';
import { tr } from '../../src/i18n/tr';
import { allTileIds, boardFrom, boardToLines, isSettled } from '../helpers/boardBuilder';

const C5 = ['fish', 'anchor', 'shell', 'ring', 'star'];

function level(overrides: Record<string, unknown> = {}) {
  return { id: 7, moves: 20, colors: C5, goals: [{ type: 'color', color: 'fish', count: 10 }], ...overrides };
}

/** 4x4, tamamen sabit taşlı bölüm: (1,1)↔(0,1) kaydırması satır 0'da F F F yapar. */
function fixedLevel(goalCount: number, moves: number) {
  return parseLevel(
    level({
      moves,
      board: ['xxxx', 'xxxx', 'xxxx', 'xxxx'],
      tiles: ['FAFR', 'SFRT', 'ATSA', 'RSAT'],
      goals: [{ type: 'color', color: 'fish', count: goalCount }],
      seed: 5,
    }),
  );
}

describe('parseLevel', () => {
  it('engel katmanlarını ve "hepsi" hedeflerini okur', () => {
    const def = parseLevel(
      level({
        floor: ['..2.....', ...Array(7).fill('........')],
        cover: ['n.......', ...Array(7).fill('........')],
        block: ['.1.....c', '.......b', ...Array(6).fill('........')],
        goals: [{ type: 'obstacle', kind: 'moss' }, { type: 'seagull' }, { type: 'obstacle', kind: 'chest' }],
      }),
    );
    expect(def.shape.rows).toBe(8);
    expect(def.obstacles.map((o) => `${o.kind}:${o.layers}@${o.pos.row},${o.pos.col}`).sort()).toEqual(
      ['chest:3@0,7', 'moss:2@0,2', 'nest:4@1,7', 'net:1@0,0', 'sandbag:1@0,1'].sort(),
    );
    expect(def.goals).toEqual([
      { type: 'obstacle', kind: 'moss', count: 1 },
      { type: 'seagull', count: 4 },
      { type: 'obstacle', kind: 'chest', count: 1 },
    ]);
  });

  const invalid: [string, Record<string, unknown>, RegExp][] = [
    ['bilinmeyen renk', { colors: ['fish', 'anchor', 'mor'] }, /bilinmeyen renk/],
    ['az renk', { colors: ['fish', 'anchor'] }, /en az 3 renk/],
    ['hamle yok', { moves: 0 }, /moves/],
    ['ızgara boyutu', { floor: ['..'] }, /8 satır x 8 sütun/],
    ['bilinmeyen kod', { block: ['z.......', ...Array(7).fill('........')] }, /bilinmeyen kod 'z'/],
    ['boşluğa engel', { board: ['x.', 'xx', 'xx'], block: ['.1', '..', '..'], goals: [{ type: 'color', color: 'fish', count: 1 }] }, /boşluğa engel/],
    ['blok + ağ', { block: ['1.......', ...Array(7).fill('........')], cover: ['n.......', ...Array(7).fill('........')] }, /aynı karede/],
    ['olmayan engel hedefi', { goals: [{ type: 'obstacle', kind: 'moss' }] }, /hiç "moss" yok/],
    ['yuvasız martı hedefi', { goals: [{ type: 'seagull', count: 3 }] }, /martı yuvası/],
    ['renkte olmayan hedef', { colors: ['anchor', 'shell', 'ring'], goals: [{ type: 'color', color: 'fish', count: 5 }] }, /renklerinde yok/],
    ['hedefsiz', { goals: [] }, /en az bir hedef/],
    ['güçlendirici taşsız', { specials: [{ at: [0, 0], kind: 'cannon' }] }, /önce "tiles"/],
  ];
  for (const [name, overrides, message] of invalid) {
    it(`hatalı bölümü reddeder: ${name}`, () => {
      expect(() => parseLevel(level(overrides))).toThrow(LevelError);
      expect(() => parseLevel(level(overrides))).toThrow(message);
    });
  }
});

describe('createLevelBoard', () => {
  it('engelleri ve sabit taşları yerleştirir, gerisini eşleşmesiz doldurur', () => {
    const def = parseLevel(
      level({
        block: ['........', '...1....', ...Array(6).fill('........')],
        cover: ['........', '........', '..n.....', ...Array(5).fill('........')],
        tiles: ['F.......', ...Array(7).fill('........')],
        specials: [{ at: [0, 0], kind: 'harpoon-h' }],
      }),
    );
    const board = createLevelBoard(def, new Random(1));
    expect(board.isBlocked({ row: 1, col: 3 })).toBe(true);
    expect(board.getTile({ row: 1, col: 3 })).toBeNull();
    expect(board.isCovered({ row: 2, col: 2 })).toBe(true);
    expect(board.getTile({ row: 0, col: 0 })).toMatchObject({ color: 'fish', special: 'harpoon-h' });
    expect(board.isFull()).toBe(true);
    expect(hasAnyMatch(board)).toBe(false);
  });

  it('sabit taşlarda hazır eşleşme varsa açık bir hata verir', () => {
    const def = parseLevel(level({ tiles: ['FFF.....', ...Array(7).fill('........')] }));
    expect(() => createLevelBoard(def, new Random(1))).toThrow(/hazır bir eşleşme/);
  });
});

describe('LevelSession', () => {
  it('geçerli hamle bir hamle harcar; eşleşmesiz kaydırma harcamaz', () => {
    const session = new LevelSession(fixedLevel(30, 5));
    expect(boardToLines(session.engine.board)).toEqual(['FAFR', 'SFRT', 'ATSA', 'RSAT']);
    expect(session.trySwap({ row: 2, col: 0 }, { row: 2, col: 1 }).move.kind).toBe('rejected');
    expect(session.movesLeft).toBe(5);
    const turn = session.trySwap({ row: 1, col: 1 }, { row: 0, col: 1 });
    expect(turn.move.kind).toBe('resolved');
    expect(turn.movesLeft).toBe(4);
    expect(turn.goalDeltas[0][0]).toMatchObject({ goalIndex: 0, amount: 1 });
  });

  it('hedefler tamamlanınca kazanılır; kalan hamleler kutlamada güçlendiriciye dönüşür', () => {
    const session = new LevelSession(fixedLevel(3, 3));
    const turn = session.trySwap({ row: 1, col: 1 }, { row: 0, col: 1 });
    expect(turn.status).toBe('won');
    expect(session.goals.complete).toBe(true);
    expect(() => session.trySwap({ row: 0, col: 0 }, { row: 0, col: 1 })).toThrow();

    const first = session.celebrationTurn();
    expect(first).not.toBeNull();
    expect(first!.converted).toHaveLength(1);
    expect(['harpoon-h', 'harpoon-v', 'cannon']).toContain(first!.converted[0].special);
    expect(first!.move.kind).toBe('resolved');
    expect(session.celebrationTurn()).not.toBeNull();
    expect(session.movesLeft).toBe(0);
    expect(session.celebrationTurn()).toBeNull();
  });

  it('kutlamada birden çok hamle aynı anda patlayabilir', () => {
    const session = new LevelSession(fixedLevel(3, 6));
    session.trySwap({ row: 1, col: 1 }, { row: 0, col: 1 });
    const burst = session.celebrationTurn(3);
    expect(burst!.converted).toHaveLength(3);
    expect(new Set(burst!.converted.map((c) => c.tileId)).size).toBe(3);
    if (burst!.move.kind !== 'resolved') throw new Error('çözülmedi');
    expect(burst!.move.steps[0].activations.filter((a) => a.wave === 1).length).toBeGreaterThanOrEqual(1);
    expect(session.movesLeft).toBe(2);
    expect(session.celebrationTurn(10)!.converted.length).toBeLessThanOrEqual(2);
    expect(session.movesLeft).toBe(0);
  });

  it('hamleler bitince kaybedilir; +5 hamle ile devam edilir', () => {
    const session = new LevelSession(fixedLevel(30, 1));
    const turn = session.trySwap({ row: 1, col: 1 }, { row: 0, col: 1 });
    expect(turn.status).toBe('lost');
    session.addMoves(5);
    expect(session.status).toBe('playing');
    expect(session.movesLeft).toBe(5);
    expect(session.extraMovesAdded).toBe(5);
  });

  it('hedef sayacı fazlasını saymaz (kalan 0\'ın altına inmez)', () => {
    const tracker = new GoalTracker([{ type: 'color', color: 'fish', count: 2 }]);
    const step = {
      index: 0, groups: [], created: [], activations: [], obstacleHits: [], falls: [], spawns: [], settleTicks: 0,
      cleared: [0, 1, 2].map((col) => ({ tileId: col, color: 'fish' as const, pos: { row: 0, col }, wave: 0 })),
    };
    expect(tracker.applyStep(step).reduce((s, d) => s + d.amount, 0)).toBe(2);
    expect(tracker.states[0].remaining).toBe(0);
  });

  it('Martı hedef seçici önce hedef engelleri seçer', () => {
    const board = boardFrom(['FAS', 'RTF', 'ASR']);
    board.placeObstacle({ row: 2, col: 2 }, 'moss', 1);
    const picker = goalTargetPicker(new GoalTracker([{ type: 'obstacle', kind: 'moss', count: 1 }]));
    const target = picker(board, board.playablePositions(), new Random(1));
    expect(target).toEqual({ row: 2, col: 2 });
  });
});

describe('bölüm dosyaları', () => {
  it('tüm bölümler geçerli ve oynanabilir bir tahtayla başlar', () => {
    expect(LEVELS.length).toBeGreaterThan(0);
    for (const def of LEVELS) {
      for (let seed = 1; seed <= 5; seed++) {
        const session = new LevelSession(def, seed);
        const board = session.engine.board;
        expect(hasAnyMatch(board), `bölüm ${def.id}`).toBe(false);
        expect(hasPossibleMove(board), `bölüm ${def.id}`).toBe(true);
      }
    }
  });
});

describe('öğretici bölümler', () => {
  const tutorials = LEVELS.filter((l) => l.tutorial.length > 0);

  it('ilk 10 bölümün hepsi öğreticidir ve sabit tohumla gelir', () => {
    expect(tutorials.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(tutorials.every((l) => l.seed !== undefined)).toBe(true);
  });

  it('öğretici metinleri iki dilde de tanımlı', () => {
    for (const level of tutorials) {
      for (const step of level.tutorial) {
        expect(tr, `bölüm ${level.id}`).toHaveProperty([step.text]);
        expect(en, `bölüm ${level.id}`).toHaveProperty([step.text]);
      }
    }
  });

  for (const level of tutorials) {
    it(`bölüm ${level.id}: öğretici adımları baştan sona oynanır`, () => {
      const session = new LevelSession(level, level.seed);
      for (const step of level.tutorial) {
        const resolved = resolveTutorialStep(step, session.engine.board);
        expect(resolved, `adım "${step.text}" tahtada bulunamadı`).not.toBeNull();
        if (!resolved || resolved.kind === 'message') continue;
        // Öğretici yalnızca gösterilen hamleye izin verir.
        expect(tutorialAllows(resolved, { row: -1, col: -1 }, { row: -1, col: -2 })).toBe(false);
        const turn = resolved.kind === 'swap' ? session.trySwap(resolved.a, resolved.b) : session.activateAt(resolved.at);
        expect(turn.move.kind).toBe('resolved');
        expect(session.status).toBe('playing');
        if ('swap' in step && turn.move.kind === 'resolved') {
          const created = turn.move.steps[0].created.map((c) => c.tile.special);
          expect(created).toEqual(step.expect?.creates ? [step.expect.creates] : []);
        }
      }
    });
  }
});

describe('LevelSession rastgele oyun (engelli bölümler)', () => {
  for (const def of LEVELS) {
    it(`bölüm ${def.id}: 120 hamle boyunca tutarlı kalır`, () => {
      const session = new LevelSession(def, 77);
      const board = session.engine.board;
      const picker = new Random(def.id);
      let ids = new Set(allTileIds(board));

      for (let turn = 0; turn < 120; turn++) {
        if (session.status === 'won') break;
        if (session.status === 'lost') session.addMoves(5);
        const hint = session.engine.findHint();
        expect(hint, `bölüm ${def.id} hamle ${turn}: hamle kalmadı`).not.toBeNull();
        const { move } = hint!.a.row === hint!.b.row && hint!.a.col === hint!.b.col
          ? session.activateAt(hint!.a)
          : picker.next() < 0.5
            ? session.trySwap(hint!.a, hint!.b)
            : session.trySwap(hint!.b, hint!.a);
        expect(move.kind).toBe('resolved');
        if (move.kind !== 'resolved') return;

        for (const step of move.steps) {
          for (const c of step.cleared) {
            expect(ids.has(c.tileId)).toBe(true);
            ids.delete(c.tileId);
          }
          for (const c of step.created) ids.add(c.tile.id);
          for (const s of step.spawns) ids.add(s.tile.id);
        }
        const boardIds = allTileIds(board);
        expect(new Set(boardIds).size).toBe(boardIds.length);
        expect([...ids].sort()).toEqual([...boardIds].sort());
        expect(hasAnyMatch(board)).toBe(false);
        expect(isSettled(board)).toBe(true);
        for (const p of board.playablePositions()) {
          if (board.isBlocked(p)) expect(board.getTile(p)).toBeNull();
          if (board.isCovered(p)) expect(board.getTile(p)).not.toBeNull();
        }
        ids = new Set(boardIds);
      }
      // Hedef ipucu oyuncusu (hep en büyük eşleşme) bölümü bitirebilmeli.
      expect(session.status, `bölüm ${def.id} 120 hamlede bitmedi`).toBe('won');
    });
  }
});
