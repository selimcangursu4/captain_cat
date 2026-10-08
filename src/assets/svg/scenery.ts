import { svgDoc, verticalGradient } from './svgUtils';

/** Okyanus arka planı: gökyüzünden derine geçiş, ışık huzmeleri, altta kum. Ekrana gerilerek çizilir. */
export function oceanBackgroundSvg(width: number, height: number): string {
  const rays = [
    [70, 150, -40, 720],
    [210, 260, 120, 760],
    [360, 420, 330, 700],
    [470, 520, 500, 640],
  ]
    .map(
      ([x1, x2, x3, y]) =>
        `<polygon points="${x1},0 ${x2},0 ${x3 + (x2 - x1)},${y} ${x3},${y}" fill="url(#ray)"/>`,
    )
    .join('');
  return svgDoc(
    width,
    height,
    `<defs>
       ${verticalGradient('sea', [[0, '#8EE3FA'], [0.3, '#3BB3DE'], [0.72, '#1A7DB2'], [1, '#0C5687']])}
       ${verticalGradient('ray', [[0, '#ffffff', 0.22], [1, '#ffffff', 0]])}
       ${verticalGradient('sand', [[0, '#F8E2AE'], [1, '#DDB06A']])}
     </defs>
     <rect width="540" height="960" fill="url(#sea)"/>
     ${rays}
     <path d="M0 900 Q30 850 22 800 M40 905 Q75 860 60 820 M500 905 Q470 860 485 815 M520 910 Q545 870 530 840"
       fill="none" stroke="#1f9d6b" stroke-width="10" stroke-linecap="round" opacity=".7"/>
     <path d="M0 895 Q135 860 270 885 Q405 910 540 875 V960 H0 Z" fill="url(#sand)"/>
     <circle cx="95" cy="925" r="5" fill="#c9965a" opacity=".6"/>
     <circle cx="300" cy="935" r="4" fill="#c9965a" opacity=".6"/>
     <circle cx="430" cy="915" r="6" fill="#c9965a" opacity=".5"/>`,
    '0 0 540 960',
  );
}
