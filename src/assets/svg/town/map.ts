import type { RegionId } from '../../../meta/town';
import { svgDoc, verticalGradient } from '../svgUtils';
import { INK, STAGE } from './common';

/**
 * Liman haritası (ana ekran): bölgeler denizdeki adacıklar üzerinde, kıvrılan bir rotayla bağlı.
 * Bölge sahnesiyle aynı alanda (1000x820) çizilir. Düğüm konumları burada; harita görünümü
 * (src/ui/home/TownMapView.ts) rotayı ve düğümleri bu noktalara göre yerleştirir.
 */
export const MAP_NODES: Readonly<Record<RegionId, { readonly x: number; readonly y: number }>> = {
  lighthouse: { x: 190, y: 650 },
  pier: { x: 490, y: 615 },
  fishShop: { x: 800, y: 480 },
  cafe: { x: 510, y: 335 },
  ship: { x: 215, y: 175 },
};

function island(x: number, y: number, rx: number, ry: number, seed: number): string {
  const palms = seed % 2 === 0
    ? `<path d="M${x + rx * 0.55} ${y - ry * 0.2} q6 -40 -4 -66" stroke="#8b5a2b" stroke-width="7" fill="none" stroke-linecap="round"/>
       <path d="M${x + rx * 0.55 - 4} ${y - ry * 0.2 - 66} q-30 -6 -44 14 M${x + rx * 0.55 - 4} ${y - ry * 0.2 - 66} q24 -14 46 2 M${x + rx * 0.55 - 4} ${y - ry * 0.2 - 66} q-4 -26 -26 -34"
         stroke="#3fae4f" stroke-width="9" fill="none" stroke-linecap="round"/>`
    : `<circle cx="${x - rx * 0.6}" cy="${y - ry * 0.35}" r="16" fill="#3fae4f" stroke="${INK}" stroke-width="3"/>
       <circle cx="${x - rx * 0.4}" cy="${y - ry * 0.45}" r="12" fill="#56c464" stroke="${INK}" stroke-width="3"/>`;
  return `
    <ellipse cx="${x}" cy="${y + 10}" rx="${rx + 22}" ry="${ry + 14}" fill="#8fe0f5" opacity=".7"/>
    <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#f4dca2" stroke="#c9a462" stroke-width="5"/>
    <ellipse cx="${x - rx * 0.15}" cy="${y - ry * 0.18}" rx="${rx * 0.72}" ry="${ry * 0.55}" fill="#8ccf6a" opacity=".85"/>
    ${palms}`;
}

function compass(x: number, y: number): string {
  return `<g transform="translate(${x} ${y})" opacity=".85">
    <circle r="52" fill="#fffaf0" stroke="${INK}" stroke-width="4"/>
    <circle r="40" fill="none" stroke="#d9a066" stroke-width="2" stroke-dasharray="3 7"/>
    <path d="M0 -46 L10 0 L0 46 L-10 0 Z" fill="#e74c3c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M-46 0 L0 -10 L46 0 L0 10 Z" fill="#2e86de" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <circle r="7" fill="#ffcb3d" stroke="${INK}" stroke-width="3"/>
    <text y="-58" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="26" font-weight="700" fill="${INK}">K</text>
  </g>`;
}

/** Haritanın zemini: deniz, adacıklar, dalgalar, pusula. */
export function townMapSvg(): string {
  const waves = Array.from({ length: 16 }, (_, i) => {
    const x = (i * 263) % 900 + 30;
    const y = 40 + ((i * 151) % 740);
    return `<path d="M${x} ${y} q18 -10 36 0 q18 10 36 0" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".35"/>`;
  }).join('');
  const islands = Object.values(MAP_NODES)
    .map((p, i) => island(p.x, p.y + 30, 110, 46, i))
    .join('');
  return svgDoc(
    STAGE.width,
    STAGE.height,
    `<defs>${verticalGradient('chart', [[0, '#4fb9e3'], [1, '#2b8fc4']])}</defs>
     <rect width="${STAGE.width}" height="${STAGE.height}" fill="url(#chart)"/>
     <rect x="12" y="12" width="${STAGE.width - 24}" height="${STAGE.height - 24}" rx="18" fill="none" stroke="#ffffff" stroke-width="3" opacity=".35" stroke-dasharray="14 10"/>
     ${waves}
     <ellipse cx="880" cy="760" rx="60" ry="22" fill="#8a9aa6" stroke="${INK}" stroke-width="3"/>
     <ellipse cx="70" cy="380" rx="34" ry="14" fill="#8a9aa6" stroke="${INK}" stroke-width="3"/>
     ${islands}
     ${compass(880, 140)}`,
    `0 0 ${STAGE.width} ${STAGE.height}`,
  );
}

