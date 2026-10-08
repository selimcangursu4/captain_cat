import { svgDoc, verticalGradient } from './svgUtils';

/** Engel çizimleri (128x128 kare). */

/** Yosun: karenin zeminini kaplayan tüylü yeşil yama (taşın altında kalır, kenarlardan görünür). */
export function mossSvg(size: number, layers: number): string {
  const thick = layers >= 2;
  const base = thick ? '#3f9d4a' : '#79cf5a';
  const light = thick ? '#6cc36a' : '#a8e98a';
  const dark = thick ? '#276b31' : '#4f9e3b';
  const bumps: string[] = [];
  for (let i = 0; i < 5; i++) {
    const t = 16 + i * 24;
    bumps.push(
      `<circle cx="${t}" cy="8" r="9"/>`,
      `<circle cx="${t}" cy="120" r="9"/>`,
      `<circle cx="8" cy="${t}" r="9"/>`,
      `<circle cx="120" cy="${t}" r="9"/>`,
    );
  }
  return svgDoc(
    size,
    size,
    `<defs>${verticalGradient('m', [[0, light], [1, base]])}</defs>
     <g fill="${base}">${bumps.join('')}</g>
     <rect x="5" y="5" width="118" height="118" rx="26" fill="url(#m)"/>
     <g fill="${dark}" opacity=".45">
       <circle cx="30" cy="34" r="5"/><circle cx="96" cy="28" r="4"/><circle cx="24" cy="96" r="4"/>
       <circle cx="100" cy="98" r="5"/><circle cx="64" cy="18" r="3"/><circle cx="64" cy="112" r="3"/>
     </g>
     ${thick ? `<g fill="none" stroke="${dark}" stroke-width="4" stroke-linecap="round" opacity=".6">
       <path d="M14 60 q8 -10 16 0"/><path d="M98 64 q8 -10 16 0"/><path d="M56 14 q8 -10 16 0"/><path d="M56 118 q8 -10 16 0"/>
     </g>` : ''}`,
    '0 0 128 128',
  );
}

/** Ağ: taşın üstüne atılmış seyrek halat ağı (altındaki taşın rengi okunabilsin). */
export function netSvg(size: number): string {
  const step = 44;
  const lines: string[] = [];
  for (let i = -128 + 20; i <= 128; i += step) {
    lines.push(`M${i} 0 L${i + 128} 128`, `M${i + 128} 0 L${i} 128`);
  }
  // Halatların kesiştiği noktalara düğüm.
  const knots: string[] = [];
  for (let a = -128 + 20; a <= 128; a += step) {
    for (let b = 20; b <= 256; b += step) {
      const x = (a + b) / 2;
      const y = (b - a) / 2;
      if (x > 10 && x < 118 && y > 10 && y < 118) knots.push(`<circle cx="${x}" cy="${y}" r="4.5"/>`);
    }
  }
  return svgDoc(
    size,
    size,
    `<defs><clipPath id="c"><rect x="6" y="6" width="116" height="116" rx="20"/></clipPath></defs>
     <g clip-path="url(#c)" opacity=".92">
       <path d="${lines.join(' ')}" stroke="#5b3410" stroke-width="6.5" fill="none" opacity=".75"/>
       <path d="${lines.join(' ')}" stroke="#e0ac70" stroke-width="2.5" fill="none"/>
       <g fill="#a86a33" stroke="#5b3410" stroke-width="2">${knots.join('')}</g>
     </g>
     <rect x="6" y="6" width="116" height="116" rx="20" fill="none" stroke="#5b3410" stroke-width="7"/>
     <rect x="6" y="6" width="116" height="116" rx="20" fill="none" stroke="#c98a4b" stroke-width="3"/>`,
    '0 0 128 128',
  );
}

/** Ağzı iple bağlanmış çuval (kutunun içine sığar). */
function sack(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const neckY = y + h * 0.22;
  const body = `M${cx - w * 0.15} ${neckY}
    C${x - w * 0.02} ${y + h * 0.32}, ${x - w * 0.05} ${y + h * 0.96}, ${x + w * 0.2} ${y + h}
    L${x + w * 0.8} ${y + h}
    C${x + w * 1.05} ${y + h * 0.96}, ${x + w * 1.02} ${y + h * 0.32}, ${cx + w * 0.15} ${neckY} Z`;
  const tuft = `M${cx - w * 0.13} ${neckY} L${cx - w * 0.22} ${y + h * 0.02} L${cx - w * 0.06} ${y + h * 0.12}
    L${cx} ${y} L${cx + w * 0.06} ${y + h * 0.12} L${cx + w * 0.22} ${y + h * 0.03} L${cx + w * 0.13} ${neckY} Z`;
  return `
    <g stroke-linejoin="round">
      <path d="${tuft}" fill="url(#burlap)" stroke="#6e4f22" stroke-width="4"/>
      <path d="${body}" fill="url(#burlap)" stroke="#6e4f22" stroke-width="5"/>
      <path d="M${x + w * 0.16} ${y + h * 0.62} Q${cx} ${y + h * 0.7} ${x + w * 0.84} ${y + h * 0.62}"
        fill="none" stroke="#a8844a" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round"/>
      <rect x="${cx - w * 0.19}" y="${neckY - h * 0.05}" width="${w * 0.38}" height="${h * 0.1}" rx="${h * 0.05}"
        fill="#8b5a2b" stroke="#5b3410" stroke-width="3"/>
      <ellipse cx="${x + w * 0.32}" cy="${y + h * 0.48}" rx="${w * 0.1}" ry="${h * 0.12}" fill="#fff" opacity=".28"/>
    </g>`;
}

