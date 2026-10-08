import { LAYOUT } from '../../config/layout';

/** Tahtanın ekrandaki yeri ve kare boyutu (oyun pikseli). Saf hesap — test edilebilir. */
export interface BoardLayout {
  readonly cellSize: number;
  /** Tahtanın sol üst köşesi. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function computeBoardLayout(
  viewWidth: number,
  viewHeight: number,
  rows: number,
  cols: number,
): BoardLayout {
  const outer = LAYOUT.framePadding + LAYOUT.frameBorder;
  const availableWidth = Math.min(viewWidth, LAYOUT.maxContentWidth) - 2 * (LAYOUT.sideMargin + outer);
  const availableHeight = viewHeight - LAYOUT.hudHeight - LAYOUT.bottomHeight - 2 * outer;
  const cellSize = Math.max(
    1,
    Math.floor(Math.min(availableWidth / cols, availableHeight / rows, LAYOUT.maxCellSize)),
  );
  const width = cellSize * cols;
  const height = cellSize * rows;
  return {
    cellSize,
    width,
    height,
    x: Math.round((viewWidth - width) / 2),
    y: Math.round(LAYOUT.hudHeight + outer + (availableHeight - height) / 2),
  };
}
