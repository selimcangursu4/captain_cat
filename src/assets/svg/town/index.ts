import type { RegionId } from '../../../meta/town';
import { CAFE } from './cafe';
import type { RegionArt } from './common';
import { FISH_SHOP } from './fishShop';
import { LIGHTHOUSE } from './lighthouse';
import { PIER } from './pier';
import { SHIP } from './ship';

export { STAGE, THEME_PALETTES, backgroundSvg, partSvg, type PartArt, type RegionArt } from './common';

export const REGION_ART: Readonly<Record<RegionId, RegionArt>> = {
  lighthouse: LIGHTHOUSE,
  pier: PIER,
  fishShop: FISH_SHOP,
  cafe: CAFE,
  ship: SHIP,
};
