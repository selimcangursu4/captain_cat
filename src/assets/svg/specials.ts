import { TILE_PALETTE } from '../../config/theme';
import { TILE_COLORS, type SpecialKind, type TileColor } from '../../core/types';
import { svgDoc } from './svgUtils';

/**
 * Güçlendirici taşlar: taşın renginde parlak bir disk + üzerinde güçlendiricinin simgesi.
 * Disk rengi, taşın hangi renkle eşleşebileceğini gösterir. Girdap renksizdir.
 */
type Palette = (typeof TILE_PALETTE)[TileColor];

const SHADOW = `<ellipse cx="64" cy="115" rx="38" ry="7" fill="#06263d" opacity=".22"/>`;
const OUTLINE = '#1d2433';

function disk(p: Palette): string {
  return `
    <defs>
      <radialGradient id="disk" cx="38%" cy="32%" r="75%">
        <stop offset="0" stop-color="${p.light}"/><stop offset=".55" stop-color="${p.base}"/><stop offset="1" stop-color="${p.dark}"/>
      </radialGradient>
    </defs>
    ${SHADOW}
    <circle cx="64" cy="62" r="50" fill="url(#disk)" stroke="${p.dark}" stroke-width="5"/>
    <circle cx="64" cy="62" r="42" fill="none" stroke="#fff" stroke-width="3" opacity=".35"/>
    <ellipse cx="44" cy="34" rx="16" ry="8" fill="#fff" opacity=".4" transform="rotate(-30 44 34)"/>`;
}

/** Çift uçlu zıpkın: iki yöne birden temizlediğini anlatır. */
export function harpoonIcon(vertical: boolean): string {
  return `
    <g${vertical ? ' transform="rotate(90 64 62)"' : ''}>
      <path d="M26 62 H102" stroke="${OUTLINE}" stroke-width="15" stroke-linecap="round"/>
      <path d="M98 44 L124 62 L98 80 Z" fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="7" stroke-linejoin="round"/>
      <path d="M30 44 L4 62 L30 80 Z" fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="7" stroke-linejoin="round"/>
      <path d="M26 62 H102" stroke="#C98A4B" stroke-width="7" stroke-linecap="round"/>
      <path d="M30 59.5 H98" stroke="#F1C48E" stroke-width="2" stroke-linecap="round"/>
      <path d="M52 56 V68 M58 56 V68 M70 56 V68 M76 56 V68" stroke="#7a4a1c" stroke-width="2.5"/>
      <path d="M98 47 L120 62 L98 77 Z" fill="#EEF3F8"/>
      <path d="M30 47 L8 62 L30 77 Z" fill="#EEF3F8"/>
      <path d="M101 53 L112 60 M27 53 L16 60" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
    </g>`;
}

export function cannonIcon(): string {
  return `
    <defs>
      <radialGradient id="ball" cx="35%" cy="30%" r="75%">
        <stop offset="0" stop-color="#7d8899"/><stop offset=".5" stop-color="#3a4352"/><stop offset="1" stop-color="#161b24"/>
      </radialGradient>
    </defs>
    <circle cx="61" cy="68" r="31" fill="url(#ball)" stroke="#0f141c" stroke-width="5"/>
    <ellipse cx="50" cy="55" rx="10" ry="6" fill="#fff" opacity=".45" transform="rotate(-30 50 55)"/>
    <rect x="74" y="34" width="17" height="13" rx="3" fill="#3a4352" stroke="#0f141c" stroke-width="4" transform="rotate(40 82 41)"/>
    <path d="M87 33 Q92 21 103 20" fill="none" stroke="#8B5A2B" stroke-width="5" stroke-linecap="round"/>
    <path d="M106 8 L109 15 L116 16 L110 20 L112 27 L106 23 L100 27 L102 20 L96 16 L103 15 Z"
      fill="#FFD23F" stroke="#FF7A00" stroke-width="2" stroke-linejoin="round"/>`;
}

