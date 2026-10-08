import { describe, expect, it } from 'vitest';
import type { Activation } from '../../src/core/activation';
import { Match3Engine, type CascadeStep, type MoveResult } from '../../src/core/Match3Engine';
import { hasPossibleMove } from '../../src/core/possibleMoves';
import { Random } from '../../src/core/Random';
import { RandomSpawner } from '../../src/core/spawner';
import type { SpecialKind } from '../../src/core/types';
import {
  boardFrom,
  boardToLines,
  deadBoardLines,
  ScriptedSpawner,
  setSpecial,
  sortedPositions,
} from '../helpers/boardBuilder';

const ALL_COLORS = ['fish', 'anchor', 'shell', 'ring', 'star'] as const;

/** 7x7 eşleşmesiz tahta + verilen karelere güçlendiriciler; yeni taşlar rastgele. */
function deadEngine(specials: [row: number, col: number, kind: SpecialKind][] = []): Match3Engine {
  const board = boardFrom(deadBoardLines(7, 7));
  for (const [row, col, kind] of specials) setSpecial(board, row, col, kind);
  const rng = new Random(3);
  return new Match3Engine(board, rng, new RandomSpawner(rng, ALL_COLORS));
}

function firstStep(result: MoveResult): CascadeStep {
  if (result.kind !== 'resolved') throw new Error(`resolved bekleniyordu, gelen: ${result.kind}`);
  return result.steps[0];
}

function clearedPositions(activation: Activation): string[] {
  return sortedPositions(activation.cleared.map((c) => c.pos));
}

function rowKeys(row: number, cols = 7): string[] {
  return sortedPositions(Array.from({ length: cols }, (_, col) => ({ row, col })));
}

function colKeys(col: number, rows = 7): string[] {
  return sortedPositions(Array.from({ length: rows }, (_, row) => ({ row, col })));
}

describe('güçlendirici oluşumu (kaydırma ile)', () => {
  it('dikey kaydırmayla 4\'lü → dikey Harpun, kaydırılan karede', () => {
    const lines = ['SAFTS', 'FFAFR', 'ATSRA', 'TRTSF'];
    const engine = new Match3Engine(boardFrom(lines), new Random(1), new ScriptedSpawner('RTF'));
    const step = firstStep(engine.trySwap({ row: 0, col: 2 }, { row: 1, col: 2 }));

    expect(step.created).toHaveLength(1);
    expect(step.created[0].tile.special).toBe('harpoon-v');
    expect(step.created[0].pos).toEqual({ row: 1, col: 2 });
    expect(step.created[0].mergedTileIds).toHaveLength(4);
    expect(engine.board.getTile({ row: 1, col: 2 })!.special).toBe('harpoon-v');
  });

  it('yatay kaydırmayla 4\'lü → yatay Harpun; yeni güçlendirici yerçekimiyle düşer', () => {
    const lines = ['ASFT', 'STFR', 'RAAF', 'TRFS', 'ASTR'];
    const engine = new Match3Engine(boardFrom(lines), new Random(1), new ScriptedSpawner('RST'));
    const result = engine.trySwap({ row: 2, col: 3 }, { row: 2, col: 2 });
    const step = firstStep(result);

    expect(step.created[0].tile.special).toBe('harpoon-h');
    expect(step.created[0].pos).toEqual({ row: 2, col: 2 });
    const fall = step.falls.find((f) => f.tileId === step.created[0].tile.id);
    expect(fall?.to).toEqual({ row: 3, col: 2 });
    expect(engine.board.getTile({ row: 3, col: 2 })!.special).toBe('harpoon-h');
  });

  it('aynı adımda doğan güçlendirici, o adımdaki patlamalardan korunur', () => {
    // (1,0) Harpun 4'lü eşleşmeye katılır → tetiklenir; yeni Harpun (1,2)'de doğar ve sağ kalır.
    const board = boardFrom(['SAFT', 'FFAF', 'RTSR']);
    setSpecial(board, 1, 0, 'harpoon-h');
    const engine = new Match3Engine(board, new Random(1), new ScriptedSpawner('TSF'));
    const step = firstStep(engine.trySwap({ row: 0, col: 2 }, { row: 1, col: 2 }));

    expect(step.created[0].pos).toEqual({ row: 1, col: 2 });
    expect(step.activations).toHaveLength(1);
    expect(step.activations[0]).toMatchObject({ kind: 'harpoon-h', wave: 1 });
    expect(engine.board.getTile({ row: 1, col: 2 })!.id).toBe(step.created[0].tile.id);
    expect(boardToLines(engine.board)).toEqual(['TSAF', 'SAFT', 'RTSR']);
  });
});

