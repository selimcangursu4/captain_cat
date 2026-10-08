import type { DesignTheme } from '../../../meta/town';
import { svgDoc, verticalGradient } from '../svgUtils';

/**
 * Kasaba çizimleri bölge sahnesinin koordinatlarında (1000x820) yapılır. Her parça
 * kendi kutusunu (box) bilir; dokusu yalnızca o kutuyu kapsar ve sahnede aynı yere konur.
 */
export const STAGE = { width: 1000, height: 820 } as const;
export const INK = '#3d2a1a';

/** Tasarım temalarının renkleri: her parça seçilen temanın paletiyle çizilir. */
export interface ThemePalette {
  readonly main: string;
  readonly light: string;
  readonly wood: string;
  readonly trim: string;
  readonly glass: string;
  readonly accent: string;
  readonly leaf: string;
  readonly flower: string;
  readonly wall: string;
  readonly fence: string;
}

export const THEME_PALETTES: Readonly<Record<DesignTheme, ThemePalette>> = {
  classic: {
    main: '#e74c3c', light: '#ffffff', wood: '#a0632e', trim: '#2c3e50', glass: '#ffd84d',
    accent: '#f1c40f', leaf: '#3fae4f', flower: '#ff6b81', wall: '#fbe3c4', fence: '#ffffff',
  },
  ocean: {
    main: '#2e86de', light: '#e8f8ff', wood: '#5d7f99', trim: '#1b4f72', glass: '#7ee8fa',
    accent: '#1abc9c', leaf: '#27ae60', flower: '#74b9ff', wall: '#d6f0ff', fence: '#5dade2',
  },
  sunset: {
    main: '#f39c12', light: '#fff3d6', wood: '#c0703c', trim: '#6c3483', glass: '#ff9ff3',
    accent: '#e84393', leaf: '#8bc34a', flower: '#fd79a8', wall: '#ffe0b3', fence: '#d98e4f',
  },
};

export interface PartArt {
  /** [x, y, genişlik, yükseklik] — sahne koordinatında. */
  readonly box: readonly [number, number, number, number];
  readonly draw: (p: ThemePalette) => string;
}

export interface RegionArt {
  readonly background: () => string;
  readonly parts: Readonly<Record<string, PartArt>>;
}

export function partSvg(part: PartArt, palette: ThemePalette): string {
  const [x, y, w, h] = part.box;
  return svgDoc(w, h, part.draw(palette), `${x} ${y} ${w} ${h}`);
}

export function backgroundSvg(region: RegionArt): string {
  return svgDoc(STAGE.width, STAGE.height, region.background(), `0 0 ${STAGE.width} ${STAGE.height}`);
}

// ───────────────────────── ortak sahne öğeleri ─────────────────────────

/** Gökyüzü, güneş, bulutlar ve ufka kadar deniz. */
export function skyAndSea(horizon: number, seaBottom: number = STAGE.height): string {
  const cloud = (x: number, y: number, s: number) =>
    `<g fill="#ffffff" opacity=".9" transform="translate(${x} ${y}) scale(${s})">
       <ellipse cx="0" cy="0" rx="46" ry="24"/><ellipse cx="38" cy="-12" rx="34" ry="26"/><ellipse cx="72" cy="2" rx="38" ry="20"/>
     </g>`;
  const waves = Array.from({ length: 7 }, (_, i) => {
    const y = horizon + 40 + i * 62;
    const x = (i * 173) % 800;
    return `<path d="M${x} ${y} q20 -10 40 0 q20 10 40 0" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".45"/>`;
  }).join('');
  return `
    <defs>
      ${verticalGradient('sky', [[0, '#8fdcff'], [1, '#d8f5ff']])}
      ${verticalGradient('sea', [[0, '#55c1e6'], [1, '#1f7fb3']])}
    </defs>
    <rect width="${STAGE.width}" height="${horizon}" fill="url(#sky)"/>
    <circle cx="850" cy="100" r="78" fill="#fff3a0" opacity=".35"/>
    <circle cx="850" cy="100" r="54" fill="#fff3a0"/>
    ${cloud(150, 90, 1)}${cloud(470, 60, 0.8)}${cloud(640, 150, 0.6)}
    <path d="M30 ${horizon} q60 -36 130 -20 q60 -26 110 20 Z" fill="#7fb7c9" opacity=".8"/>
    <rect y="${horizon}" width="${STAGE.width}" height="${seaBottom - horizon}" fill="url(#sea)"/>
    <path d="M0 ${horizon} H${STAGE.width}" stroke="#ffffff" stroke-width="3" opacity=".5"/>
    ${waves}`;
}

/** Kırık taş yığını (yıkıntı). */
export function rubble(x: number, y: number, w: number): string {
  const stones = Array.from({ length: Math.max(3, Math.round(w / 30)) }, (_, i) => {
    const cx = x + 15 + i * (w - 30) / Math.max(1, Math.round(w / 30) - 1);
    const r = 10 + ((i * 7) % 9);
    return `<ellipse cx="${cx.toFixed(1)}" cy="${y - r / 2}" rx="${r + 6}" ry="${r}" fill="#b8b0a4" stroke="${INK}" stroke-width="3"/>`;
  });
  return stones.join('');
}

/** Basit balık simgesi (tezgâh, tabela). */
export function fishIcon(cx: number, cy: number, color: string, s = 1): string {
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
    <path d="M14 0 L30 -12 L30 12 Z" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="0" cy="0" rx="20" ry="12" fill="${color}" stroke="${INK}" stroke-width="3"/>
    <circle cx="-9" cy="-3" r="3" fill="${INK}"/>
  </g>`;
}

/** Çapa simgesi (iskele tabelası). */
export function anchorIcon(cx: number, cy: number, color: string, s = 1): string {
  return `<g transform="translate(${cx} ${cy}) scale(${s})" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round">
    <circle cx="0" cy="-22" r="7"/><path d="M0 -15 V24 M-14 -6 H14 M-22 8 Q-20 26 0 26 Q20 26 22 8"/>
  </g>`;
}
