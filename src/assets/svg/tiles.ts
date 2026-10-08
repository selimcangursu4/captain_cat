import { TILE_PALETTE } from '../../config/theme';
import type { TileColor } from '../../core/types';
import { polar, svgDoc, verticalGradient } from './svgUtils';

/**
 * Taş çizimleri (128x128 çizim alanı). Her taş hem rengi hem silueti ile
 * ayırt edilir — renk körü oyuncular için de okunaklı.
 */
type Palette = (typeof TILE_PALETTE)[TileColor];

const SHADOW = `<ellipse cx="64" cy="115" rx="38" ry="7" fill="#06263d" opacity=".22"/>`;

function fish(p: Palette): string {
  return `
    <defs>${verticalGradient('body', [[0, p.light], [0.55, p.base], [1, p.dark]])}</defs>
    ${SHADOW}
    <path d="M86 64 L118 36 Q128 64 118 92 Z" fill="${p.base}" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M40 42 Q58 14 82 40 Z" fill="${p.base}" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M50 92 Q58 110 74 94 Z" fill="${p.base}" stroke="${p.dark}" stroke-width="4.5" stroke-linejoin="round"/>
    <ellipse cx="56" cy="65" rx="45" ry="33" fill="url(#body)" stroke="${p.dark}" stroke-width="5"/>
    <path d="M74 40 Q84 65 74 90" fill="none" stroke="${p.dark}" stroke-width="4" stroke-linecap="round" opacity=".35"/>
    <path d="M87 47 Q93 65 87 83" fill="none" stroke="${p.dark}" stroke-width="4" stroke-linecap="round" opacity=".3"/>
    <ellipse cx="52" cy="46" rx="20" ry="7" fill="#fff" opacity=".55" transform="rotate(-12 52 46)"/>
    <circle cx="33" cy="60" r="11" fill="#fff" stroke="${p.dark}" stroke-width="3"/>
    <circle cx="30" cy="61" r="6" fill="#1b2433"/>
    <circle cx="28" cy="58" r="2.2" fill="#fff"/>
    <ellipse cx="36" cy="81" rx="6" ry="3.5" fill="#ff7aa8" opacity=".55"/>
    <path d="M15 72 Q20 79 27 75" fill="none" stroke="${p.dark}" stroke-width="3.5" stroke-linecap="round"/>`;
}

function anchor(p: Palette): string {
  // İki geçiş: önce kalın koyu kontur, sonra renkli dolgu → tek parça görünen dış hat.
  const parts = (color: string, extra: number) => `
    <circle cx="64" cy="22" r="11" fill="none" stroke="${color}" stroke-width="${9 + extra}"/>
    <path d="M64 33 V104" fill="none" stroke="${color}" stroke-width="${14 + extra}" stroke-linecap="round"/>
    <path d="M40 48 H88" fill="none" stroke="${color}" stroke-width="${12 + extra}" stroke-linecap="round"/>
    <path d="M24 70 Q26 108 64 108 Q102 108 104 70" fill="none" stroke="${color}" stroke-width="${13 + extra}" stroke-linecap="round"/>
    <path d="M12 78 L24 58 L36 76 Z" fill="${color}" stroke="${color}" stroke-width="${4 + extra}" stroke-linejoin="round"/>
    <path d="M92 76 L104 58 L116 78 Z" fill="${color}" stroke="${color}" stroke-width="${4 + extra}" stroke-linejoin="round"/>`;
  return `
    <defs>
      <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="118">
        <stop offset="0" stop-color="${p.light}"/><stop offset=".45" stop-color="${p.base}"/><stop offset="1" stop-color="${p.dark}"/>
      </linearGradient>
    </defs>
    ${SHADOW}
    ${parts(p.dark, 9)}
    ${parts('url(#g)', 0)}
    <path d="M59.5 42 V96" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".5"/>
    <path d="M30 78 Q34 100 54 104" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".45"/>
    <circle cx="57" cy="17" r="3" fill="#fff" opacity=".65"/>`;
}

