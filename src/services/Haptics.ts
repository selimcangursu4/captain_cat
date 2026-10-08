import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { settings } from './Settings';

/** Titreşim süreleri (ms). Capacitor'da Impact ve Vibrate kullanılır. */
export const HAPTICS = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
} as const;

/**
 * Titreşim. Capacitor Haptics eklentisi kullanılır.
 */
export async function vibrate(strength: keyof typeof HAPTICS): Promise<void> {
  if (!settings.vibration) return;
  try {
    const style = HAPTICS[strength];
    await Haptics.impact({ style });
  } catch {
    //
  }
}
