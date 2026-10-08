/** SVG belge iskeleti. width/height dokunun piksel boyutudur; viewBox çizim koordinatlarıdır. */
export function svgDoc(width: number, height: number, body: string, viewBox?: string): string {
  const vb = viewBox ?? `0 0 ${width} ${height}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vb}">${body}</svg>`;
}

export type GradientStop = readonly [offset: number, color: string, opacity?: number];

export function stops(list: readonly GradientStop[]): string {
  return list
    .map(
      ([offset, color, opacity]) =>
        `<stop offset="${offset}" stop-color="${color}"${opacity === undefined ? '' : ` stop-opacity="${opacity}"`}/>`,
    )
    .join('');
}

/** Dikey (yukarıdan aşağı) doğrusal geçiş. */
export function verticalGradient(id: string, list: readonly GradientStop[]): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops(list)}</linearGradient>`;
}

/** Kutupsal koordinattan nokta (derece; 0° = sağ, 90° = aşağı). */
export function polar(cx: number, cy: number, radius: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [round(cx + radius * Math.cos(rad)), round(cy + radius * Math.sin(rad))];
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
