import type { ItemId } from '../../config/economy';
import { cannonIcon, harpoonIcon, whirlpool } from './specials';
import { polar, svgDoc, verticalGradient } from './svgUtils';

const INK = '#2b3a4a';
const WOOD = '#C98A4B';
const WOOD_DARK = '#4a2a0c';

/** Kürek: ahşap sap, metal ağız (çapraz). */
function shovel(): string {
  return `
    <g transform="rotate(40 64 64)">
      <rect x="46" y="4" width="36" height="13" rx="6" fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="5"/>
      <rect x="57" y="12" width="14" height="60" rx="6" fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="5"/>
      <path d="M61 18 V66" stroke="#F1C48E" stroke-width="3" stroke-linecap="round"/>
      <path d="M42 72 H86 V92 Q86 116 64 124 Q42 116 42 92 Z" fill="#C3CED9" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M51 79 V94 Q51 106 60 113" stroke="#fff" stroke-width="5" fill="none" opacity=".75" stroke-linecap="round"/>
      <rect x="53" y="64" width="22" height="13" rx="4" fill="#8395a7" stroke="${INK}" stroke-width="4"/>
    </g>`;
}

/** Dümen: sekiz kollu gemi dümeni. */
function helm(): string {
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const [x, y] = polar(64, 64, 52, i * 45);
    const [hx, hy] = polar(64, 64, 57, i * 45);
    return `<path d="M64 64 L${x} ${y}" stroke="${WOOD_DARK}" stroke-width="13" stroke-linecap="round"/>
      <path d="M64 64 L${x} ${y}" stroke="${WOOD}" stroke-width="6" stroke-linecap="round"/>
      <circle cx="${hx}" cy="${hy}" r="7.5" fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="4"/>`;
  }).join('');
  return `
    ${spokes}
    <circle cx="64" cy="64" r="38" fill="none" stroke="${WOOD_DARK}" stroke-width="17"/>
    <circle cx="64" cy="64" r="38" fill="none" stroke="${WOOD}" stroke-width="9"/>
    <path d="M38 44 A32 32 0 0 1 70 28" fill="none" stroke="#F1C48E" stroke-width="3" stroke-linecap="round"/>
    <circle cx="64" cy="64" r="14" fill="#E0A060" stroke="${WOOD_DARK}" stroke-width="5"/>
    <circle cx="64" cy="64" r="5" fill="#FFD23F"/>`;
}

/** Fırtına: kara bulut, şimşek, yağmur. */
function storm(): string {
  return `
    <defs>${verticalGradient('cloud', [[0, '#8d9bab'], [1, '#56616f']])}</defs>
    <path d="M34 86 L28 100 M54 88 L48 104 M98 86 L92 100" stroke="#5dade2" stroke-width="6" stroke-linecap="round"/>
    <path d="M30 76 Q10 76 12 58 Q14 42 32 44 Q36 20 60 20 Q82 20 88 38 Q108 34 114 52 Q120 76 96 76 Z"
      fill="url(#cloud)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M30 52 Q32 44 42 46 M58 30 Q72 28 78 38" stroke="#fff" stroke-width="4" fill="none" opacity=".5" stroke-linecap="round"/>
    <path d="M68 56 L50 90 H64 L56 122 L88 80 H72 L82 56 Z" fill="#FFD23F" stroke="#B26A00" stroke-width="4" stroke-linejoin="round"/>
    <path d="M70 62 L58 84" stroke="#fff6c2" stroke-width="3" stroke-linecap="round"/>`;
}

/** Eşya simgesi (yardımcı ya da bölüm öncesi güçlendirici), arka plansız. */
export function itemSvg(id: ItemId, size: number): string {
  const body =
    id === 'shovel'
      ? shovel()
      : id === 'helm'
        ? helm()
        : id === 'storm'
          ? storm()
          : id === 'harpoon'
            ? `<g transform="rotate(-45 64 62) scale(1)">${harpoonIcon(false)}</g>`
            : id === 'cannon'
              ? cannonIcon()
              : whirlpool();
  return svgDoc(size, size, body, '0 0 128 128');
}

