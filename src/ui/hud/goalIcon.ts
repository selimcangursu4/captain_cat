import { TEXTURES, obstacleTexture, tileTexture } from '../../assets/AssetManifest';
import type { GoalDefinition } from '../../core';

/** Hedefin panelde (ve uçan simgede) kullanılan dokusu. */
export function goalIconTexture(goal: GoalDefinition): string {
  switch (goal.type) {
    case 'color':
      return tileTexture(goal.color);
    case 'obstacle':
      return obstacleTexture(goal.kind, 1);
    case 'seagull':
      return TEXTURES.flyingSeagull;
  }
}
