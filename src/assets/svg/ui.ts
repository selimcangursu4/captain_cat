import { svgDoc, verticalGradient } from './svgUtils';

/**
 * Turuncu buton (9-dilim olarak gerilir: köşeler sabit, orta uzar).
 * pressed: üst yüz aşağı göçmüş, gölge incelmiş hali. variant: 'green' onay butonları için.
 */
export function buttonSvg(size: number, pressed: boolean, variant: 'orange' | 'green' = 'orange'): string {
  const sink = pressed ? 6 : 0;
  const colors =
    variant === 'green'
      ? { shadow: '#1f6b2d', face: pressed ? '#3fae4f' : '#5ccf5f' }
      : { shadow: '#8a4b14', face: pressed ? '#e8962a' : '#ffb547' };
  return svgDoc(
    size,
    size,
    `<rect x="3" y="13" width="114" height="104" rx="30" fill="${colors.shadow}"/>
     <rect x="3" y="${3 + sink}" width="114" height="104" rx="30" fill="${colors.face}"
       stroke="${colors.shadow}" stroke-width="5"/>
     <rect x="16" y="${11 + sink}" width="88" height="28" rx="14" fill="#fff" opacity=".28"/>`,
    '0 0 120 120',
  );
}

/** Üst bilgi paneli (hamle, hedefler) — koyu lacivert, açık kenarlı; 9-dilim. */
export function hudPanelSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<defs>${verticalGradient('p', [[0, '#1d5f8a'], [1, '#0d4466']])}</defs>
     <rect x="3" y="7" width="114" height="110" rx="30" fill="#06263d" opacity=".35"/>
     <rect x="3" y="3" width="114" height="110" rx="30" fill="url(#p)" stroke="#7fd6f5" stroke-width="6"/>
     <rect x="14" y="12" width="92" height="22" rx="11" fill="#fff" opacity=".1"/>`,
    '0 0 120 120',
  );
}

/** Açılır pencere gövdesi — krem kağıt, ahşap çerçeve; 9-dilim. */
export function popupPanelSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<defs>
       ${verticalGradient('wood', [[0, '#c98a4b'], [1, '#8b5a2b']])}
       ${verticalGradient('paper', [[0, '#fff8e6'], [1, '#f6e3bb']])}
     </defs>
     <rect x="4" y="10" width="152" height="146" rx="40" fill="#06263d" opacity=".3"/>
     <rect x="4" y="4" width="152" height="146" rx="40" fill="url(#wood)" stroke="#4a2a0c" stroke-width="6"/>
     <rect x="20" y="20" width="120" height="114" rx="26" fill="url(#paper)" stroke="#d9a066" stroke-width="4"/>`,
    '0 0 160 160',
  );
}

export function coinSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<defs>${verticalGradient('g', [[0, '#fff09a'], [0.5, '#ffcb3d'], [1, '#e09a00']])}</defs>
     <circle cx="32" cy="32" r="28" fill="url(#g)" stroke="#8a5a00" stroke-width="4"/>
     <circle cx="32" cy="32" r="19" fill="none" stroke="#b07800" stroke-width="3" opacity=".7"/>
     <path d="M32 20 V44 M25 26 Q32 20 39 26 Q32 32 25 38 Q32 44 39 38" fill="none" stroke="#8a5a00" stroke-width="3.5" stroke-linecap="round"/>
     <ellipse cx="22" cy="18" rx="7" ry="4" fill="#fff" opacity=".6" transform="rotate(-30 22 18)"/>`,
    '0 0 64 64',
  );
}

export function bigStarSvg(size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = ((-90 + i * 36) * Math.PI) / 180;
    const r = i % 2 === 0 ? 58 : 27;
    pts.push(`${(64 + r * Math.cos(a)).toFixed(1)} ${(68 + r * Math.sin(a)).toFixed(1)}`);
  }
  const d = `M${pts.join(' L')} Z`;
  return svgDoc(
    size,
    size,
    `<defs>${verticalGradient('s', [[0, '#fff3a0'], [0.5, '#ffd23f'], [1, '#f0a000']])}</defs>
     <path d="${d}" fill="#a86a00" stroke="#a86a00" stroke-width="12" stroke-linejoin="round"/>
     <path d="${d}" fill="url(#s)" stroke="url(#s)" stroke-width="4" stroke-linejoin="round"/>
     <ellipse cx="52" cy="44" rx="10" ry="5" fill="#fff" opacity=".7" transform="rotate(-50 52 44)"/>`,
    '0 0 128 128',
  );
}

export function checkSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<circle cx="32" cy="32" r="28" fill="#5ccf5f" stroke="#1f6b2d" stroke-width="5"/>
     <path d="M18 33 L28 43 L47 22" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
    '0 0 64 64',
  );
}

/** Öğretici eli: işaret parmağı yukarıda (parmak ucu dokunulan noktadır). */
export function handSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<g stroke="#2b3a4a" stroke-width="5" stroke-linejoin="round">
       <rect x="46" y="6" width="22" height="62" rx="11" fill="#ffffff"/>
       <rect x="66" y="44" width="18" height="34" rx="9" fill="#f4f6f8"/>
       <rect x="82" y="50" width="16" height="32" rx="8" fill="#f4f6f8"/>
       <path d="M36 60 Q22 66 26 84 L40 96 Z" fill="#ffffff"/>
       <rect x="34" y="56" width="62" height="52" rx="20" fill="#ffffff"/>
       <rect x="40" y="102" width="52" height="20" rx="7" fill="#3b82f6"/>
     </g>
     <path d="M52 16 V40" stroke="#dfe6ee" stroke-width="5" stroke-linecap="round"/>`,
    '0 0 128 128',
  );
}

export function closeIconSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<circle cx="48" cy="52" r="40" fill="#06263d" opacity=".3"/>
     <circle cx="48" cy="48" r="40" fill="#e74c3c" stroke="#7b241c" stroke-width="6"/>
     <ellipse cx="38" cy="30" rx="14" ry="7" fill="#fff" opacity=".3"/>
     <path d="M34 34 L62 62 M62 34 L34 62" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`,
    '0 0 96 96',
  );
}

export function lockIconSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<path d="M20 30 V22 Q20 8 32 8 Q44 8 44 22 V30" fill="none" stroke="#7f8c8d" stroke-width="7"/>
     <rect x="12" y="28" width="40" height="30" rx="7" fill="#bdc3c7" stroke="#5d6d7e" stroke-width="4"/>
     <circle cx="32" cy="42" r="5" fill="#5d6d7e"/>`,
    '0 0 64 64',
  );
}

export function pauseIconSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<circle cx="48" cy="52" r="42" fill="#06263d" opacity=".3"/>
     <circle cx="48" cy="48" r="42" fill="#2e86de" stroke="#0d4466" stroke-width="6"/>
     <ellipse cx="36" cy="28" rx="16" ry="8" fill="#fff" opacity=".3"/>
     <rect x="32" y="30" width="11" height="36" rx="4" fill="#fff"/>
     <rect x="53" y="30" width="11" height="36" rx="4" fill="#fff"/>`,
    '0 0 96 96',
  );
}
