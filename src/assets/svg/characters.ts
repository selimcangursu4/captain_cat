import { svgDoc, verticalGradient } from './svgUtils';

/**
 * Kaptan Pati'nin yüzü: turuncu kedi, yamuk duran kaptan şapkası ve
 * sakarlığının izi olarak yanağında yara bandı.
 */
export function captainPatiSvg(size: number): string {
  const line = '#7A3E0C';
  return svgDoc(
    size,
    size,
    `<defs>${verticalGradient('fur', [[0, '#FFC071'], [1, '#EE8622']])}</defs>
     <ellipse cx="128" cy="236" rx="80" ry="12" fill="#06263d" opacity=".2"/>
     <path d="M44 122 L52 44 L104 90 Z" fill="url(#fur)" stroke="${line}" stroke-width="8" stroke-linejoin="round"/>
     <path d="M212 122 L204 44 L152 90 Z" fill="url(#fur)" stroke="${line}" stroke-width="8" stroke-linejoin="round"/>
     <path d="M58 106 L62 64 L88 90 Z" fill="#FFB3C1"/>
     <path d="M198 106 L194 64 L168 90 Z" fill="#FFB3C1"/>
     <ellipse cx="128" cy="150" rx="92" ry="78" fill="url(#fur)" stroke="${line}" stroke-width="8"/>
     <path d="M128 92 V108 M110 96 L113 110 M146 96 L143 110" stroke="#D9701A" stroke-width="7" stroke-linecap="round"/>
     <ellipse cx="108" cy="180" rx="28" ry="22" fill="#FFF3E2"/>
     <ellipse cx="148" cy="180" rx="28" ry="22" fill="#FFF3E2"/>
     <ellipse cx="92" cy="142" rx="12" ry="15" fill="#2B1B0E"/>
     <ellipse cx="164" cy="142" rx="12" ry="15" fill="#2B1B0E"/>
     <circle cx="88" cy="136" r="5" fill="#fff"/>
     <circle cx="160" cy="136" r="5" fill="#fff"/>
     <ellipse cx="66" cy="168" rx="12" ry="7" fill="#FF8FA3" opacity=".55"/>
     <ellipse cx="190" cy="168" rx="12" ry="7" fill="#FF8FA3" opacity=".55"/>
     <path d="M118 162 H138 L128 174 Z" fill="#FF7A93" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
     <path d="M128 174 Q128 188 114 188 M128 174 Q128 188 142 188" fill="none" stroke="${line}" stroke-width="4" stroke-linecap="round"/>
     <path d="M70 180 L34 172 M70 190 L34 194 M186 180 L222 172 M186 190 L222 194" stroke="${line}" stroke-width="3.5" stroke-linecap="round"/>
     <g transform="rotate(-24 190 120)">
       <rect x="172" y="112" width="38" height="15" rx="7.5" fill="#F7D9B5" stroke="#B88A5A" stroke-width="3"/>
       <rect x="185" y="113.5" width="12" height="12" fill="#EBC59A"/>
     </g>
     <g transform="rotate(-9 128 70)">
       <path d="M64 86 Q60 34 128 26 Q196 34 192 86 Z" fill="#FFFFFF" stroke="#1E2A4A" stroke-width="8" stroke-linejoin="round"/>
       <rect x="60" y="72" width="136" height="24" rx="8" fill="#1E3A6E" stroke="#1E2A4A" stroke-width="6"/>
       <path d="M66 96 Q128 124 190 96 Q128 108 66 96 Z" fill="#14213D" stroke="#0C142A" stroke-width="5" stroke-linejoin="round"/>
       <circle cx="128" cy="56" r="16" fill="#FFCB3D" stroke="#A86A00" stroke-width="5"/>
       <path d="M128 47 V66 M121 52 H135 M119 60 Q128 71 137 60" fill="none" stroke="#A86A00" stroke-width="3.5" stroke-linecap="round"/>
     </g>`,
    '0 0 256 256',
  );
}