describe('tekil güçlendirici etkileri (dokunarak)', () => {
  it('yatay Harpun satırı, dikey Harpun sütunu temizler', () => {
    const h = firstStep(deadEngine([[3, 3, 'harpoon-h']]).activateAt({ row: 3, col: 3 }));
    expect(h.activations[0].kind).toBe('harpoon-h');
    expect(clearedPositions(h.activations[0])).toEqual(rowKeys(3));

    const v = firstStep(deadEngine([[3, 3, 'harpoon-v']]).activateAt({ row: 3, col: 3 }));
    expect(clearedPositions(v.activations[0])).toEqual(colKeys(3));
  });

  it('Gülle 3x3 patlar; köşede tahta dışına taşmaz', () => {
    const center = firstStep(deadEngine([[3, 3, 'cannon']]).activateAt({ row: 3, col: 3 }));
    expect(center.activations[0].cleared).toHaveLength(9);
    const corner = firstStep(deadEngine([[0, 0, 'cannon']]).activateAt({ row: 0, col: 0 }));
    expect(clearedPositions(corner.activations[0])).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });

  it('Martı 4 komşusunu kırar ve başka bir hedefe uçar', () => {
    const step = firstStep(deadEngine([[3, 3, 'seagull']]).activateAt({ row: 3, col: 3 }));
    const act = step.activations[0];
    expect(act.kind).toBe('seagull');
    expect(sortedPositions(act.cells)).toEqual(['2,3', '3,2', '3,3', '3,4', '4,3']);
    expect(act.target).toBeDefined();
    expect(sortedPositions(act.cells)).not.toContain(`${act.target!.row},${act.target!.col}`);
    expect(act.cleared).toHaveLength(6);
  });

  it('Martı hedefi değiştirilebilir seçiciyle belirlenir (Aşama 3 hedef önceliği için)', () => {
    const board = boardFrom(deadBoardLines(7, 7));
    setSpecial(board, 3, 3, 'seagull');
    const rng = new Random(1);
    const engine = new Match3Engine(board, rng, new RandomSpawner(rng, ALL_COLORS), {
      targetPicker: (_b, candidates) => candidates.find((p) => p.row === 6 && p.col === 6) ?? null,
    });
    const act = firstStep(engine.activateAt({ row: 3, col: 3 })).activations[0];
    expect(act.target).toEqual({ row: 6, col: 6 });
  });

  it('tek başına Girdap tahtada en çok bulunan rengi toplar', () => {
    const engine = deadEngine([[3, 3, 'whirlpool']]);
    const counts = new Map<string, number>();
    for (const p of engine.board.playablePositions()) {
      const t = engine.board.getTile(p)!;
      if (!t.special) counts.set(t.color, (counts.get(t.color) ?? 0) + 1);
    }
    const max = Math.max(...counts.values());
    const act = firstStep(engine.activateAt({ row: 3, col: 3 })).activations[0];
    expect(act.kind).toBe('whirlpool');
    expect(counts.get(act.color)).toBe(max);
    expect(act.cleared).toHaveLength(max + 1); // + Girdap'ın kendisi
  });

  it('sıradan taşa dokunmak geçersizdir', () => {
    expect(deadEngine().activateAt({ row: 1, col: 1 }).kind).toBe('invalid');
  });
});

describe('zincirleme', () => {
  it('Harpun yolundaki Gülle bir sonraki dalgada patlar', () => {
    const step = firstStep(deadEngine([[3, 0, 'harpoon-h'], [3, 5, 'cannon']]).activateAt({ row: 3, col: 0 }));
    expect(step.activations.map((a) => [a.kind, a.wave])).toEqual([
      ['harpoon-h', 1],
      ['cannon', 2],
    ]);
    expect(step.cleared).toHaveLength(7 + 6); // satır + 3x3'ün satır dışında kalan 6 karesi
  });

  it('her güçlendirici en fazla bir kez tetiklenir', () => {
    const step = firstStep(deadEngine([[3, 0, 'harpoon-h'], [3, 6, 'harpoon-h']]).activateAt({ row: 3, col: 0 }));
    expect(step.activations).toHaveLength(2);
    expect(step.activations[1].cleared).toHaveLength(0);
    expect(step.cleared).toHaveLength(7);
  });
});