/** Kum torbası: katman sayısı kadar çuval (1: tek büyük, 2: yan yana, 3: üçlü yığın). */
export function sandbagSvg(size: number, layers: number): string {
  const sacks =
    layers >= 3
      ? sack(8, 60, 56, 60) + sack(64, 60, 56, 60) + sack(36, 8, 56, 60)
      : layers === 2
        ? sack(8, 26, 56, 92) + sack(64, 26, 56, 92)
        : sack(22, 10, 84, 108);
  return svgDoc(
    size,
    size,
    `<defs>${verticalGradient('burlap', [[0, '#ecd29a'], [1, '#c9a462']])}</defs>
     <rect x="4" y="4" width="120" height="120" rx="20" fill="#000" opacity=".12"/>
     ${sacks}`,
    '0 0 128 128',
  );
}

/** Kilitli sandık. */
export function chestSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<defs>
       ${verticalGradient('wood', [[0, '#c98a4b'], [1, '#8b5a2b']])}
       ${verticalGradient('lid', [[0, '#d99a5b'], [1, '#a86a33']])}
     </defs>
     <rect x="10" y="50" width="108" height="66" rx="10" fill="url(#wood)" stroke="#4a2a0c" stroke-width="5"/>
     <path d="M10 54 Q10 14 64 14 Q118 14 118 54 Z" fill="url(#lid)" stroke="#4a2a0c" stroke-width="5" stroke-linejoin="round"/>
     <rect x="24" y="16" width="12" height="100" fill="#9aa5b4" stroke="#4a2a0c" stroke-width="3"/>
     <rect x="92" y="16" width="12" height="100" fill="#9aa5b4" stroke="#4a2a0c" stroke-width="3"/>
     <path d="M10 54 H118" stroke="#4a2a0c" stroke-width="5"/>
     <rect x="50" y="42" width="28" height="32" rx="6" fill="#ffcb3d" stroke="#8a5a00" stroke-width="4"/>
     <circle cx="64" cy="54" r="4.5" fill="#5a3a00"/>
     <path d="M64 56 V64" stroke="#5a3a00" stroke-width="4" stroke-linecap="round"/>
     <path d="M30 26 Q44 20 58 22" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".35"/>`,
    '0 0 128 128',
  );
}

/** Martı yuvası: çalı çırpıdan yuva, içinden yavru martı bakıyor. */
export function nestSvg(size: number): string {
  const twigs: string[] = [];
  for (let i = 0; i < 9; i++) {
    const y = 76 + (i % 3) * 9;
    const x = 14 + i * 10;
    twigs.push(`<path d="M${x} ${y} q${18} ${-8} ${34} ${4}" />`);
  }
  return svgDoc(
    size,
    size,
    `<ellipse cx="64" cy="112" rx="50" ry="8" fill="#06263d" opacity=".2"/>
     <circle cx="64" cy="58" r="24" fill="#fff" stroke="#2b3a4a" stroke-width="4"/>
     <circle cx="56" cy="54" r="3.5" fill="#1b2433"/>
     <circle cx="72" cy="54" r="3.5" fill="#1b2433"/>
     <path d="M58 62 L64 72 L70 62 Z" fill="#ffb020" stroke="#2b3a4a" stroke-width="3" stroke-linejoin="round"/>
     <path d="M52 34 q4 -10 10 -2 q4 -10 10 0" fill="#fff" stroke="#2b3a4a" stroke-width="3"/>
     <path d="M10 74 Q64 58 118 74 L110 104 Q64 118 18 104 Z" fill="#a8743f" stroke="#5b3410" stroke-width="5" stroke-linejoin="round"/>
     <g fill="none" stroke="#6e4220" stroke-width="3.5" stroke-linecap="round">${twigs.join('')}</g>
     <g fill="none" stroke="#d9a066" stroke-width="2" stroke-linecap="round" opacity=".8">
       <path d="M22 84 q20 -6 40 0"/><path d="M66 90 q20 -6 40 0"/>
     </g>`,
    '0 0 128 128',
  );
}
