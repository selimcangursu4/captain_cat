import { describe, expect, it } from 'vitest';
import { Match3Engine } from '../../src/core/Match3Engine';
import { hasAnyMatch } from '../../src/core/matchFinder';
import { Random } from '../../src/core/Random';
import { RandomSpawner } from '../../src/core/spawner';
import { parseLevel } from '../../src/core/level/parseLevel';
import { LevelSession } from '../../src/core/level/LevelSession';
import { boardFrom, deadBoardLines, placeBlock, setSpecial } from '../helpers/boardBuilder';

/** 4x4 sabit taşlı bölüm (bkz. level.test.ts). */
function fixedLevel(goalCount: number, moves = 10) {
  return parseLevel({
    id: 7,
    moves,
    colors: ['fish', 'anchor', 'shell', 'ring', 'star'],
    board: ['xxxx', 'xxxx', 'xxxx', 'xxxx'],
    tiles: ['FAFR', 'SFRT', 'ATSA', 'RSAT'],
    goals: [{ type: 'color', color: 'fish', count: goalCount }],
    seed: 5,
  });
}

function engineFor(lines: string[]) {
  const board = boardFrom(lines);
  const rng = new Random(3);
  return new Match3Engine(board, rng, new RandomSpawner(rng, ['fish', 'anchor', 'shell', 'ring', 'star']));
}

describe('Kürek ve Dümen (motor)', () => {
  it('Kürek yalnızca seçilen kareyi kırar; tahta yeniden dolar', () => {
    const engine = engineFor(deadBoardLines(6, 6));
    const target = engine.board.getTile({ row: 3, col: 2 })!;
    const result = engine.useTool('shovel', { row: 3, col: 2 });
    expect(result.kind).toBe('resolved');
    if (result.kind !== 'resolved') return;
    const first = result.steps[0];
    expect(first.activations).toHaveLength(1);
    expect(first.activations[0]).toMatchObject({ kind: 'shovel', cells: [{ row: 3, col: 2 }] });
    expect(first.cleared.map((c) => c.tileId)).toEqual([target.id]);
    expect(engine.board.isFull()).toBe(true);
    expect(hasAnyMatch(engine.board)).toBe(false);
  });

  it('Dümen dokunulan karenin bütün satırını temizler', () => {
    const engine = engineFor(deadBoardLines(6, 6));
    const rowIds = [0, 1, 2, 3, 4, 5].map((col) => engine.board.getTile({ row: 4, col })!.id);
    const result = engine.useTool('helm', { row: 4, col: 1 });
    if (result.kind !== 'resolved') throw new Error('çözülmedi');
    const first = result.steps[0];
    expect(first.activations[0].kind).toBe('helm');
    expect(first.cleared.map((c) => c.tileId).sort()).toEqual([...rowIds].sort());
  });

  it('Kürek güçlendiriciye vurursa güçlendirici de patlar', () => {
    const engine = engineFor(deadBoardLines(6, 6));
    setSpecial(engine.board, 2, 2, 'harpoon-v');
    const result = engine.useTool('shovel', { row: 2, col: 2 });
    if (result.kind !== 'resolved') throw new Error('çözülmedi');
    const kinds = result.steps[0].activations.map((a) => a.kind);
    expect(kinds).toEqual(['shovel', 'harpoon-v']);
    expect(result.steps[0].cleared.length).toBe(6); // sütunun tamamı
  });

  it('Kürek blok engele (kum torbası) vurur; boşluğa kullanılamaz', () => {
    const lines = deadBoardLines(5, 5);
    lines[0] = '.' + lines[0].slice(1);
    const engine = engineFor(lines);
    placeBlock(engine.board, 3, 3, 'sandbag', 2);
    const result = engine.useTool('shovel', { row: 3, col: 3 });
    if (result.kind !== 'resolved') throw new Error('çözülmedi');
    const hits = result.steps[0].activations[0].obstacleHits;
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: 'sandbag', layersLeft: 1 });
    expect(engine.useTool('shovel', { row: 0, col: 0 }).kind).toBe('invalid');
    expect(engine.useTool('helm', { row: 9, col: 0 }).kind).toBe('invalid');
  });
});

describe('yardımcılar (bölüm oturumu)', () => {
  it('Kürek ve Dümen hamle harcamaz ama hedefe sayılır; bölümü kazandırabilir', () => {
    const session = new LevelSession(fixedLevel(2));
    // Satır 0: F A F R → Dümen iki balığı birden toplar.
    const turn = session.useTool('helm', { row: 0, col: 3 });
    expect(turn.move.kind).toBe('resolved');
    expect(turn.movesLeft).toBe(10);
    expect(turn.status).toBe('won');
  });

  it('geçersiz yardımcı kullanımı hiçbir şey değiştirmez', () => {
    const session = new LevelSession(fixedLevel(20));
    const turn = session.useTool('shovel', { row: 7, col: 7 });
    expect(turn.move.kind).toBe('invalid');
    expect(session.movesLeft).toBe(10);
  });

  it('Fırtına tahtayı karıştırır, hamle harcamaz, hazır eşleşme bırakmaz', () => {
    const session = new LevelSession(fixedLevel(20));
    const ids = session.engine.board.playablePositions().map((p) => session.engine.board.getTile(p)!.id);
    const moves = session.useStorm();
    expect(moves).not.toBeNull();
    expect(moves!.map((m) => m.tileId).sort()).toEqual([...ids].sort());
    expect(session.movesLeft).toBe(10);
    expect(hasAnyMatch(session.engine.board)).toBe(false);
  });

  it('bölüm öncesi güçlendirici rastgele bir taşı dönüştürür', () => {
    const session = new LevelSession(fixedLevel(20));
    const placed = session.placeBooster(['cannon']);
    expect(placed).not.toBeNull();
    expect(session.engine.board.getTile(placed!.pos)).toMatchObject({ id: placed!.tileId, special: 'cannon' });
  });
});
