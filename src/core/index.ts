/** Tahta mantığının dışa açık yüzü. Phaser'dan bağımsızdır; yalnızca saf TypeScript. */
export * from './types';
export * from './pos';
export { Random } from './Random';
export { Board, type PlacedObstacle } from './Board';
export { findEnclosedHoles, parseShape, rectShape, type BoardShape } from './BoardShape';
export * from './matchFinder';
export * from './gravity';
export * from './possibleMoves';
export * from './generator';
export * from './shuffle';
export * from './spawner';
export * from './specials';
export * from './activation';
export * from './obstacles';
export * from './Match3Engine';
export * from './level';
