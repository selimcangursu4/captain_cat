import { stops, svgDoc } from './svgUtils';

/** Yumuşak kenarlı yuvarlak parçacık (renk, emitter'da tint ile verilir). */
export function dotSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<defs><radialGradient id="d">${stops([[0, '#fff', 1], [0.45, '#fff', 0.95], [1, '#fff', 0]])}</radialGradient></defs>
     <circle cx="32" cy="32" r="32" fill="url(#d)"/>`,
    '0 0 64 64',
  );
}

/** 4 köşeli parıltı. */
export function sparkSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<path d="M32 2 Q36 28 62 32 Q36 36 32 62 Q28 36 2 32 Q28 28 32 2 Z" fill="#fff"/>`,
    '0 0 64 64',
  );
}

/** Kasaba gökyüzünde süzülen bulut. */
/** Konfeti parçası (beyaz; renk tint ile verilir). */
export function confettiSvg(width: number, height: number): string {
  return svgDoc(width, height, `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="3" fill="#fff"/>`);
}

export function cloudSvg(width: number, height: number): string {
  return svgDoc(
    width,
    height,
    `<g fill="#ffffff" opacity=".92">
       <ellipse cx="70" cy="70" rx="58" ry="32"/><ellipse cx="124" cy="48" rx="50" ry="40"/>
       <ellipse cx="182" cy="68" rx="56" ry="32"/><rect x="60" y="62" width="140" height="38" rx="19"/>
     </g>`,
    '0 0 256 110',
  );
}

/** Arka planda yükselen hava kabarcığı. */
export function bubbleSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<circle cx="32" cy="32" r="28" fill="#fff" fill-opacity=".1" stroke="#fff" stroke-opacity=".75" stroke-width="3"/>
     <path d="M18 26 A16 16 0 0 1 30 15" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`,
    '0 0 64 64',
  );
}
