import { verticalGradient } from '../svgUtils';
import { INK, anchorIcon, skyAndSea, type RegionArt } from './common';

const POSTS = [140, 270, 400, 530, 660];

export const PIER: RegionArt = {
  background: () => `
    ${skyAndSea(300)}
    <defs>${verticalGradient('quay', [[0, '#e9cf96'], [1, '#c9a462']])}</defs>
    <path d="M700 820 L722 562 L1000 540 L1000 820 Z" fill="url(#quay)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M716 620 H1000 M712 680 H1000 M708 740 H1000 M780 562 V620 M880 556 V620 M830 620 V680 M930 620 V680 M780 680 V740 M880 680 V740"
      stroke="${INK}" stroke-width="3" opacity=".35"/>
    ${[150, 280, 410, 540]
      .map(
        (x, i) =>
          `<path d="M${x} 770 V${640 + (i % 2) * 22} l8 -10 l6 12 l8 -8 V770 Z" fill="#6e4423" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
      )
      .join('')}`,
  parts: {
    deck: {
      box: [90, 545, 690, 225],
      draw: (p) => `
        ${POSTS.map((x) => `<rect x="${x}" y="592" width="22" height="168" fill="${p.wood}" stroke="${INK}" stroke-width="4"/>`).join('')}
        ${POSTS.map((x) => `<rect x="${x}" y="592" width="22" height="168" fill="#000" opacity=".2"/>`).join('')}
        <rect x="100" y="556" width="670" height="40" rx="6" fill="${p.wood}" stroke="${INK}" stroke-width="5"/>
        <path d="${Array.from({ length: 16 }, (_, i) => `M${140 + i * 40} 558 V594`).join(' ')}" stroke="${INK}" stroke-width="2.5" opacity=".45"/>
        <path d="M108 566 H762" stroke="#ffffff" stroke-width="4" opacity=".25"/>`,
    },
    bollards: {
      box: [168, 508, 500, 56],
      draw: (p) =>
        [210, 420, 630]
          .map(
            (x) => `
          <rect x="${x - 16}" y="530" width="32" height="28" rx="6" fill="${p.trim}" stroke="${INK}" stroke-width="4"/>
          <ellipse cx="${x}" cy="528" rx="24" ry="11" fill="${p.main}" stroke="${INK}" stroke-width="4"/>
          <ellipse cx="${x - 7}" cy="525" rx="8" ry="3" fill="#ffffff" opacity=".5"/>`,
          )
          .join(''),
    },
    lamps: {
      box: [256, 326, 350, 236],
      draw: (p) =>
        [300, 560]
          .map(
            (x) => `
          <circle cx="${x}" cy="398" r="44" fill="${p.glass}" opacity=".3"/>
          <rect x="${x - 6}" y="410" width="12" height="148" fill="${p.trim}" stroke="${INK}" stroke-width="3"/>
          <rect x="${x - 16}" y="540" width="32" height="16" rx="4" fill="${p.trim}" stroke="${INK}" stroke-width="3"/>
          <path d="M${x - 18} 416 L${x - 22} 382 H${x + 22} L${x + 18} 416 Z" fill="${p.glass}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
          <path d="M${x - 28} 384 L${x} 356 L${x + 28} 384 Z" fill="${p.main}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
          <circle cx="${x}" cy="398" r="7" fill="#ffffff"/>`,
          )
          .join(''),
    },
    boat: {
      box: [52, 672, 290, 128],
      draw: (p) => `
        <path d="M150 700 L222 676 M200 704 L300 680" stroke="${p.wood}" stroke-width="8" stroke-linecap="round"/>
        <path d="M66 712 Q190 798 326 712 L306 696 L86 696 Z" fill="${p.main}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M80 712 Q190 782 312 712" fill="none" stroke="${p.light}" stroke-width="8"/>
        <rect x="150" y="694" width="90" height="10" rx="4" fill="${p.wood}" stroke="${INK}" stroke-width="3"/>
        <path d="M60 760 q30 -12 60 0 q30 12 60 0 q30 -12 60 0 q30 12 60 0" fill="none" stroke="#ffffff" stroke-width="4" opacity=".6"/>`,
    },
    buoys: {
      box: [100, 590, 680, 80],
      draw: (p) => {
        const ring = (x: number, y: number) => `
          <circle cx="${x}" cy="${y}" r="17" fill="none" stroke="${INK}" stroke-width="16"/>
          <circle cx="${x}" cy="${y}" r="17" fill="none" stroke="${p.main}" stroke-width="10"/>
          <circle cx="${x}" cy="${y}" r="17" fill="none" stroke="${p.light}" stroke-width="10" stroke-dasharray="9 17.7"/>`;
        return `
          <path d="M110 600 Q270 646 430 600 Q590 646 760 600" fill="none" stroke="#c49a6c" stroke-width="5"/>
          ${ring(200, 634)}${ring(350, 632)}${ring(520, 634)}${ring(680, 632)}`;
      },
    },
    sign: {
      box: [778, 418, 144, 150],
      draw: (p) => `
        <rect x="842" y="470" width="14" height="92" fill="${p.wood}" stroke="${INK}" stroke-width="4"/>
        <rect x="790" y="428" width="120" height="66" rx="12" fill="${p.light}" stroke="${INK}" stroke-width="5"/>
        <rect x="798" y="436" width="104" height="50" rx="8" fill="none" stroke="${p.main}" stroke-width="3"/>
        ${anchorIcon(850, 463, p.main, 0.8)}`,
    },
  },
};
