import { describe, expect, it } from 'vitest';
import {
  findMatchGroups,
  findRuns,
  hasAnyMatch,
  matchCellsAt,
} from '../../src/core/matchFinder';
import { boardFrom, sortedPositions } from '../helpers/boardBuilder';

describe('matchFinder', () => {
  it('eşleşme olmayan tahtada boş sonuç döner', () => {
    const board = boardFrom(['FAS', 'ASF', 'SFA']);
    expect(findRuns(board)).toEqual([]);
    expect(findMatchGroups(board)).toEqual([]);
    expect(hasAnyMatch(board)).toBe(false);
  });

  it('yatay 3\'lü eşleşmeyi bulur', () => {
    const board = boardFrom(['FFFA', 'ASRT']);
    const runs = findRuns(board);
    expect(runs).toHaveLength(1);
    expect(runs[0].orientation).toBe('horizontal');
    expect(runs[0].color).toBe('fish');
    expect(sortedPositions(runs[0].cells)).toEqual(['0,0', '0,1', '0,2']);
  });

  it('dikey 3\'lü eşleşmeyi bulur', () => {
    const board = boardFrom(['AF', 'SF', 'RF', 'TA']);
    const runs = findRuns(board);
    expect(runs).toHaveLength(1);
    expect(runs[0].orientation).toBe('vertical');
    expect(sortedPositions(runs[0].cells)).toEqual(['0,1', '1,1', '2,1']);
  });

  it('4\'lü ve 5\'li dizileri tek parça olarak bulur', () => {
    expect(findRuns(boardFrom(['SSSSA']))[0].cells).toHaveLength(4);
    expect(findRuns(boardFrom(['TTTTT']))[0].cells).toHaveLength(5);
  });

  it('2\'li diziyi eşleşme saymaz', () => {
    expect(hasAnyMatch(boardFrom(['FFAFF']))).toBe(false);
  });

  it('L şeklini tek grupta birleştirir (ortak köşe bir kez sayılır)', () => {
    const board = boardFrom(['FAS', 'FAR', 'FFF']);
    const groups = findMatchGroups(board);
    expect(groups).toHaveLength(1);
    expect(groups[0].runs).toHaveLength(2);
    expect(groups[0].cells).toHaveLength(5);
  });

  it('T şeklini tek grupta birleştirir', () => {
    const board = boardFrom(['RRRA', 'SRAS', 'TRST']);
    const groups = findMatchGroups(board);
    expect(groups).toHaveLength(1);
    expect(sortedPositions(groups[0].cells)).toEqual(['0,0', '0,1', '0,2', '1,1', '2,1']);
  });

  it('aynı renkteki ayrı eşleşmeleri ayrı gruplar olarak tutar', () => {
    const board = boardFrom(['FFFA', 'ASRS', 'FFFR']);
    const groups = findMatchGroups(board);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.cells.length === 3)).toBe(true);
  });

  it('farklı renkteki eşzamanlı eşleşmeleri ayrı gruplar olarak bulur', () => {
    const board = boardFrom(['FFFS', 'ARTS', 'RATS']);
    const groups = findMatchGroups(board);
    expect(groups.map((g) => g.color).sort()).toEqual(['fish', 'shell']);
  });

  it('boşluk ve boş kare diziyi böler', () => {
    expect(hasAnyMatch(boardFrom(['FF.F']))).toBe(false);
    expect(hasAnyMatch(boardFrom(['FF_F']))).toBe(false);
    expect(hasAnyMatch(boardFrom(['F.FFF']))).toBe(true);
  });

  it('matchCellsAt yalnızca o kareden geçen eşleşmeyi döndürür', () => {
    const board = boardFrom(['FFFA', 'ASRA', 'TRSA']);
    expect(sortedPositions(matchCellsAt(board, { row: 0, col: 1 }))).toEqual([
      '0,0',
      '0,1',
      '0,2',
    ]);
    expect(matchCellsAt(board, { row: 1, col: 1 })).toEqual([]);
    // Köşe kare hem yatay hem dikey dizide: (0,3) A dikey dizisi
    expect(sortedPositions(matchCellsAt(board, { row: 0, col: 3 }))).toEqual([
      '0,3',
      '1,3',
      '2,3',
    ]);
  });

  it('matchCellsAt artı şeklinde kesişimi tek seferde toplar', () => {
    const board = boardFrom(['AFA', 'FFF', 'AFA']);
    expect(matchCellsAt(board, { row: 1, col: 1 })).toHaveLength(5);
  });
});
