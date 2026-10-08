import { verticalGradient } from '../svgUtils';
import { INK, skyAndSea, type RegionArt } from './common';

/** Kulenin y yüksekliğindeki sol/sağ kenarı (yukarı doğru daralır). */
const towerX = (y: number) => {
  const t = (y - 250) / 360;
  return [590 - t * 25, 690 + t * 25] as const;
};

function picket(x: number, top: number, bottom: number, color: string): string {
  return `<path d="M${x} ${bottom} V${top + 8} L${x + 6} ${top} L${x + 12} ${top + 8} V${bottom} Z" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
}

function bush(cx: number, cy: number, leaf: string, flower: string): string {
  const flowers = [
    [-22, -12], [6, -20], [26, -6], [-6, 2], [16, 8],
  ].map(
    ([dx, dy]) =>
      `<g transform="translate(${cx + dx} ${cy + dy})"><circle r="6" fill="${flower}" stroke="${INK}" stroke-width="2"/><circle r="2.5" fill="#fff3a0"/></g>`,
  );
  return `<g>
    <ellipse cx="${cx}" cy="${cy}" rx="46" ry="26" fill="${leaf}" stroke="${INK}" stroke-width="4"/>
    <ellipse cx="${cx - 16}" cy="${cy - 10}" rx="18" ry="12" fill="#ffffff" opacity=".18"/>
    ${flowers.join('')}
  </g>`;
}

export const LIGHTHOUSE: RegionArt = {
  background: () => `
    ${skyAndSea(300)}
    <defs>
      ${verticalGradient('rock', [[0, '#a8aebb'], [1, '#6d7482']])}
      ${verticalGradient('grass', [[0, '#9be27c'], [1, '#5fb14d']])}
    </defs>
    <ellipse cx="160" cy="700" rx="70" ry="22" fill="#8d95a3" stroke="${INK}" stroke-width="4"/>
    <ellipse cx="250" cy="760" rx="40" ry="14" fill="#8d95a3" stroke="${INK}" stroke-width="4"/>
    <path d="M300 820 C320 700 360 640 420 612 L900 600 C960 610 1000 640 1000 680 L1000 820 Z" fill="url(#rock)" stroke="${INK}" stroke-width="5"/>
    <path d="M420 700 l30 -20 M520 740 l40 -10 M820 700 l-30 -18 M700 760 l30 -12" stroke="${INK}" stroke-width="3" opacity=".4"/>
    <path d="M380 628 C420 596 500 588 560 590 L880 588 C930 590 965 605 988 628 C900 646 500 646 380 628 Z" fill="url(#grass)" stroke="${INK}" stroke-width="4"/>
    <path d="M582 612 L586 560 L612 545 L626 562 L650 538 L672 556 L700 548 L704 612 Z" fill="#b8b0a4" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M590 582 H700 M600 598 H696 M640 562 V582 M620 582 V598 M670 582 V598" stroke="${INK}" stroke-width="2.5" opacity=".5"/>`,
  parts: {
    tower: {
      box: [550, 235, 180, 385],
      draw: (p) => {
        const bands = [0, 1, 2, 3].map((i) => {
          const y0 = 250 + i * 90;
          const y1 = y0 + 90;
          const [l0, r0] = towerX(y0);
          const [l1, r1] = towerX(y1);
          return `<path d="M${l0} ${y0} L${r0} ${y0} L${r1} ${y1} L${l1} ${y1} Z" fill="${i % 2 === 0 ? p.main : p.light}"/>`;
        });
        const [lt, rt] = towerX(250);
        const [lb, rb] = towerX(610);
        return `${bands.join('')}
          <path d="M${lt} 250 L${rt} 250 L${rb} 610 L${lb} 610 Z" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
          <path d="M${lt + 12} 260 L${lb + 14} 600" stroke="#ffffff" stroke-width="8" opacity=".25" stroke-linecap="round"/>
          <rect x="626" y="300" width="28" height="40" rx="12" fill="#2c3e50" stroke="${INK}" stroke-width="4"/>
          <rect x="626" y="430" width="28" height="40" rx="12" fill="#2c3e50" stroke="${INK}" stroke-width="4"/>
          <rect x="558" y="598" width="164" height="16" rx="5" fill="${p.trim}" stroke="${INK}" stroke-width="4"/>`;
      },
    },
    lantern: {
      box: [560, 112, 160, 168],
      draw: (p) => `
        <circle cx="640" cy="200" r="72" fill="${p.glass}" opacity=".28"/>
        <rect x="604" y="172" width="72" height="52" rx="6" fill="${p.glass}" stroke="${INK}" stroke-width="4"/>
        <circle cx="640" cy="198" r="13" fill="#ffffff" opacity=".9"/>
        <path d="M628 172 V224 M652 172 V224" stroke="${INK}" stroke-width="3"/>
        <path d="M596 176 Q640 118 684 176 Z" fill="${p.main}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <circle cx="640" cy="126" r="8" fill="${p.accent}" stroke="${INK}" stroke-width="3"/>
        <rect x="574" y="238" width="132" height="14" rx="4" fill="${p.trim}" stroke="${INK}" stroke-width="4"/>
        <path d="M584 238 V222 M604 238 V222 M624 238 V222 M656 238 V222 M676 238 V222 M696 238 V222" stroke="${INK}" stroke-width="3"/>
        <rect x="578" y="218" width="124" height="6" rx="3" fill="${p.trim}" stroke="${INK}" stroke-width="2"/>`,
    },
    door: {
      box: [600, 538, 80, 82],
      draw: (p) => `
        <path d="M618 610 V574 Q640 548 662 574 V610 Z" fill="${p.wood}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M640 556 V610 M628 566 V610 M652 566 V610" stroke="${INK}" stroke-width="2" opacity=".45"/>
        <circle cx="652" cy="590" r="4" fill="${p.accent}" stroke="${INK}" stroke-width="2"/>
        <rect x="610" y="606" width="60" height="10" rx="3" fill="#b8b0a4" stroke="${INK}" stroke-width="3"/>`,
    },
    fence: {
      box: [392, 562, 520, 68],
      draw: (p) => {
        const left = Array.from({ length: 8 }, (_, i) => picket(402 + i * 18, 572, 624, p.fence)).join('');
        const right = Array.from({ length: 9 }, (_, i) => picket(738 + i * 18, 572, 624, p.fence)).join('');
        return `
          <rect x="398" y="586" width="148" height="8" rx="3" fill="${p.main}" stroke="${INK}" stroke-width="2.5"/>
          <rect x="398" y="606" width="148" height="8" rx="3" fill="${p.main}" stroke="${INK}" stroke-width="2.5"/>
          <rect x="734" y="586" width="166" height="8" rx="3" fill="${p.main}" stroke="${INK}" stroke-width="2.5"/>
          <rect x="734" y="606" width="166" height="8" rx="3" fill="${p.main}" stroke="${INK}" stroke-width="2.5"/>
          ${left}${right}`;
      },
    },
    garden: {
      box: [404, 566, 500, 86],
      draw: (p) => `${bush(460, 622, p.leaf, p.flower)}${bush(536, 630, p.leaf, p.flower)}${bush(770, 630, p.leaf, p.flower)}${bush(852, 622, p.leaf, p.flower)}`,
    },
  },
};
