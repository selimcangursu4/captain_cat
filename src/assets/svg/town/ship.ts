import { verticalGradient } from '../svgUtils';
import { INK, skyAndSea, type RegionArt } from './common';

export const SHIP: RegionArt = {
  background: () => `
    ${skyAndSea(280)}
    <defs>${verticalGradient('dock', [[0, '#c98a4b'], [1, '#8b5a2b']])}</defs>
    <rect x="870" y="600" width="140" height="40" fill="url(#dock)" stroke="${INK}" stroke-width="4"/>
    <rect x="890" y="640" width="18" height="180" fill="#6e4423" stroke="${INK}" stroke-width="4"/>
    <rect x="960" y="640" width="18" height="180" fill="#6e4423" stroke="${INK}" stroke-width="4"/>
    <path d="M200 700 L240 650 L330 668 L380 640 L470 662 L560 646 L640 670 L720 652 L760 700 Z" fill="#6e4423" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M260 700 V660 M360 700 V652 M460 700 V664 M560 700 V650 M660 700 V668" stroke="${INK}" stroke-width="3" opacity=".4"/>
    <path d="M180 712 q40 -14 80 0 q40 14 80 0 q40 -14 80 0 q40 14 80 0 q40 -14 80 0 q40 14 80 0 q40 -14 80 0"
      fill="none" stroke="#ffffff" stroke-width="5" opacity=".6"/>`,
  parts: {
    hull: {
      box: [130, 528, 720, 186],
      draw: (p) => `
        <path d="M140 540 L840 540 Q822 680 690 702 L270 702 Q160 682 140 540 Z" fill="${p.wood}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
        <path d="M146 562 L834 562 L828 588 L152 588 Z" fill="${p.main}" stroke="${INK}" stroke-width="3"/>
        <path d="M200 640 H780 M240 670 H730" stroke="${INK}" stroke-width="2.5" opacity=".35"/>
        ${[300, 400, 500, 600, 700]
          .map((x) => `<circle cx="${x}" cy="618" r="13" fill="${p.glass}" stroke="${INK}" stroke-width="4"/><circle cx="${x - 4}" cy="614" r="4" fill="#ffffff" opacity=".7"/>`)
          .join('')}
        <path d="M150 548 L830 548" stroke="#ffffff" stroke-width="5" opacity=".25"/>`,
    },
    cabin: {
      box: [548, 418, 224, 126],
      draw: (p) => `
        <rect x="560" y="444" width="200" height="98" rx="6" fill="${p.light}" stroke="${INK}" stroke-width="5"/>
        <rect x="552" y="430" width="216" height="20" rx="6" fill="${p.main}" stroke="${INK}" stroke-width="4"/>
        <rect x="690" y="472" width="44" height="70" rx="6" fill="${p.wood}" stroke="${INK}" stroke-width="4"/>
        <circle cx="610" cy="490" r="16" fill="${p.glass}" stroke="${INK}" stroke-width="4"/>
        <circle cx="652" cy="490" r="16" fill="${p.glass}" stroke="${INK}" stroke-width="4"/>`,
    },
    mast: {
      box: [318, 108, 236, 440],
      draw: (p) => `
        <rect x="424" y="120" width="22" height="424" fill="${p.wood}" stroke="${INK}" stroke-width="4"/>
        <rect x="330" y="172" width="212" height="12" rx="5" fill="${p.wood}" stroke="${INK}" stroke-width="3"/>
        <path d="M404 146 H466 L460 168 H410 Z" fill="${p.wood}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M330 184 L240 540 M542 184 L640 540" stroke="${INK}" stroke-width="2" opacity=".5"/>`,
    },
    sails: {
      box: [328, 174, 214, 276],
      draw: (p) => `
        <path d="M340 186 Q440 232 530 186 L520 404 Q436 446 350 404 Z" fill="${p.light}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M343 260 Q438 304 527 260 L525 300 Q438 344 345 300 Z" fill="${p.main}" opacity=".85"/>
        <path d="M347 350 Q436 392 523 350 L522 370 Q436 412 348 370 Z" fill="${p.main}" opacity=".85"/>
        <path d="M370 210 Q380 300 372 390" stroke="#ffffff" stroke-width="6" opacity=".4" fill="none"/>`,
    },
    flag: {
      box: [426, 72, 108, 62],
      draw: (p) => `
        <rect x="432" y="82" width="6" height="44" fill="${INK}"/>
        <path d="M438 86 Q478 72 522 90 Q504 104 524 120 Q478 104 438 120 Z" fill="${p.main}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <g fill="${p.light}"><circle cx="478" cy="104" r="7"/><circle cx="468" cy="94" r="3.5"/><circle cx="478" cy="91" r="3.5"/><circle cx="488" cy="94" r="3.5"/></g>`,
    },
    wheel: {
      box: [192, 420, 116, 128],
      draw: (p) => {
        const spokes = Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          const x1 = 250 + Math.cos(a) * 46;
          const y1 = 474 + Math.sin(a) * 46;
          return `<path d="M250 474 L${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${p.wood}" stroke-width="7" stroke-linecap="round"/>
            <circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="6" fill="${p.accent}" stroke="${INK}" stroke-width="2"/>`;
        }).join('');
        return `
          <rect x="242" y="474" width="16" height="70" fill="${p.wood}" stroke="${INK}" stroke-width="4"/>
          ${spokes}
          <circle cx="250" cy="474" r="34" fill="none" stroke="${INK}" stroke-width="12"/>
          <circle cx="250" cy="474" r="34" fill="none" stroke="${p.wood}" stroke-width="7"/>
          <circle cx="250" cy="474" r="9" fill="${p.accent}" stroke="${INK}" stroke-width="3"/>`;
      },
    },
    figurehead: {
      box: [796, 446, 120, 126],
      draw: (p) => `
        <path d="M818 470 L826 446 L846 464 Z M884 470 L876 446 L856 464 Z" fill="${p.accent}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <ellipse cx="851" cy="500" rx="42" ry="38" fill="${p.accent}" stroke="${INK}" stroke-width="5"/>
        <ellipse cx="836" cy="490" rx="5" ry="7" fill="${INK}"/>
        <ellipse cx="866" cy="490" rx="5" ry="7" fill="${INK}"/>
        <path d="M845 506 H857 L851 513 Z" fill="${p.flower}" stroke="${INK}" stroke-width="2"/>
        <path d="M851 513 Q851 522 842 522 M851 513 Q851 522 860 522" fill="none" stroke="${INK}" stroke-width="2.5"/>
        <path d="M818 508 H800 M818 516 H802 M884 508 H902 M884 516 H900" stroke="${INK}" stroke-width="2"/>
        <path d="M824 536 Q851 572 878 536" fill="${p.accent}" stroke="${INK}" stroke-width="4"/>
        <ellipse cx="836" cy="478" rx="9" ry="5" fill="#ffffff" opacity=".45"/>`,
    },
    rings: {
      box: [318, 570, 364, 64],
      draw: (p) =>
        [350, 650]
          .map(
            (x) => `
          <circle cx="${x}" cy="600" r="20" fill="none" stroke="${INK}" stroke-width="17"/>
          <circle cx="${x}" cy="600" r="20" fill="none" stroke="${p.main}" stroke-width="11"/>
          <circle cx="${x}" cy="600" r="20" fill="none" stroke="${p.light}" stroke-width="11" stroke-dasharray="10.7 20.7"/>`,
          )
          .join(''),
    },
  },
};