describe('kaydırma ile tetikleme ve kombinasyonlar', () => {
  it('güçlendirici + sıradan taş: eşleşme olmasa da geçerli, yeni yerinde patlar', () => {
    const result = deadEngine([[3, 3, 'harpoon-h']]).trySwap({ row: 3, col: 3 }, { row: 2, col: 3 });
    const act = firstStep(result).activations[0];
    expect(act).toMatchObject({ kind: 'harpoon-h', origin: { row: 2, col: 3 } });
    expect(clearedPositions(act)).toEqual(rowKeys(2));
  });

  it('Girdap + sıradan taş: o renkteki tüm taşları toplar', () => {
    const engine = deadEngine([[3, 3, 'whirlpool']]);
    const color = engine.board.getTile({ row: 3, col: 4 })!.color;
    const sameColor = engine.board.playablePositions().filter((p) => engine.board.getTile(p)!.color === color);
    const act = firstStep(engine.trySwap({ row: 3, col: 3 }, { row: 3, col: 4 })).activations[0];
    expect(act).toMatchObject({ kind: 'whirlpool', color });
    expect(act.cleared).toHaveLength(sameColor.length + 1);
  });

  it('Harpun + Harpun → artı (satır + sütun)', () => {
    const step = firstStep(deadEngine([[3, 3, 'harpoon-h'], [3, 4, 'harpoon-v']]).trySwap({ row: 3, col: 3 }, { row: 3, col: 4 }));
    expect(step.activations[0]).toMatchObject({ kind: 'harpoon-cross', origin: { row: 3, col: 4 } });
    expect(clearedPositions(step.activations[0])).toEqual(sortedPositions(
      [...rowKeys(3), ...colKeys(4)].filter((k, i, all) => all.indexOf(k) === i).map((k) => {
        const [row, col] = k.split(',').map(Number);
        return { row, col };
      }),
    ));
    expect(step.activations).toHaveLength(1);
  });

  it('Gülle + Gülle → 5x5', () => {
    const step = firstStep(deadEngine([[3, 3, 'cannon'], [3, 4, 'cannon']]).trySwap({ row: 3, col: 3 }, { row: 3, col: 4 }));
    expect(step.activations[0].kind).toBe('cannon-big');
    expect(step.activations[0].cleared).toHaveLength(25);
  });

  it('Harpun + Gülle → 3 satır + 3 sütun', () => {
    const step = firstStep(deadEngine([[3, 3, 'harpoon-h'], [3, 4, 'cannon']]).trySwap({ row: 3, col: 3 }, { row: 3, col: 4 }));
    expect(step.activations[0].kind).toBe('harpoon-cannon');
    expect(step.activations[0].cleared).toHaveLength(3 * 7 + 3 * 7 - 9);
  });

  it('Girdap + Harpun → o renkteki taşlar Harpun olur ve hepsi patlar', () => {
    const engine = deadEngine([[3, 3, 'whirlpool'], [3, 4, 'harpoon-h']]);
    const color = engine.board.getTile({ row: 3, col: 4 })!.color;
    const plainOfColor = engine.board
      .playablePositions()
      .filter((p) => engine.board.getTile(p)!.color === color && !engine.board.getTile(p)!.special).length;

    const step = firstStep(engine.trySwap({ row: 3, col: 3 }, { row: 3, col: 4 }));
    const convert = step.activations[0];
    expect(convert).toMatchObject({ kind: 'whirlpool-convert', color, wave: 1 });
    expect(convert.converted).toHaveLength(plainOfColor);
    expect(convert.converted!.every((c) => c.special === 'harpoon-h' || c.special === 'harpoon-v')).toBe(true);
    // Dönüşenler + asıl Harpun bir sonraki dalgada patlar.
    expect(step.activations.filter((a) => a.wave === 2)).toHaveLength(plainOfColor + 1);
  });

  it('Girdap + Girdap → tüm tahta temizlenir', () => {
    const step = firstStep(deadEngine([[3, 3, 'whirlpool'], [3, 4, 'whirlpool']]).trySwap({ row: 3, col: 3 }, { row: 3, col: 4 }));
    expect(step.activations[0].kind).toBe('whirlpool-all');
    expect(step.cleared).toHaveLength(49);
  });

  it('Martı + Harpun → Martı Harpunu hedefe taşır', () => {
    const step = firstStep(deadEngine([[3, 3, 'seagull'], [3, 4, 'harpoon-v']]).trySwap({ row: 3, col: 3 }, { row: 3, col: 4 }));
    const act = step.activations[0];
    expect(act).toMatchObject({ kind: 'seagull', carried: 'harpoon-v' });
    expect(act.targetCells!.every((p) => p.col === act.target!.col)).toBe(true);
  });

  it('Martı + Martı → 3 martı uçar, farklı hedeflere', () => {
    const step = firstStep(deadEngine([[3, 3, 'seagull'], [3, 4, 'seagull']]).trySwap({ row: 3, col: 3 }, { row: 3, col: 4 }));
    const gulls = step.activations.filter((a) => a.kind === 'seagull' && a.wave === 1);
    expect(gulls).toHaveLength(3);
    const targets = new Set(gulls.map((g) => `${g.target!.row},${g.target!.col}`));
    expect(targets.size).toBe(3);
  });
});

describe('hamle kalmama durumu', () => {
  it('eşleşme yoksa ama güçlendirici varsa karıştırma gerekmez ve ipucu onu gösterir', () => {
    const engine = deadEngine([[2, 2, 'cannon']]);
    expect(hasPossibleMove(engine.board)).toBe(true);
    expect(engine.ensurePlayable()).toBeNull();
    expect(engine.findHint()).toEqual({ a: { row: 2, col: 2 }, b: { row: 2, col: 2 }, matchCells: [{ row: 2, col: 2 }] });
  });
});
