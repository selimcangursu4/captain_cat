/** Ekran yerleşimi (1080x1920 referans piksel). */
export const LAYOUT = {
  /** Üst bilgi alanı (başlık, ileride hamle/hedef paneli). */
  hudHeight: 360,
  /** Alt alan: yardımcı çubuğu (geliştirme modunda altında geliştirici paneli). */
  bottomHeight: 380,
  /** İçerik genişliği sınırı — yatay geniş ekranlarda tahtanın aşırı büyümesini engeller. */
  maxContentWidth: 1080,
  sideMargin: 44,
  maxCellSize: 132,
  /** Taşın hücre içindeki boyutu (hücreye oranla). */
  tileScale: 0.9,
  /** Tahta çerçevesinin hücrelerden taşma payı. */
  framePadding: 16,
  frameBorder: 7,
  frameRadius: 26,
  cellInset: 3,
} as const;

/** Ana ekran (kasaba) yerleşimi. */
export const HOME = {
  /** Bu yükseklikten fazlası boşluklara paylaştırılır. */
  referenceHeight: 1920,
  topBarY: 80,
  titleGap: 110,
  stageGap: 230,
  stageMaxWidth: 1000,
  stageMargin: 30,
  /** Üst çubuktaki üç sayacın (can, yıldız, altın) aralığı. */
  counterGap: 345,
  /** Mağaza / ayarlar simge butonları. */
  iconButtonSize: 132,
} as const;

/** Oyun ekranı üst paneli (hamle + hedefler + duraklat). */
export const HUD = {
  contentWidth: 992,
  panelHeight: 230,
  movesWidth: 230,
  gap: 20,
  goalsWidth: 602,
  pauseSize: 116,
  goalSlotWidth: 150,
  goalIconSize: 96,
  /** Bu kadar ve daha az hamle kalınca sayaç kırmızılaşır. */
  lowMoves: 5,
  /** Bir hedefe tek seferde uçan en fazla simge (fazlası doğrudan sayılır). */
  maxFlightsPerGoal: 8,
  flightStaggerMs: 40,
  flightMs: 520,
  /** Tahtanın altındaki yardımcı butonları. */
  helperSize: 150,
  helperGap: 230,
  /** Yardımcı çubuğunun tahta çerçevesinin altından uzaklığı (orta nokta). */
  helperBarOffset: 135,
} as const;
