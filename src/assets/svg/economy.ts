import type { ChestId, MaterialId, ShipUpgradeId } from '../../config/economy';
import { svgDoc, verticalGradient } from './svgUtils';

/** Ekonomi simgeleri: malzemeler, Pazar, inşaat, gemi yükseltmeleri, sandık çeşitleri (128x128 çizim alanı). */

const INK = '#2b3a4a';
const WOOD_DARK = '#4a2a0c';
const VIEW = '0 0 128 128';

function wood(): string {
  const log = (cx: number, cy: number) => `
    <circle cx="${cx}" cy="${cy}" r="24" fill="url(#end)" stroke="#6b3e17" stroke-width="5"/>
    <circle cx="${cx}" cy="${cy}" r="14" fill="none" stroke="#b07840" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="#b07840" stroke-width="3"/>
    <path d="M${cx - 14} ${cy - 14} Q${cx - 6} ${cy - 20} ${cx + 4} ${cy - 18}" stroke="#fff" stroke-width="3" fill="none" opacity=".45" stroke-linecap="round"/>`;
  return `<defs>${verticalGradient('end', [[0, '#f1c48e'], [1, '#d59a5a']])}</defs>
    <ellipse cx="64" cy="112" rx="50" ry="8" fill="#000" opacity=".15"/>
    ${log(40, 86)}${log(88, 86)}${log(64, 46)}`;
}

function stone(): string {
  return `<defs>
      ${verticalGradient('r1', [[0, '#c7d0d9'], [1, '#8696a6']])}
      ${verticalGradient('r2', [[0, '#b3bec9'], [1, '#76869a']])}
    </defs>
    <ellipse cx="64" cy="112" rx="52" ry="8" fill="#000" opacity=".15"/>
    <path d="M14 104 L22 66 L52 52 L72 70 L68 106 Z" fill="url(#r1)" stroke="#3d4a56" stroke-width="5" stroke-linejoin="round"/>
    <path d="M58 108 L64 62 L94 44 L116 66 L110 104 Z" fill="url(#r2)" stroke="#3d4a56" stroke-width="5" stroke-linejoin="round"/>
    <path d="M28 70 L48 60" stroke="#fff" stroke-width="4" opacity=".55" stroke-linecap="round"/>
    <path d="M72 64 L92 52" stroke="#fff" stroke-width="4" opacity=".55" stroke-linecap="round"/>
    <path d="M80 80 L92 86 M34 86 L46 92" stroke="#5d6d7e" stroke-width="3" opacity=".6" stroke-linecap="round"/>`;
}

function nails(): string {
  const nail = (cx: number, top: number, angle: number) => `
    <g transform="rotate(${angle} ${cx} ${top + 45})">
      <path d="M${cx - 5} ${top + 9} H${cx + 5} V${top + 74} L${cx} ${top + 90} L${cx - 5} ${top + 74} Z"
        fill="#a9b6c3" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <rect x="${cx - 14}" y="${top}" width="28" height="10" rx="4" fill="#dfe6ec" stroke="${INK}" stroke-width="4"/>
      <path d="M${cx - 1} ${top + 16} V${top + 66}" stroke="#fff" stroke-width="2.5" opacity=".7" stroke-linecap="round"/>
    </g>`;
  return `${nail(38, 18, -18)}${nail(64, 10, 0)}${nail(90, 18, 18)}`;
}

function rope(): string {
  const twists = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const x = 64 + Math.cos(a) * 43;
    const y = 72 + Math.sin(a) * 30;
    return `<path d="M${(x - 4).toFixed(1)} ${(y - 4).toFixed(1)} L${(x + 4).toFixed(1)} ${(y + 4).toFixed(1)}" stroke="#8a6a2f" stroke-width="3" stroke-linecap="round"/>`;
  }).join('');
  return `<ellipse cx="64" cy="112" rx="50" ry="8" fill="#000" opacity=".15"/>
    <path d="M100 86 Q122 100 106 118" stroke="#6b4a1f" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M100 86 Q122 100 106 118" stroke="#d9b27a" stroke-width="9" fill="none" stroke-linecap="round"/>
    <ellipse cx="64" cy="72" rx="52" ry="38" fill="#d9b27a" stroke="#6b4a1f" stroke-width="5"/>
    ${twists}
    <ellipse cx="64" cy="70" rx="32" ry="21" fill="none" stroke="#b08a4a" stroke-width="7"/>
    <ellipse cx="64" cy="68" rx="16" ry="9" fill="#7a5a24" stroke="#6b4a1f" stroke-width="4"/>
    <path d="M30 56 Q44 44 64 42" stroke="#fff" stroke-width="4" fill="none" opacity=".45" stroke-linecap="round"/>`;
}

