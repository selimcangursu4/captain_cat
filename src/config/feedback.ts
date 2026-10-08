/** Oyuncuya geri bildirim: kombo yazıları, zincir sesleri, kalite ayarı. */
export const FEEDBACK = {
  /**
   * Kombo yazısı seviyeleri ("Güzel!" → "İnanılmaz!"). Bir hamlede zincir adımı (0 = oyuncunun
   * eşleşmesi) ya da o ana kadar kırılan taş sayısı eşiği geçince yazı çıkar; her seviye bir kez.
   */
  comboTiers: [
    { step: 2, cleared: 15 },
    { step: 3, cleared: 25 },
    { step: 5, cleared: 40 },
    { step: 7, cleared: 60 },
  ],
  comboColors: ['#8ef59b', '#ffd23f', '#ff9a3d', '#ff6fb5'],
  comboStroke: '#3a1d00',
  comboFontSize: 108,
  /** Zincirde her adımda eşleşme sesi bu kadar yarım ses yükselir (en çok maxPitch). */
  cascadePitchStep: 2,
  maxCascadePitch: 12,
  /** Kalite: FPS bu değerin altında bu kadar saniye kalırsa parçacıklar azaltılır. */
  lowFpsThreshold: 45,
  lowFpsSeconds: 3,
  lowQualityParticleScale: 0.5,
} as const;
