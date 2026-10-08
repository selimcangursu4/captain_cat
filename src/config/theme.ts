import type { ObstacleKind } from '../core/obstacles';
import type { TileColor } from '../core/types';

/** Görsel renk paleti. Taşların renkleri hem rengi hem şekliyle ayırt edilebilir olacak şekilde seçildi. */
export const TILE_PALETTE: Record<TileColor, { base: string; light: string; dark: string }> = {
  fish: { base: '#34C26A', light: '#8FF0A9', dark: '#17703A' },
  anchor: { base: '#3B82F6', light: '#93C5FD', dark: '#1E3A8A' },
  shell: { base: '#C062F0', light: '#EAB6FF', dark: '#6B2391' },
  ring: { base: '#EF4452', light: '#FF9AA2', dark: '#8E1A26' },
  star: { base: '#FFC93C', light: '#FFF0A8', dark: '#A86A00' },
};

/** Engel kırılınca saçılan kırıntının rengi. */
export const OBSTACLE_TINTS: Record<ObstacleKind, number> = {
  moss: 0x4caf50,
  net: 0xc98a4b,
  sandbag: 0xd9b679,
  chest: 0xffcb3d,
  nest: 0xa8743f,
};

export const UI_COLORS = {
  frameBorder: 0x7fd6f5,
  frameFill: 0x0d4466,
  frameAlpha: 0.92,
  buttonFill: 0xffb547,
  buttonFillPressed: 0xe8962a,
  buttonStroke: 0x8a4b14,
  buttonText: '#5a2d06',
  titleText: '#ffffff',
  titleStroke: '#0b3a5c',
  bodyText: '#e8f7ff',
  bannerText: '#fff4c2',
} as const;

export const FONT_FAMILY = 'Fredoka, "Trebuchet MS", sans-serif';

/** "#RRGGBB" → 0xRRGGBB */
export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
