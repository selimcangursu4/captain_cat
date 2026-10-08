import { verticalGradient } from '../svgUtils';
import { INK, rubble, skyAndSea, type RegionArt } from './common';

const TABLES = [690, 860];

export const CAFE: RegionArt = {
  background: () => `
    ${skyAndSea(300, 480)}
    <defs>${verticalGradient('boards', [[0, '#e3c29b'], [1, '#c79d70']])}</defs>
    <rect y="480" width="1000" height="340" fill="url(#boards)"/>
    <path d="${Array.from({ length: 6 }, (_, i) => `M0 ${520 + i * 52} H1000`).join(' ')}" stroke="${INK}" stroke-width="2.5" opacity=".25"/>
    <rect y="462" width="1000" height="12" fill="#a0632e" stroke="${INK}" stroke-width="3"/>
    <path d="${Array.from({ length: 21 }, (_, i) => `M${i * 50} 436 V466`).join(' ')}" stroke="#a0632e" stroke-width="6"/>
    <rect y="430" width="1000" height="10" rx="4" fill="#a0632e" stroke="${INK}" stroke-width="3"/>
    <rect x="150" y="598" width="410" height="32" rx="5" fill="#b8b0a4" stroke="${INK}" stroke-width="4"/>
    ${rubble(170, 598, 150)}${rubble(400, 598, 140)}`,
  parts: {
    walls: {
      box: [140, 370, 430, 266],
      draw: (p) => `
        <rect x="150" y="380" width="410" height="246" fill="${p.wall}" stroke="${INK}" stroke-width="5"/>
        <path d="${Array.from({ length: 13 }, (_, i) => `M${180 + i * 30} 382 V624`).join(' ')}" stroke="${INK}" stroke-width="2" opacity=".14"/>
        <rect x="320" y="516" width="70" height="110" rx="8" fill="${p.wood}" stroke="${INK}" stroke-width="4"/>
        <rect x="332" y="530" width="46" height="40" rx="6" fill="#bfe9ff" stroke="${INK}" stroke-width="3"/>
        <circle cx="378" cy="590" r="4" fill="${p.accent}" stroke="${INK}" stroke-width="2"/>`,
    },
    roof: {
      box: [120, 300, 470, 100],
      draw: (p) => {
        const scallops = Array.from(
          { length: 9 },
          (_, i) => `<path d="M${135 + i * 49} 384 q24.5 18 49 0" fill="${i % 2 === 0 ? p.main : p.light}" stroke="${INK}" stroke-width="3"/>`,
        ).join('');
        return `
          <path d="M130 386 L182 310 L528 310 L580 386 Z" fill="${p.main}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
          <path d="M170 360 H540 M188 334 H522" stroke="${p.light}" stroke-width="5" opacity=".6"/>
          ${scallops}`;
      },
    },
    windows: {
      box: [160, 428, 390, 104],
      draw: (p) =>
        [190, 430]
          .map(
            (x) => `
          <rect x="${x - 22}" y="440" width="20" height="80" rx="4" fill="${p.accent}" stroke="${INK}" stroke-width="3"/>
          <rect x="${x + 92}" y="440" width="20" height="80" rx="4" fill="${p.accent}" stroke="${INK}" stroke-width="3"/>
          <rect x="${x}" y="440" width="90" height="80" rx="6" fill="#bfe9ff" stroke="${INK}" stroke-width="4"/>
          <path d="M${x + 45} 440 V520 M${x} 480 H${x + 90}" stroke="${p.trim}" stroke-width="4"/>
          <path d="M${x + 10} 452 L${x + 30} 472" stroke="#ffffff" stroke-width="5" opacity=".6" stroke-linecap="round"/>`,
          )
          .join(''),
    },
    tables: {
      box: [600, 586, 350, 136],
      draw: (p) =>
        TABLES.map(
          (x) => `
          <path d="M${x - 70} 700 V650 Q${x - 70} 630 ${x - 52} 630 V700" fill="none" stroke="${p.wood}" stroke-width="8" stroke-linecap="round"/>
          <path d="M${x + 70} 700 V650 Q${x + 70} 630 ${x + 52} 630 V700" fill="none" stroke="${p.wood}" stroke-width="8" stroke-linecap="round"/>
          <rect x="${x - 82}" y="660" width="34" height="10" rx="4" fill="${p.main}" stroke="${INK}" stroke-width="3"/>
          <rect x="${x + 48}" y="660" width="34" height="10" rx="4" fill="${p.main}" stroke="${INK}" stroke-width="3"/>
          <rect x="${x - 5}" y="640" width="10" height="66" fill="${p.trim}" stroke="${INK}" stroke-width="3"/>
          <ellipse cx="${x}" cy="708" rx="26" ry="7" fill="${p.trim}" stroke="${INK}" stroke-width="3"/>
          <ellipse cx="${x}" cy="636" rx="56" ry="14" fill="${p.light}" stroke="${INK}" stroke-width="4"/>
          <path d="M${x - 10} 624 h20 v10 h-20 Z" fill="#ffffff" stroke="${INK}" stroke-width="2"/>`,
        ).join(''),
    },
    umbrellas: {
      box: [592, 470, 360, 176],
      draw: (p) =>
        TABLES.map((x) => {
          const segs = Array.from({ length: 4 }, (_, i) => {
            const x0 = x - 80 + i * 40;
            return `<path d="M${x} 486 L${x0} 540 Q${x0 + 20} 548 ${x0 + 40} 540 Z" fill="${i % 2 === 0 ? p.main : p.light}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
          }).join('');
          return `<rect x="${x - 4}" y="486" width="8" height="150" fill="${p.trim}" stroke="${INK}" stroke-width="2"/>${segs}
            <circle cx="${x}" cy="484" r="6" fill="${p.accent}" stroke="${INK}" stroke-width="2"/>`;
        }).join(''),
    },
    sign: {
      box: [278, 386, 154, 64],
      draw: (p) => `
        <rect x="288" y="394" width="134" height="46" rx="12" fill="${p.light}" stroke="${INK}" stroke-width="4"/>
        <path d="M336 406 H368 V426 Q352 438 336 426 Z" fill="${p.main}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M368 412 q12 0 12 8 q0 8 -12 8" fill="none" stroke="${INK}" stroke-width="3"/>
        <path d="M344 402 q4 -6 0 -10 M356 402 q4 -6 0 -10" fill="none" stroke="${p.trim}" stroke-width="2.5" stroke-linecap="round"/>`,
    },
    lights: {
      box: [548, 380, 404, 266],
      draw: (p) => {
        const bulbs = Array.from({ length: 9 }, (_, i) => {
          const t = (i + 1) / 10;
          const x = 560 + t * 380;
          const y = 398 + Math.sin(t * Math.PI) * 38 + t * 14;
          const color = [p.accent, p.glass, p.flower][i % 3];
          return `<circle cx="${x.toFixed(1)}" cy="${(y + 8).toFixed(1)}" r="12" fill="${color}" opacity=".35"/>
            <circle cx="${x.toFixed(1)}" cy="${(y + 8).toFixed(1)}" r="6.5" fill="${color}" stroke="${INK}" stroke-width="2"/>`;
        }).join('');
        return `
          <rect x="934" y="404" width="12" height="236" fill="${p.trim}" stroke="${INK}" stroke-width="3"/>
          <path d="M560 398 Q750 476 940 412" fill="none" stroke="${INK}" stroke-width="3"/>
          ${bulbs}`;
      },
    },
  },
};