const ICONS: Record<RegionId, () => string> = {
  lighthouse: () => `
    <path d="M30 140 Q80 112 130 140 Z" fill="#9aa5b4" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M58 128 L66 54 H94 L102 128 Z" fill="#ffffff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M62 100 H98 L100 116 H60 Z M64 74 H96 L97 88 H63 Z" fill="#e74c3c"/>
    <rect x="62" y="34" width="36" height="22" rx="4" fill="#ffd84d" stroke="${INK}" stroke-width="5"/>
    <path d="M58 34 L80 14 L102 34 Z" fill="#e74c3c" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M100 44 L146 30 V58 Z M60 44 L14 30 V58 Z" fill="#fff3a0" opacity=".7"/>`,
  pier: () => `
    <path d="M10 112 Q40 102 70 112 T130 112 T160 110" stroke="#ffffff" stroke-width="5" fill="none" opacity=".8"/>
    <rect x="18" y="78" width="124" height="22" rx="5" fill="#c98a4b" stroke="${INK}" stroke-width="5"/>
    <path d="M48 78 V100 M78 78 V100 M108 78 V100" stroke="${INK}" stroke-width="3"/>
    <rect x="30" y="98" width="12" height="34" fill="#8b5a2b" stroke="${INK}" stroke-width="4"/>
    <rect x="118" y="98" width="12" height="34" fill="#8b5a2b" stroke="${INK}" stroke-width="4"/>
    <rect x="124" y="50" width="12" height="30" rx="4" fill="#8b5a2b" stroke="${INK}" stroke-width="4"/>
    <path d="M46 70 H96 L88 56 H54 Z" fill="#e74c3c" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M70 56 V24 L94 50 Z" fill="#fffaf0" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  fishShop: () => `
    <rect x="28" y="64" width="104" height="72" rx="6" fill="#fbe3c4" stroke="${INK}" stroke-width="5"/>
    <path d="M18 66 L36 34 H124 L142 66 Z" fill="#2e86de" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M52 34 L44 66 M80 34 V66 M108 34 L116 66" stroke="#ffffff" stroke-width="6"/>
    <rect x="66" y="96" width="28" height="40" fill="#a0632e" stroke="${INK}" stroke-width="4"/>
    <g transform="translate(80 18)">
      <path d="M-24 0 Q-6 -16 14 0 Q-6 16 -24 0 Z" fill="#ff9f43" stroke="${INK}" stroke-width="4"/>
      <path d="M14 0 L28 -12 V12 Z" fill="#ff9f43" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="-12" cy="-2" r="3" fill="${INK}"/>
    </g>`,
  cafe: () => `
    <path d="M40 28 q-8 -12 0 -22 M64 26 q-8 -12 0 -22 M88 28 q-8 -12 0 -22" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>
    <path d="M26 46 H110 V100 Q110 132 68 132 Q26 132 26 100 Z" fill="#ffffff" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M110 60 Q140 60 140 84 Q140 106 110 104" fill="none" stroke="${INK}" stroke-width="8"/>
    <path d="M110 60 Q140 60 140 84 Q140 106 110 104" fill="none" stroke="#ffffff" stroke-width="3"/>
    <rect x="26" y="64" width="84" height="16" fill="#e74c3c"/>
    <path d="M42 108 Q68 120 94 108" stroke="#d9a066" stroke-width="4" fill="none"/>
    <ellipse cx="68" cy="144" rx="56" ry="8" fill="#000" opacity=".15"/>`,
  ship: () => `
    <path d="M10 130 Q40 120 70 130 T130 130 T160 128" stroke="#ffffff" stroke-width="5" fill="none" opacity=".8"/>
    <path d="M18 98 H142 L124 128 H36 Z" fill="#a0632e" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="60" cy="112" r="5" fill="#ffd84d"/><circle cx="82" cy="112" r="5" fill="#ffd84d"/><circle cx="104" cy="112" r="5" fill="#ffd84d"/>
    <path d="M80 98 V14" stroke="${INK}" stroke-width="6"/>
    <path d="M84 20 Q130 50 84 90 Z" fill="#fffaf0" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M76 30 Q40 58 76 90 Z" fill="#fffaf0" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M80 14 L104 20 L80 26 Z" fill="#e74c3c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
};

/** Haritadaki bölge simgesi (160x160). */
export function regionIconSvg(region: RegionId, size: number): string {
  return svgDoc(size, size, ICONS[region](), '0 0 160 160');
}