function paint(): string {
  return `<defs>${verticalGradient('can', [[0, '#e3e9ee'], [1, '#9fb0bf']])}</defs>
    <ellipse cx="64" cy="118" rx="40" ry="6" fill="#000" opacity=".15"/>
    <path d="M30 48 Q64 2 98 48" stroke="#5d6d7e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M28 46 H100 L92 112 Q91 118 85 118 H43 Q37 118 36 112 Z" fill="url(#can)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <rect x="34" y="70" width="60" height="22" rx="4" fill="#3b8fd9" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="64" cy="46" rx="36" ry="10" fill="#e74c3c" stroke="${INK}" stroke-width="5"/>
    <path d="M40 50 Q40 68 46 68 Q52 68 52 54 Z M76 52 Q76 62 80 62 Q84 62 84 52 Z" fill="#e74c3c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="52" cy="43" rx="10" ry="3" fill="#fff" opacity=".5"/>`;
}

function glass(): string {
  return `<defs>${verticalGradient('pane', [[0, '#c9f1ff'], [1, '#6cc3e8']])}</defs>
    <ellipse cx="64" cy="118" rx="40" ry="6" fill="#000" opacity=".15"/>
    <g transform="rotate(-10 64 64)">
      <rect x="26" y="16" width="76" height="96" rx="8" fill="url(#pane)" stroke="#2e6e8e" stroke-width="6"/>
      <rect x="26" y="16" width="76" height="96" rx="8" fill="none" stroke="#e8fbff" stroke-width="2" opacity=".8"/>
      <path d="M38 30 L64 30 L38 70 Z" fill="#fff" opacity=".75"/>
      <path d="M74 92 L90 72 L90 84 L82 94 Z" fill="#fff" opacity=".55"/>
    </g>`;
}

function cloth(): string {
  return `<defs>${verticalGradient('fab', [[0, '#fffaf0'], [1, '#e2d6bf']])}</defs>
    <ellipse cx="64" cy="114" rx="50" ry="8" fill="#000" opacity=".15"/>
    <rect x="14" y="58" width="92" height="46" rx="8" fill="url(#fab)" stroke="${INK}" stroke-width="5"/>
    <path d="M14 74 H106 M14 90 H106" stroke="#3b8fd9" stroke-width="6"/>
    <rect x="22" y="28" width="88" height="38" rx="8" fill="url(#fab)" stroke="${INK}" stroke-width="5"/>
    <path d="M22 42 H110 M22 54 H110" stroke="#e74c3c" stroke-width="5"/>
    <path d="M106 62 Q122 84 110 108 L100 104 Q110 84 98 64 Z" fill="#d6c7a8" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M30 34 H70" stroke="#fff" stroke-width="3" opacity=".8" stroke-linecap="round"/>`;
}

export function materialSvg(id: MaterialId, size: number): string {
  const body = { wood, stone, nails, rope, paint, glass, cloth }[id]();
  return svgDoc(size, size, body, VIEW);
}

/** Pazar: çizgili tenteli tezgâh. */
export function marketSvg(size: number): string {
  const stripes = Array.from({ length: 5 }, (_, i) => {
    const x0 = 24 + i * 16;
    const b0 = 14 + i * 20;
    return i % 2 === 0 ? `<path d="M${x0} 18 H${x0 + 16} L${b0 + 20} 46 H${b0} Z" fill="#fff"/>` : '';
  }).join('');
  const scallops = Array.from({ length: 5 }, (_, i) => `<circle cx="${24 + i * 20}" cy="46" r="10" fill="${i % 2 ? '#fff' : '#e74c3c'}" stroke="${INK}" stroke-width="4"/>`).join('');
  return svgDoc(
    size,
    size,
    `<defs>${verticalGradient('counter', [[0, '#d99a5b'], [1, '#a86a33']])}</defs>
     <rect x="24" y="44" width="8" height="34" fill="#a86a33" stroke="${WOOD_DARK}" stroke-width="3"/>
     <rect x="96" y="44" width="8" height="34" fill="#a86a33" stroke="${WOOD_DARK}" stroke-width="3"/>
     <path d="M14 46 L24 18 H104 L114 46 Z" fill="#e74c3c" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
     ${stripes}
     <path d="M14 46 L24 18 H104 L114 46 Z" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
     ${scallops}
     <circle cx="44" cy="70" r="9" fill="#e74c3c" stroke="${INK}" stroke-width="3"/>
     <circle cx="62" cy="68" r="9" fill="#f39c12" stroke="${INK}" stroke-width="3"/>
     <circle cx="80" cy="70" r="9" fill="#5ccf5f" stroke="${INK}" stroke-width="3"/>
     <rect x="18" y="76" width="92" height="40" rx="6" fill="url(#counter)" stroke="${WOOD_DARK}" stroke-width="5"/>
     <path d="M26 90 H102 M26 102 H102" stroke="${WOOD_DARK}" stroke-width="3" opacity=".5"/>`,
    VIEW,
  );
}

