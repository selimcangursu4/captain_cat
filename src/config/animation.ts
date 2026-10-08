/** Animasyon süreleri (ms) ve yumuşatma eğrileri. */
export const ANIM = {
  swapMs: 170,
  swapEase: 'Sine.easeInOut',
  nudgeMs: 90,
  nudgeDistance: 0.18, // hücre oranı

  clearMs: 190,
  clearPeakScale: 1.22,
  particlesPerTile: 9,

  /** Düşüş: n. adımın bittiği an = fallTickMs * n^fallTickExponent (üs < 1 → giderek hızlanır). */
  fallTickMs: 105,
  fallTickExponent: 0.72,
  landBounceMs: 95,
  landBounceHeight: 0.07, // hücre oranı
  landSquash: 0.1,

  stepPauseMs: 40,

  shuffleGatherMs: 260,
  shuffleSpreadMs: 380,
  shuffleBannerMs: 900,

  hintNudge: 0.16, // hücre oranı
  hintMs: 380,
  hintRepeatDelayMs: 700,
  hintPulseScale: 1.08,

  selectPulseScale: 1.06,

  /** Bölüm girişi: taşlar sütun sütun tahtaya düşer. */
  introDropMs: 460,
  introColStaggerMs: 45,
  introRowStaggerMs: 22,
  /** Güçlendiricilerin bekleme sallanması (derece) ve süresi. */
  idleSwingAngle: 5,
  idleSwirlAngle: 12,
  idleSwingMs: 900,
  /** Güçlendirici doğarken genişleyen halka. */
  createRingMs: 340,
  /** Bölüm sonu kutlaması: aynı anda patlayan hamle sayısı ve animasyon hız çarpanı. */
  celebrationBatch: 3,
  celebrationSpeed: 1.6,

  // ── güçlendiriciler ──
  /** Eşleşen taşların güçlendirici karesinde birleşmesi. */
  mergeMs: 150,
  createPopMs: 280,
  /** Zıpkının bir kare ilerleme süresi (taşlar zıpkın geçerken kırılır). */
  harpoonMsPerCell: 30,
  /** Gülle: her halka arası gecikme ve şok dalgası süresi. */
  cannonMsPerRing: 55,
  shockwaveMs: 340,
  /** Girdap: dönüş, ışın ve hedefler arası gecikme. */
  swirlMs: 650,
  beamMs: 130,
  beamStaggerMs: 22,
  convertPopMs: 180,
  /** Girdap + Girdap: tahtanın dalga dalga temizlenmesi. */
  boardWipeMsPerRing: 45,
  /** Martı uçuşu ve kalkış alanı. */
  seagullFlightMs: 520,
  seagullArc: 1.6, // hücre oranı: uçuş yayının yüksekliği
  launchMsPerCell: 40,
  /** Yardımcılar: Kürek'in kareye inişi, Dümen'in satır boyunca bir kare ilerleme süresi. */
  shovelStrikeMs: 230,
  helmMsPerCell: 55,
  /** Bölüm öncesi güçlendiricinin tahtaya uçuşu. */
  boosterFlightMs: 480,
  /** Ekran sarsıntısı (büyük kombolarda). */
  shakeSmall: { ms: 120, intensity: 0.004 },
  shakeBig: { ms: 280, intensity: 0.012 },
} as const;