export function heartSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<defs>${verticalGradient('h', [[0, '#ff6b81'], [1, '#d62839']])}</defs>
     <path d="M64 116 C22 88 8 64 14 42 C20 18 48 14 64 38 C80 14 108 18 114 42 C120 64 106 88 64 116 Z"
       fill="url(#h)" stroke="#7b1d1d" stroke-width="7" stroke-linejoin="round"/>
     <ellipse cx="38" cy="42" rx="12" ry="7" fill="#fff" opacity=".55" transform="rotate(-35 38 42)"/>`,
    '0 0 128 128',
  );
}

export function gearSvg(size: number): string {
  const teeth = Array.from(
    { length: 8 },
    (_, i) => `<rect x="53" y="6" width="22" height="30" rx="6" transform="rotate(${i * 45} 64 64)"/>`,
  ).join('');
  return svgDoc(
    size,
    size,
    `<g fill="#9fb3c8" stroke="${INK}" stroke-width="6">${teeth}<circle cx="64" cy="64" r="40"/></g>
     <circle cx="64" cy="64" r="40" fill="#b8c9da"/>
     <circle cx="64" cy="64" r="17" fill="#3d5a73" stroke="${INK}" stroke-width="6"/>
     <path d="M40 46 A30 30 0 0 1 62 34" stroke="#fff" stroke-width="5" fill="none" opacity=".6" stroke-linecap="round"/>`,
    '0 0 128 128',
  );
}

/** Mağaza: içinde altın olan alışveriş çantası. */
export function shopSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<defs>${verticalGradient('bag', [[0, '#b366d6'], [1, '#7d3c98']])}</defs>
     <path d="M44 48 V36 Q44 16 64 16 Q84 16 84 36 V48" fill="none" stroke="#4a235a" stroke-width="8" stroke-linecap="round"/>
     <path d="M20 44 H108 L102 116 Q101 122 95 122 H33 Q27 122 26 116 Z" fill="url(#bag)" stroke="#4a235a" stroke-width="6" stroke-linejoin="round"/>
     <path d="M30 52 H98" stroke="#fff" stroke-width="4" opacity=".35" stroke-linecap="round"/>
     <circle cx="64" cy="84" r="22" fill="#FFCB3D" stroke="#8a5a00" stroke-width="5"/>
     <path d="M64 72 V96 M57 77 Q64 71 71 77 Q64 84 57 90 Q64 96 71 90" fill="none" stroke="#8a5a00" stroke-width="4" stroke-linecap="round"/>`,
    '0 0 128 128',
  );
}

/** Yeşil "+" rozeti (eşya bitince satın alma). */
export function plusBadgeSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<circle cx="32" cy="32" r="27" fill="#5ccf5f" stroke="#1f6b2d" stroke-width="5"/>
     <path d="M32 18 V46 M18 32 H46" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`,
    '0 0 64 64',
  );
}

/** Yuvarlak buton zemini (yardımcı çubuğu, ana ekran simge butonları). */
export function roundButtonSvg(size: number, active: boolean): string {
  const face = active ? '#ffe08a' : '#2a7ab0';
  const rim = active ? '#f0a000' : '#7fd6f5';
  return svgDoc(
    size,
    size,
    `<defs>${verticalGradient('rb', [[0, face], [1, active ? '#ffc94d' : '#145a85']])}</defs>
     <circle cx="64" cy="68" r="58" fill="#06263d" opacity=".35"/>
     <circle cx="64" cy="64" r="58" fill="url(#rb)" stroke="${rim}" stroke-width="7"/>
     <ellipse cx="64" cy="30" rx="34" ry="12" fill="#fff" opacity=".18"/>`,
    '0 0 128 128',
  );
}
