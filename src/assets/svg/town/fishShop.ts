import { verticalGradient } from '../svgUtils';
import { INK, fishIcon, rubble, skyAndSea, type RegionArt } from './common';

/** Arnavut kaldırımı rıhtım zemini. */
function cobbles(top: number): string {
  const stones: string[] = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 12; col++) {
      const x = col * 88 + (row % 2) * 44;
      const y = top + 30 + row * 58;
      stones.push(`<ellipse cx="${x}" cy="${y}" rx="38" ry="22" fill="#d8ccb4" stroke="${INK}" stroke-width="2" opacity=".55"/>`);
    }
  }
  return stones.join('');
}

export const FISH_SHOP: RegionArt = {
  background: () => `
    ${skyAndSea(300, 470)}
    <defs>${verticalGradient('ground', [[0, '#cfc3ab'], [1, '#b3a68c']])}</defs>
    <rect y="470" width="1000" height="350" fill="url(#ground)"/>
    <rect y="458" width="1000" height="18" fill="#a59a86" stroke="${INK}" stroke-width="4"/>
    ${cobbles(470)}
    <rect x="300" y="604" width="420" height="40" rx="6" fill="#b8b0a4" stroke="${INK}" stroke-width="4"/>
    ${rubble(320, 604, 160)}${rubble(560, 604, 140)}`,
  parts: {
    walls: {
      box: [300, 390, 420, 260],
      draw: (p) => `
        <rect x="310" y="400" width="400" height="242" fill="${p.wall}" stroke="${INK}" stroke-width="5"/>
        <path d="${Array.from({ length: 7 }, (_, i) => `M312 ${430 + i * 30} H708`).join(' ')}" stroke="${INK}" stroke-width="2" opacity=".18"/>
        <rect x="470" y="526" width="80" height="116" rx="6" fill="${p.wood}" stroke="${INK}" stroke-width="4"/>
        <circle cx="536" cy="586" r="5" fill="${p.accent}" stroke="${INK}" stroke-width="2"/>
        ${[345, 575]
          .map(
            (x) => `<rect x="${x}" y="526" width="100" height="64" rx="6" fill="#bfe9ff" stroke="${INK}" stroke-width="4"/>
              <path d="M${x + 50} 526 V590 M${x} 558 H${x + 100}" stroke="${p.trim}" stroke-width="4"/>`,
          )
          .join('')}`,
    },
    roof: {
      box: [268, 290, 484, 126],
      draw: (p) => `
        <rect x="610" y="306" width="30" height="50" fill="#b8b0a4" stroke="${INK}" stroke-width="4"/>
        <path d="M278 408 L510 300 L742 408 Z" fill="${p.main}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M340 380 H680 M400 352 H620 M455 326 H565" stroke="${INK}" stroke-width="2.5" opacity=".35"/>
        <path d="M300 400 L510 306" stroke="#ffffff" stroke-width="6" opacity=".25"/>`,
    },
    awning: {
      box: [320, 456, 380, 76],
      draw: (p) => {
        const stripes = Array.from(
          { length: 9 },
          (_, i) => `<rect x="${330 + i * 40}" y="466" width="40" height="40" fill="${i % 2 === 0 ? p.main : p.light}"/>`,
        ).join('');
        const scallops = Array.from(
          { length: 9 },
          (_, i) => `<path d="M${330 + i * 40} 504 q20 22 40 0" fill="${i % 2 === 0 ? p.main : p.light}" stroke="${INK}" stroke-width="3"/>`,
        ).join('');
        return `${stripes}${scallops}<rect x="330" y="466" width="360" height="40" fill="none" stroke="${INK}" stroke-width="4"/>`;
      },
    },
    stall: {
      box: [348, 570, 324, 96],
      draw: (p) =>
        [360, 520]
          .map(
            (x, i) => `
          <rect x="${x}" y="606" width="140" height="54" rx="4" fill="${p.wood}" stroke="${INK}" stroke-width="4"/>
          <path d="M${x} 624 H${x + 140} M${x} 642 H${x + 140}" stroke="${INK}" stroke-width="2" opacity=".4"/>
          <rect x="${x + 4}" y="596" width="132" height="14" rx="6" fill="#eaf8ff" stroke="${INK}" stroke-width="3"/>
          ${fishIcon(x + 38, 594, i === 0 ? '#34c26a' : '#ff8a3d', 0.9)}
          ${fishIcon(x + 96, 592, i === 0 ? '#3b82f6' : '#c062f0', 0.9)}`,
          )
          .join(''),
    },
    sign: {
      box: [408, 398, 204, 72],
      draw: (p) => `
        <rect x="420" y="408" width="180" height="52" rx="12" fill="${p.light}" stroke="${INK}" stroke-width="4"/>
        <rect x="428" y="415" width="164" height="38" rx="8" fill="none" stroke="${p.main}" stroke-width="3"/>
        ${fishIcon(510, 434, p.main, 1.05)}`,
    },
    plants: {
      box: [236, 540, 548, 118],
      draw: (p) =>
        [280, 740]
          .map(
            (x) => `
          <ellipse cx="${x}" cy="588" rx="34" ry="26" fill="${p.leaf}" stroke="${INK}" stroke-width="4"/>
          <circle cx="${x - 14}" cy="578" r="7" fill="${p.flower}" stroke="${INK}" stroke-width="2"/>
          <circle cx="${x + 10}" cy="570" r="7" fill="${p.flower}" stroke="${INK}" stroke-width="2"/>
          <circle cx="${x + 18}" cy="592" r="7" fill="${p.flower}" stroke="${INK}" stroke-width="2"/>
          <path d="M${x - 26} 606 H${x + 26} L${x + 20} 648 H${x - 20} Z" fill="${p.main}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
          <rect x="${x - 30}" y="600" width="60" height="12" rx="4" fill="${p.main}" stroke="${INK}" stroke-width="3"/>`,
          )
          .join(''),
    },
  },
};