/** İnşaat çekici. */
export function hammerSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<g transform="rotate(-35 64 64)">
       <rect x="56" y="40" width="16" height="80" rx="7" fill="#d99a5b" stroke="${WOOD_DARK}" stroke-width="5"/>
       <path d="M61 48 V112" stroke="#f1c48e" stroke-width="3" stroke-linecap="round"/>
       <path d="M28 18 H92 Q100 18 100 26 V44 Q100 50 94 50 H34 Q20 50 20 34 Q20 18 28 18 Z" fill="#9fb3c8" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
       <path d="M34 26 H88" stroke="#fff" stroke-width="4" opacity=".6" stroke-linecap="round"/>
     </g>`,
    VIEW,
  );
}

/** Kum saati yerine kronometre: inşaat süresi. */
export function clockSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<rect x="54" y="6" width="20" height="14" rx="4" fill="#9fb3c8" stroke="${INK}" stroke-width="4"/>
     <circle cx="66" cy="70" r="50" fill="#fffaf0" stroke="${INK}" stroke-width="7"/>
     <circle cx="66" cy="70" r="40" fill="none" stroke="#d9a066" stroke-width="3" stroke-dasharray="4 17"/>
     <path d="M66 70 V40 M66 70 L86 82" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
     <circle cx="66" cy="70" r="7" fill="#e74c3c" stroke="${INK}" stroke-width="3"/>
     <path d="M30 46 A44 44 0 0 1 52 28" stroke="#fff" stroke-width="5" fill="none" opacity=".8" stroke-linecap="round"/>`,
    VIEW,
  );
}

function hull(): string {
  return `<defs>${verticalGradient('hull', [[0, '#c98a4b'], [1, '#7a4a20']])}</defs>
    <path d="M60 14 V60" stroke="${WOOD_DARK}" stroke-width="6"/>
    <path d="M64 18 L98 52 H64 Z" fill="#fffaf0" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M10 64 H118 L102 104 Q100 110 94 110 H34 Q28 110 26 104 Z" fill="url(#hull)" stroke="${WOOD_DARK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M18 78 H110" stroke="${WOOD_DARK}" stroke-width="3" opacity=".6"/>
    <circle cx="44" cy="90" r="7" fill="#c9f1ff" stroke="${WOOD_DARK}" stroke-width="4"/>
    <circle cx="64" cy="90" r="7" fill="#c9f1ff" stroke="${WOOD_DARK}" stroke-width="4"/>
    <circle cx="84" cy="90" r="7" fill="#c9f1ff" stroke="${WOOD_DARK}" stroke-width="4"/>
    <path d="M6 116 Q22 108 38 116 T70 116 T102 116 T122 114" stroke="#3b8fd9" stroke-width="5" fill="none" stroke-linecap="round"/>`;
}

function storage(): string {
  return `<defs>${verticalGradient('crate', [[0, '#e0a868'], [1, '#a86a33']])}</defs>
    <ellipse cx="64" cy="116" rx="50" ry="7" fill="#000" opacity=".15"/>
    <rect x="18" y="24" width="92" height="88" rx="8" fill="url(#crate)" stroke="${WOOD_DARK}" stroke-width="6"/>
    <rect x="28" y="34" width="72" height="68" rx="4" fill="none" stroke="${WOOD_DARK}" stroke-width="4"/>
    <path d="M30 36 L98 100 M98 36 L30 100" stroke="${WOOD_DARK}" stroke-width="7" stroke-linecap="round"/>
    <path d="M30 36 L98 100 M98 36 L30 100" stroke="#e0a868" stroke-width="3" stroke-linecap="round"/>
    <path d="M26 30 H70" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/>`;
}

function engine(): string {
  const blades = [0, 120, 240]
    .map(
      (a) => `<path d="M64 64 Q52 30 64 12 Q80 30 64 64 Z" transform="rotate(${a} 64 64)" fill="#ffcb3d" stroke="#8a5a00" stroke-width="5" stroke-linejoin="round"/>`,
    )
    .join('');
  return `<circle cx="64" cy="64" r="56" fill="#3b8fd9" opacity=".25"/>
    ${blades}
    <circle cx="64" cy="64" r="14" fill="#9fb3c8" stroke="${INK}" stroke-width="5"/>
    <circle cx="64" cy="64" r="5" fill="${INK}"/>`;
}

export function shipUpgradeSvg(id: ShipUpgradeId, size: number): string {
  return svgDoc(size, size, { hull, storage, engine }[id](), VIEW);
}