function seagullBody(): string {
  return `
    <g stroke="#2b3a4a" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
      <path d="M56 66 Q40 32 16 28 Q30 48 44 72 Z" fill="#dfe7ee"/>
      <path d="M60 66 Q66 30 94 18 Q86 46 80 70 Z" fill="#fff"/>
      <path d="M40 76 L20 66 L22 88 Z" fill="#fff"/>
      <ellipse cx="62" cy="76" rx="28" ry="16" fill="#fff"/>
      <circle cx="90" cy="64" r="13" fill="#fff"/>
      <path d="M100 60 L118 66 L100 71 Z" fill="#FFB020"/>
    </g>
    <path d="M86 24 Q82 36 80 46" stroke="#9fb0c0" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="93" cy="61" r="2.8" fill="#1b2433"/>
    <ellipse cx="86" cy="70" rx="4" ry="2.5" fill="#ff8fa3" opacity=".6"/>`;
}

export function whirlpool(): string {
  const arms = TILE_COLORS.map(
    (color, i) =>
      `<path d="M64 62 C64 44 80 32 100 36" transform="rotate(${i * 72} 64 62)" fill="none"
        stroke="${TILE_PALETTE[color].base}" stroke-width="9" stroke-linecap="round"/>`,
  ).join('');
  const thin = TILE_COLORS.map(
    (_, i) =>
      `<path d="M64 62 C66 50 76 42 88 42" transform="rotate(${i * 72 + 36} 64 62)" fill="none"
        stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>`,
  ).join('');
  return `
    <defs>
      <radialGradient id="w" cx="50%" cy="50%" r="60%">
        <stop offset="0" stop-color="#2a5bd7"/><stop offset=".6" stop-color="#173a8f"/><stop offset="1" stop-color="#0b1e4f"/>
      </radialGradient>
    </defs>
    ${SHADOW}
    <circle cx="64" cy="62" r="50" fill="url(#w)" stroke="#081536" stroke-width="5"/>
    ${arms}${thin}
    <circle cx="64" cy="62" r="10" fill="#fff"/>
    <circle cx="64" cy="62" r="16" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>
    <circle cx="36" cy="30" r="3" fill="#fff" opacity=".8"/>
    <circle cx="96" cy="94" r="2.5" fill="#fff" opacity=".7"/>`;
}

export function specialSvg(special: SpecialKind, color: TileColor, size: number): string {
  if (special === 'whirlpool') return svgDoc(size, size, whirlpool(), '0 0 128 128');
  const icon =
    special === 'harpoon-h'
      ? harpoonIcon(false)
      : special === 'harpoon-v'
        ? harpoonIcon(true)
        : special === 'cannon'
          ? cannonIcon()
          : seagullBody();
  return svgDoc(size, size, disk(TILE_PALETTE[color]) + icon, '0 0 128 128');
}

// ───────────────────────── efekt dokuları ─────────────────────────

/** Fırlatılan zıpkın (sağa bakar; yön için döndürülür) ve arkasındaki ışık izi. */
export function harpoonProjectileSvg(width: number, height: number): string {
  return svgDoc(
    width,
    height,
    `<defs>
       <linearGradient id="t" x1="0" y1="0" x2="1" y2="0">
         <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".85"/>
       </linearGradient>
     </defs>
     <rect x="0" y="15" width="112" height="18" rx="9" fill="url(#t)"/>
     <path d="M44 24 H130" stroke="${OUTLINE}" stroke-width="12" stroke-linecap="round"/>
     <path d="M126 8 L156 24 L126 40 Z" fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="6" stroke-linejoin="round"/>
     <path d="M44 24 H130" stroke="#C98A4B" stroke-width="6" stroke-linecap="round"/>
     <path d="M126 11 L151 24 L126 37 Z" fill="#EEF3F8"/>`,
    '0 0 160 48',
  );
}

/** Şok dalgası halkası (tint ile renklendirilir). */
export function ringSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<circle cx="64" cy="64" r="56" fill="none" stroke="#fff" stroke-width="10"/>
     <circle cx="64" cy="64" r="46" fill="none" stroke="#fff" stroke-width="4" opacity=".5"/>`,
    '0 0 128 128',
  );
}

/** Girdap ışını: ortası parlak, kenarları saydam şerit (uzunluğuna gerilir). */
export function beamSvg(width: number, height: number): string {
  return svgDoc(
    width,
    height,
    `<defs>
       <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="1"/>
         <stop offset="1" stop-color="#fff" stop-opacity="0"/>
       </linearGradient>
     </defs>
     <rect width="64" height="24" fill="url(#b)"/>`,
    '0 0 64 24',
  );
}

/** Uçan martı (efekt). */
export function flyingSeagullSvg(size: number): string {
  return svgDoc(size, size, seagullBody(), '0 0 128 128');
}
