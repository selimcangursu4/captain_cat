import { svgDoc, verticalGradient } from './svgUtils';

/** Tahta karesi (dama deseni için iki ton). */
export function cellSvg(size: number, fill: string): string {
  return svgDoc(
    size,
    size,
    `<defs>${verticalGradient('c', [[0, fill], [1, fill, 0.86]])}</defs>
     <rect x="0" y="0" width="128" height="128" rx="18" fill="url(#c)"/>
     <rect x="8" y="7" width="112" height="34" rx="13" fill="#fff" opacity=".14"/>`,
    '0 0 128 128',
  );
}

/** Seçili taşın çevresindeki parlak çerçeve. */
export function selectionSvg(size: number): string {
  return svgDoc(
    size,
    size,
    `<rect x="3" y="3" width="122" height="122" rx="24" fill="none" stroke="#fff" stroke-width="7" opacity=".45"/>
     <rect x="8" y="8" width="112" height="112" rx="20" fill="#fff3a6" fill-opacity=".35" stroke="#ffffff" stroke-width="7"/>`,
    '0 0 128 128',
  );
}