const CHEST_PALETTES: Record<ChestId, { wood: [string, string]; lid: [string, string]; band: string; lock: string; gem?: string }> = {
  captain: { wood: ['#c98a4b', '#8b5a2b'], lid: ['#d99a5b', '#a86a33'], band: '#9aa5b4', lock: '#ffcb3d' },
  treasure: { wood: ['#4a90d9', '#1f5a99'], lid: ['#5fa8ee', '#2a6cb0'], band: '#e3e9ee', lock: '#ffcb3d', gem: '#5ccf5f' },
  legend: { wood: ['#9b59b6', '#5e2a7a'], lid: ['#b37fd0', '#7d3c98'], band: '#ffcb3d', lock: '#fff09a', gem: '#e74c3c' },
};

/** Pazar sandıkları: aynı biçim, sandığa göre renk; nadir olanlarda taş süs. */
export function chestVariantSvg(id: ChestId, size: number): string {
  const p = CHEST_PALETTES[id];
  const gems = p.gem
    ? `<circle cx="30" cy="84" r="7" fill="${p.gem}" stroke="${WOOD_DARK}" stroke-width="3"/><circle cx="98" cy="84" r="7" fill="${p.gem}" stroke="${WOOD_DARK}" stroke-width="3"/>`
    : '';
  return svgDoc(
    size,
    size,
    `<defs>
       ${verticalGradient('w', [[0, p.wood[0]], [1, p.wood[1]]])}
       ${verticalGradient('l', [[0, p.lid[0]], [1, p.lid[1]]])}
     </defs>
     <ellipse cx="64" cy="120" rx="54" ry="6" fill="#000" opacity=".15"/>
     <rect x="10" y="50" width="108" height="66" rx="10" fill="url(#w)" stroke="${WOOD_DARK}" stroke-width="5"/>
     <path d="M10 54 Q10 14 64 14 Q118 14 118 54 Z" fill="url(#l)" stroke="${WOOD_DARK}" stroke-width="5" stroke-linejoin="round"/>
     <rect x="24" y="16" width="12" height="100" fill="${p.band}" stroke="${WOOD_DARK}" stroke-width="3"/>
     <rect x="92" y="16" width="12" height="100" fill="${p.band}" stroke="${WOOD_DARK}" stroke-width="3"/>
     <path d="M10 54 H118" stroke="${WOOD_DARK}" stroke-width="5"/>
     ${gems}
     <rect x="50" y="42" width="28" height="32" rx="6" fill="${p.lock}" stroke="#8a5a00" stroke-width="4"/>
     <circle cx="64" cy="54" r="4.5" fill="#5a3a00"/>
     <path d="M64 56 V64" stroke="#5a3a00" stroke-width="4" stroke-linecap="round"/>
     <path d="M30 26 Q44 20 58 22" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".35"/>`,
    VIEW,
  );
}

/** Kumbara: altın biriktiren domuzcuk. */
export function piggySvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<defs>${verticalGradient('pig', [[0, '#ffb3c6'], [1, '#f07899']])}</defs>
     <ellipse cx="64" cy="118" rx="44" ry="6" fill="#000" opacity=".15"/>
     <rect x="36" y="94" width="14" height="22" rx="5" fill="#f07899" stroke="#8a2a4a" stroke-width="4"/>
     <rect x="78" y="94" width="14" height="22" rx="5" fill="#f07899" stroke="#8a2a4a" stroke-width="4"/>
     <ellipse cx="62" cy="72" rx="48" ry="36" fill="url(#pig)" stroke="#8a2a4a" stroke-width="5"/>
     <path d="M30 44 L36 22 L50 40 Z" fill="#f07899" stroke="#8a2a4a" stroke-width="4" stroke-linejoin="round"/>
     <ellipse cx="108" cy="74" rx="12" ry="14" fill="#ffb3c6" stroke="#8a2a4a" stroke-width="4"/>
     <circle cx="105" cy="70" r="2.5" fill="#8a2a4a"/><circle cx="111" cy="78" r="2.5" fill="#8a2a4a"/>
     <circle cx="88" cy="58" r="4.5" fill="${INK}"/>
     <rect x="50" y="38" width="26" height="7" rx="3" fill="#8a2a4a"/>
     <circle cx="63" cy="22" r="12" fill="#ffcb3d" stroke="#8a5a00" stroke-width="4"/>
     <path d="M26 66 Q22 58 14 62" stroke="#8a2a4a" stroke-width="4" fill="none" stroke-linecap="round"/>
     <ellipse cx="44" cy="58" rx="12" ry="6" fill="#fff" opacity=".45" transform="rotate(-25 44 58)"/>`,
    VIEW,
  );
}