function shell(p: Palette): string {
  // Yelpaze şekli: üst kenar 5 dilimli tırtıklı yay.
  const cx = 64;
  const cy = 72;
  const r = 50;
  const bulge = 60;
  const angles = [198, 226, 254, 286, 314, 342];
  let d = `M64 112 L${polar(cx, cy, r, angles[0]).join(' ')}`;
  for (let i = 0; i < angles.length - 1; i++) {
    const mid = (angles[i] + angles[i + 1]) / 2;
    d += ` Q${polar(cx, cy, bulge, mid).join(' ')} ${polar(cx, cy, r, angles[i + 1]).join(' ')}`;
  }
  d += ' Z';
  const ridges = angles
    .slice(1, -1)
    .map((a) => {
      const [x, y] = polar(cx, cy, r - 3, a);
      return `<path d="M64 106 L${x} ${y}" stroke="${p.dark}" stroke-width="4" stroke-linecap="round" opacity=".35"/>`;
    })
    .join('');
  return `
    <defs>
      <radialGradient id="g" cx="50%" cy="25%" r="80%">
        <stop offset="0" stop-color="${p.light}"/><stop offset=".55" stop-color="${p.base}"/><stop offset="1" stop-color="${p.dark}"/>
      </radialGradient>
    </defs>
    ${SHADOW}
    <path d="${d}" fill="url(#g)" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
    ${ridges}
    <path d="M46 104 Q64 96 82 104 L76 120 Q64 125 52 120 Z" fill="${p.base}" stroke="${p.dark}" stroke-width="4.5" stroke-linejoin="round"/>
    <ellipse cx="44" cy="44" rx="14" ry="6" fill="#fff" opacity=".55" transform="rotate(-35 44 44)"/>
    <circle cx="80" cy="34" r="3.5" fill="#fff" opacity=".5"/>`;
}

function ring(p: Palette): string {
  // Can simidi: kalın halka + 4 beyaz bant (çaprazlarda).
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const band = 21;
  const gap = circumference / 4 - band;
  const offset = band / 2 - circumference / 8;
  return `
    <defs>
      ${verticalGradient('g', [[0, p.light], [0.5, p.base], [1, p.dark]])}
      ${verticalGradient('w', [[0, '#ffffff'], [1, '#d6dbe6']])}
    </defs>
    ${SHADOW}
    <circle cx="64" cy="62" r="${radius}" fill="none" stroke="${p.dark}" stroke-width="35"/>
    <circle cx="64" cy="62" r="${radius}" fill="none" stroke="url(#g)" stroke-width="26"/>
    <circle cx="64" cy="62" r="${radius}" fill="none" stroke="url(#w)" stroke-width="26"
      stroke-dasharray="${band.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"/>
    <circle cx="64" cy="62" r="21" fill="none" stroke="${p.dark}" stroke-width="3" opacity=".35"/>
    <path d="M38 44 A31.6 31.6 0 0 1 56 33" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".6"/>`;
}

function star(p: Palette): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    points.push(polar(64, 68, i % 2 === 0 ? 52 : 25, -90 + i * 36).join(' '));
  }
  const d = `M${points.join(' L')} Z`;
  const face = '#4a2a00';
  return `
    <defs>
      <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="14" x2="0" y2="116">
        <stop offset="0" stop-color="${p.light}"/><stop offset=".5" stop-color="${p.base}"/><stop offset="1" stop-color="${p.dark}"/>
      </linearGradient>
    </defs>
    ${SHADOW}
    <path d="${d}" fill="${p.dark}" stroke="${p.dark}" stroke-width="13" stroke-linejoin="round"/>
    <path d="${d}" fill="url(#g)" stroke="url(#g)" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="57" cy="40" rx="7" ry="4" fill="#fff" opacity=".65" transform="rotate(-60 57 40)"/>
    <ellipse cx="55" cy="66" rx="4.5" ry="6.5" fill="${face}"/>
    <ellipse cx="73" cy="66" rx="4.5" ry="6.5" fill="${face}"/>
    <circle cx="53.5" cy="63.5" r="1.8" fill="#fff"/>
    <circle cx="71.5" cy="63.5" r="1.8" fill="#fff"/>
    <ellipse cx="45" cy="78" rx="6" ry="3.5" fill="#ff7a59" opacity=".5"/>
    <ellipse cx="83" cy="78" rx="6" ry="3.5" fill="#ff7a59" opacity=".5"/>
    <path d="M57 79 Q64 86 71 79" fill="none" stroke="${face}" stroke-width="3.5" stroke-linecap="round"/>`;
}

const DRAWERS: Record<TileColor, (p: Palette) => string> = { fish, anchor, shell, ring, star };

export function tileSvg(color: TileColor, size: number): string {
  return svgDoc(size, size, DRAWERS[color](TILE_PALETTE[color]), '0 0 128 128');
}
