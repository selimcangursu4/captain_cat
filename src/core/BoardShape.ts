/**
 * Tahtanın şekli: hangi karelerin oynanabilir olduğu.
 * Bölüm dosyalarında satır dizisi olarak yazılır:
 *   'x' (veya 'X', 'o') → oynanabilir kare
 *   '.' (veya ' ')      → boşluk (tahtada yok)
 */
export interface BoardShape {
  readonly rows: number;
  readonly cols: number;
  /** Satır öncelikli (row * cols + col). */
  readonly playable: readonly boolean[];
}

const PLAYABLE_CHARS = new Set(['x', 'X', 'o']);
const HOLE_CHARS = new Set(['.', ' ']);

export function rectShape(rows: number, cols: number): BoardShape {
  if (rows < 1 || cols < 1) throw new Error(`Geçersiz tahta boyutu: ${rows}x${cols}`);
  return { rows, cols, playable: new Array<boolean>(rows * cols).fill(true) };
}

/**
 * Tahtanın içinde kalan (dış kenara boşluk üzerinden bağlanmayan) boşluk kareleri.
 * Görünüm bunları çerçeve rengiyle doldurur; kenara açılan boşluklar (ör. elmas
 * köşeleri) şeffaf kalır.
 */
export function findEnclosedHoles(shape: BoardShape): { row: number; col: number }[] {
  const { rows, cols, playable } = shape;
  const outside = new Array<boolean>(rows * cols).fill(false);
  const stack: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const onEdge = row === 0 || col === 0 || row === rows - 1 || col === cols - 1;
      const i = row * cols + col;
      if (onEdge && !playable[i]) {
        outside[i] = true;
        stack.push(i);
      }
    }
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const row = Math.floor(i / cols);
    const col = i % cols;
    for (const [r, c] of [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ]) {
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const j = r * cols + c;
      if (!playable[j] && !outside[j]) {
        outside[j] = true;
        stack.push(j);
      }
    }
  }
  const enclosed: { row: number; col: number }[] = [];
  for (let i = 0; i < rows * cols; i++) {
    if (!playable[i] && !outside[i]) enclosed.push({ row: Math.floor(i / cols), col: i % cols });
  }
  return enclosed;
}

export function parseShape(lines: readonly string[]): BoardShape {
  if (lines.length === 0) throw new Error('Tahta şekli boş olamaz');
  const cols = lines[0].length;
  const playable: boolean[] = [];
  lines.forEach((line, row) => {
    if (line.length !== cols) {
      throw new Error(`Tahta şekli satır ${row}: ${line.length} sütun, beklenen ${cols}`);
    }
    for (const ch of line) {
      if (PLAYABLE_CHARS.has(ch)) playable.push(true);
      else if (HOLE_CHARS.has(ch)) playable.push(false);
      else throw new Error(`Tahta şekli satır ${row}: bilinmeyen karakter '${ch}'`);
    }
  });
  if (!playable.some(Boolean)) throw new Error('Tahta şeklinde hiç oynanabilir kare yok');
  return { rows: lines.length, cols, playable };
}
