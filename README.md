# Kaptan Pati

Liman kasabası temalı 3'lü eşleştirme (match-3) mobil oyunu. İstemci: Phaser 3 + TypeScript + Vite.
Sunucu: Node.js + Fastify + Prisma 7 + PostgreSQL (hesap, bulut kaydı, seviyeler). Android için Capacitor
Aşama 10'da, gerçek ödeme Aşama 11'de.

## İlk kurulum

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) açık olsun (yerel PostgreSQL için).
2. `npm install` (Prisma istemcisi de üretilir).
3. `.env.example` dosyasını `.env` olarak kopyalayın (geliştirme için olduğu gibi kalabilir).
4. `npm run db:up` → PostgreSQL'i başlatır (port 5433).
5. `npm run db:migrate` → tabloları oluşturur.
6. İki terminal açın: `npm run server` (oyun sunucusu, port 8787) ve `npm run dev` (oyun, port 5190).
7. http://localhost:5190 → kayıt olun. Seviyeler veritabanı boşsa sunucu ilk açılışta kendisi aktarır.

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Oyun → http://localhost:5190 (aynı ağdaki telefondan "Network" adresiyle) |
| `npm run server` | Oyun sunucusu → http://localhost:8787 (dosya değişince yeniden başlar) |
| `npm run db:up` / `db:down` | Yerel PostgreSQL'i (Docker) başlatır / durdurur. Verileri silmek: `docker compose down -v` |
| `npm run db:migrate` | Şema değişikliklerini veritabanına uygular (yeni değişiklik: `npm run db:migrate -- --name aciklama`) |
| `npm run db:seed` | `src/data/levels` seviyelerini veritabanına aktarır (yeni seviye yayınlamak için) |
| `npm run db:studio` | Prisma Studio: veritabanını tarayıcıda görüntüleme |
| `npm test` | Oyun mantığı + sunucu testleri (Vitest; sunucu testleri veritabanı gerektirmez) |
| `npm run typecheck` | TypeScript tip kontrolü (istemci + sunucu) |
| `npm run balance` | Seviye dengesi raporu: bot her seviyeyi 60 kez oynar, kazanma oranlarını yazar (200 seviyede birkaç dakika) |
| `npm run levels` | Eksik seviyeleri üretir ve hamle sayılarını botla ayarlar (bkz. "Seviye üretici") |
| `npm run build` | Üretim derlemesi → `dist/` |

`?level=3` ana ekranı atlayıp doğrudan bir seviyeyi açar (başlangıç penceresi oyun ekranında çıkar),
`?seed=123` aynı tahtayı yeniden üretir (hata bildirirken ekrandaki seviye ve tohum numarasını ekleyin).
Geliştirme modunda (sunucuda `DEV_COMMANDS=1`):

- oyun ekranının altında seviye geçişi (can harcamaz) ve "Özel Taşlar" (her güçlendiriciyi tahtaya koyar),
- mağazada gerçek ödeme yerine deneme alımı yapılır (sunucuda doğrulamasız, `sandbox`),
- tarayıcı konsolunda `__kaptan` (Phaser), `__kaptanSave` (kayıt), `__kaptanSync` (eşitleme) ve
  `__kaptanDispatch` (komut gönderme) bulunur, ör. `__kaptanDispatch({ type: 'devSetLevel', level: 20 })`.
  Kaydı doğrudan değiştirmek (`__kaptanSave.update`) sunucuya gitmez; ilk eşitlemede geri alınır.

## Mimari

```
src/core      Saf TypeScript oyun mantığı (Phaser yok) — Match3Engine, engeller, level/ (bölüm, hedef, oturum)
src/config    Tüm ayarlar (boyutlar, süreler, renkler) — sihirli sayı yok
src/assets    AssetManifest + kodla çizilen SVG'ler (PNG'ye geçiş: girdiyi { kind: 'image', url } yap)
src/ui        Phaser görünümleri: board/ (tahta, efektler), hud/, home/ (kasaba), popups/, components/
src/scenes    BootScene (dokular + açılış), AuthScene (giriş/kayıt), HomeScene (kasaba), GameScene (seviye)
src/meta      Kasaba, LevelProgress, Lives, Inventory, DailyReward, commands.ts (komut kuralları) — saf TS,
              istemci ve sunucu ortak kullanır
src/net       api (sunucu istekleri), account (giriş/kayıt/çıkış), sync (komut günlüğü + eşitleme), session
src/i18n      tr / en metinleri
src/data      levels/level-NNN.json — seviye dosyaları
src/services  SaveService (kayıt), Wallet (altın), Settings (cihaz ayarları), Audio, Haptics, Quality
server/       Oyun sunucusu: src/app.ts (HTTP uçları), prismaStore.ts (PostgreSQL), prisma/schema.prisma
tests/        Oyun testleri; server/tests/ sunucu testleri
tools/        Denge botu (npm run balance), seviye üretici (npm run levels, tools/levelgen/)
```

Ekran akışı: açılış → (oturum yoksa giriş/kayıt) → ana ekran (kasaba; günün ilk girişinde günlük ödül) → "Oyna" → yeni açılan
eşyaların tanıtımı → bölüm başlangıç penceresi (hedefler + güçlendirici seçimi) → bölüm →
kazan/kaybet → ana ekran. Yeni bir bölümü kazanınca +1 yıldız, kasabaya malzeme ve altın gelir;
yıldızlar Pazar'da malzemeye, malzemeler kasabadaki inşaatlara harcanır.

Akış: girdi → `Match3Engine.trySwap()` / `activateAt()` sonucu anında hesaplar ve bir olay
listesi döndürür → `StepPlayer` + `BoardView` bu olayları sırayla oynatır. Her zincir adımı:

1. **dalga 0** — eşleşen taşlar kırılır; 4'lü/5'li/L-T/2x2 eşleşmede güçlendirici doğar
2. **dalga 1, 2, …** — güçlendirici etkileri; etki alanındaki güçlendiriciler bir sonraki dalgada patlar
3. taşlar düşer, yenileri gelir

Geliştirme modunda her hamleden sonra görünüm ile mantığın birebir aynı olduğu kontrol
edilir (uyuşmazlık konsola yazılır).

## Güçlendiriciler

| Eşleşme | Güçlendirici | Etki |
|---|---|---|
| 4'lü düz | Harpun | Satır (yatay kaydırma) veya sütun (dikey) |
| L / T | Gülle | 3x3 |
| 5'li düz | Girdap (renksiz) | Değdiği rengin tüm taşları |
| 2x2 kare | Martı | 4 komşu + uçtuğu hedef |

Kombinasyonlar (iki güçlendiriciyi birbirine kaydır): Harpun+Harpun artı, Gülle+Gülle 5x5,
Harpun+Gülle 3 satır + 3 sütun, Girdap+güçlendirici o renkteki taşları güçlendiriciye çevirip
patlatır, Girdap+Girdap tüm tahta, Martı+Harpun/Gülle hedefe taşır, Martı+Martı 3 martı.
Güçlendiriciye tek dokunuş da tetikler. Ayarlar: `src/config/specials.ts`.

## Engeller

| Engel | Katman | Hasar alır | Not |
|---|---|---|---|
| Yosun | zemin (taşın altı) | üstündeki taş eşleşince, güçlendirici | 1-2 katman |
| Ağ | örtü (taşın üstü) | içindeki taş eşleşince, yanında eşleşme, güçlendirici | taş kaydırılamaz ve düşmez |
| Kum torbası | blok | yanında eşleşme, güçlendirici | 1-3 katman |
| Kilitli sandık | blok | yanında eşleşme, güçlendirici | açılınca altın verir |
| Martı yuvası | blok | yanında eşleşme, güçlendirici | her vuruşta 1 martı (hedef) |

Blok engellerin altındaki kareler, yandaki sütunlardan çapraz kayan taşlarla dolar.
Yeni engel: `src/core/obstacles.ts` içine bir tanım + `AssetManifest`'e görseli.

## Bölüm dosyası (`src/data/levels/level-NNN.json`)

```jsonc
{
  "id": 5,                                   // dosya sırasıyla aynı, 1'den başlar
  "moves": 25,
  "colors": ["fish", "anchor", "shell", "ring", "star"],
  "board": ["xxxxxxxx", "xx....xx", ...],    // isteğe bağlı (varsayılan 8x8); x kare, . boşluk
  "floor": ["..12....", ...],                 // yosun: 1-2 katman
  "cover": ["...n....", ...],                 // ağ
  "block": ["1.2..c.b", ...],                 // kum torbası 1-3, c sandık, b martı yuvası
  "tiles": ["F.......", ...],                 // isteğe bağlı sabit taşlar: F A S R T
  "specials": [{ "at": [0, 0], "kind": "harpoon-h" }],
  "goals": [
    { "type": "color", "color": "fish", "count": 20 },
    { "type": "obstacle", "kind": "moss" },   // count yazılmazsa: tahtadakilerin hepsi
    { "type": "seagull", "count": 8 }
  ],
  "seed": 42,                                 // isteğe bağlı: hep aynı tahta (öğretici bölümler)
  "tutorial": [                               // isteğe bağlı öğretici adımları (metinler i18n anahtarı)
    {"text": "tut.harpoon.make", "swap": [[2, 2], [3, 2]], "expect": {"creates": "harpoon-v"}},
    {"text": "tut.harpoon.use", "tap": "harpoon-v"},
    {"text": "tut.combo", "swapSpecials": true},
    {"text": "tut.whirlpool.use", "swapSpecialWith": "whirlpool", "color": "fish"},
    {"text": "tut.goals"}                      // yalnızca mesaj: oyuncu dokununca kapanır
  ]
}
```

Öğretici adımında tahta kararır, ilgili kareler aydınlanır, el işareti hamleyi gösterir ve
yalnızca o hamle kabul edilir. Güçlendirici adımları tahtanın o anki durumuna göre çözülür
(ör. "harpuna dokun" harpun neredeyse onu gösterir). `npm test`, her öğreticinin kayıtlı
tohumuyla baştan sona oynanabildiğini ve `expect` sonuçlarını doğrular.

## Seviyeler

Her bölüm bir seviyedir (arayüzde "Seviye N").

| Seviye | İçerik |
|---|---|
| 1-10 | Öğretici (elle): eşleştirme, Harpun, Gülle, Martı, Girdap, kombo, yosun, ağ, kum torbası, sandık + yuva |
| 11-20 | Elle: mekaniklerin karışımı; boşluklu tahtalar, çok katmanlı engeller |
| 21-30 | Elle: 9x9 tahtalar, kapalı bölgeler, çok hedefli seviyeler |
| 31-200 | Seviye üreticisiyle: yedi seviye türü, kademeli zorluk, her 10 seviyede zor bir "sandık seviyesi" |

Hamle sayıları bot ölçümüyle ayarlanır ("sıradan" bot hamlelerin %40'ında rastgele oynar).
Seviye değiştirince `npm run balance` ile kontrol edin. Hatalı dosyalar açık bir mesajla reddedilir
(ör. `Bölüm 5: "block" satır 2, sütun 3: bilinmeyen kod 'z'`); `npm test` tüm seviyelerin geçerli
ve oynanabilir başladığını kontrol eder.

### Seviye ödülleri (`src/config/levels.ts`)

- Yeni bir seviyeyi ilk kez geçince: +1 yıldız, +1 can (ödül canları 5 sınırını aşıp 10'a kadar
  birikebilir; 5'in üstündeyken yenilenme sayacı işlemez) ve seviye altını.
- Her 10 seviyede hediye sandığı: altın (100'den başlar, her sandıkta +20, en çok 500) ve sırayla
  eşya ikilileri (yalnızca açılmış eşyalar). Her 50 seviyede büyük sandık (iki katı).
- Sandık kasabaya dönünce açılır; ana ekrandaki çubuk sıradaki hediye seviyesini gösterir.

### Seviye üretici (`npm run levels`)

`tools/levelgen/` 30. seviyeden sonrasını üretir. `plan.ts` içindeki `TARGET_LEVELS` (şu an 200)
artırılıp komut çalıştırılınca yalnızca **eksik** seviye dosyaları yazılır; var olanlara (elle
düzeltilmişler dahil) dokunulmaz.

- **Zorluk eğrisi:** genel ilerleme yavaşça artar. 10'luk bloklarda dalga vardır: 10'un katları
  (sandık seviyeleri) zor, 6 ile bitenler rahatlatıcı.
- **Seviye türleri:** renk toplama, yosun, kum torbası, ağ, sandık, martı yuvası, karışık. Her 10'luk
  blokta karışık sırayla gelir. Tahtalar ve engel desenleri simetriktir; tüm satırı kapatan duvar
  ya da bağlantısız tahta üretilmez.
- **Ayar:** önce güçlü bot seviyenin kazanılabildiğini doğrular. Sonra hamle sayısı, sıradan botun
  kazanma oranı hedefe ulaşana kadar ikili aramayla bulunur ve bağımsız bir tohum setiyle
  doğrulanır (gerekirse hamle eklenir). En zor seviyede bile hedef en az %50'dir. 15-40 hamle
  aralığına girmeyen seviye başka bir tohumla yeniden üretilir.
- **Seçenekler (PowerShell):**
  - `$env:LEVELS_TO='60'` yalnızca 60'a kadar üretir.
  - `$env:LEVELS_FORCE='1'` var olanları da yeniden üretir.
  - `$env:LEVELS_RETUNE='100,119'` (ya da `'all'`) tasarıma dokunmadan yalnızca hamle sayısını
    yeniden ayarlar; elle düzeltilen seviyeler için de kullanılabilir.
- Üretilen dosyalar elle yazılmışlarla aynı biçimdedir; istenirse elle düzeltilebilir.

## Kasaba

5 bölge sırayla açılır: Deniz Feneri → İskele → Balıkçı Dükkânı → Kafe → Kaptan'ın Gemisi.
Her bölgede 5-8 görev vardır ve bölge içinde sırayla yapılır.

- **Görev = malzeme + süre.** Her görevin bir tarifi vardır (ör. "Kapıyı yerleştir": 10 odun + 5 çivi) ve
  inşaatı belli bir süre sürer (fener: 1-15 dk, iskele: 15 dk-1 sa … gemi: 2-8 sa). Aynı anda tek inşaat yapılır.
- **Bölge kilidi:** bölgenin bütün inşaatları bitmeden (süreleri dolmadan) sıradaki bölge açılmaz; yeterli
  malzeme/yıldız olsa bile beklemek gerekir.
- **Hızlandırma (zaman atlama):** beklemek istemeyen altınla hemen bitirir. Bedel kalan süreye göre artar
  (≈1 dk: 10, 1 sa: 265, 2 sa: 465 altın); son 30 saniye ücretsizdir. Süre dolunca inşaat kendiliğinden biter.
- **Eksik malzeme:** inşaat penceresinde eksikler yıldızla ya da doğrudan altınla tek dokunuşla tamamlanır.
- Süren inşaat kasaba sahnesinde iskele, sallanan çekiç ve geri sayımla görünür; dokununca hızlandırma penceresi açılır.
- Her görevin 3 tasarımı vardır: Klasik, Okyanus, Gün Batımı. Bitmiş bir parçaya dokunarak (veya görev
  listesinden "Değiştir" ile) tasarım ücretsiz değiştirilir.
- **Liman haritası:** ana ekran bölgeleri adacıklar üzerinde, aralarında kıvrılan bir rotayla gösterir
  (bitmiş ✓, şu anki bölge nabız atar ve ilerlemesi/süren inşaatı görünür, kilitliler gri). Bir bölgeye
  dokununca o bölgenin sahnesi açılır: eski bölgelerde yapılanlar, şu anki bölgede süren inşaat; ◀ Harita ile dönülür.
- Her inşaat bitince Kaptan Pati komik bir replik söyler; bölge bitince sandık açılır, altın verilir ve
  haritada sıradaki bölgeye giden rota açılır.

Malzemeler: odun, taş, çivi, halat, boya, cam, kumaş. Tarifler ve süreler: `src/meta/town.ts`.
Bölge çizimleri: `src/assets/svg/town/`.

Bölge dokuları yalnızca o bölge gösterilirken üretilir ve başka bölgeye geçince bellekten
silinir (`lazy` manifest girdileri), böylece 96 parça görseli açılışı yavaşlatmaz.

## Ekonomi

Tüm sayılar `src/config/economy.ts`, fiyat formülleri `src/meta/pricing.ts` içindedir.

```
Gerçek para ──(Mağaza)──▶ Altın ──(Pazar: takas)──▶ Yıldız ──(Pazar)──▶ Malzeme ──▶ İnşaat
                            │                          ▲                   ▲
                            │                    seviye geçmek       seviye, sandık
                            ├──▶ can, ek hamle, güçlendirici, sandık, gemi yükseltmesi
                            └──▶ inşaatı hızlandırma, eksik malzemeyi doğrudan tamamlama
```

**Yeni seviye ödülü:** +1 yıldız, kasabanın o an en çok ihtiyaç duyduğu malzemeden 3 adet (sıradaki
görevde en çok eksik olan), +1 can, bölüm altını (20 + kalan hamle başına 3 + sandıklar) ve kumbaraya 25 altın.

**Can:** zamanla en fazla 5'e kadar dolar; seviye ödülü canlarıyla 10'a kadar birikebilir. Seviyeye
başlarken 1 can harcanır, kazanınca geri verilir; can yalnızca kaybedince ya da seviyeden çıkınca gider.
5'in altındaysa her 20 dakikada 1 can gelir (oyun kapalıyken de). Altınla +1 can (50) ya da tam doldurma (200).

**Ek hamle:** hamleler bitince +5 hamle; aynı denemede her alımda fiyat artar (100, 150, 200…).

**Eşyalar:** her biri bir bölümde açılır ve açılınca 3 adet hediye edilir; bitince altınla alınır.

| Eşya | Tür | Etki | Açılış | Paket (3) | Tek |
|---|---|---|---|---|---|
| Kürek | bölüm içi | seçilen tek kareyi kırar | 11 | 150 | 60 |
| Dümen | bölüm içi | dokunulan satırı temizler | 12 | 200 | 80 |
| Fırtına | bölüm içi | tahtayı karıştırır | 13 | 100 | 40 |
| Harpun | bölüm öncesi | tahtada hazır Harpunla başlanır | 14 | 150 | 60 |
| Gülle | bölüm öncesi | tahtada hazır Gülleyle başlanır | 15 | 150 | 60 |
| Girdap | bölüm öncesi | tahtada hazır Girdapla başlanır | 16 | 200 | 80 |

**Pazar** (ana ekranda tezgâh simgesi; yıldız sayacındaki "+" de açar), dört sekme:

- **Malzeme:** her malzeme yıldızla; büyük pakette %20 fazlası (ör. 1 ⭐ = 6 odun, 5 ⭐ = 36 odun).
- **Yıldız:** altınla yıldız (1 ⭐ = 120, 5 ⭐ = 550, 15 ⭐ = 1500 altın).
- **Sandık:** Kaptan (250), Hazine (750), Efsane (2000) sandıkları: malzeme, altın, güçlendirici, can,
  yıldız çıkar. Sonuç kayıttaki tohumla belirlenir: istemci ve sunucu aynı ödülü bulur, sandık "baştan
  açılarak" seçilemez.
- **Gemi atölyesi** (kalıcı, altınla): Gövde (bölüm altınına +%10/20/30), Ambar (seviye başına +1/2/3
  malzeme), Motor (bölüme 1/2 hazır güçlendiriciyle başla).

**Mağaza:** yalnızca gerçek parayla altın satılır (6 paket) ve kumbara: her yeni seviyede 25 altın biriktirir
(en çok 1500); en az 500 birikince gerçek parayla kırılır.

**Günlük ödül:** 7 günlük takvim (altın, eşya, yıldız). Günde bir kez; art arda gelinirse sıradaki güne,
bir gün atlanırsa 1. güne dönülür.

### Gerçek para (RevenueCat)

Altın komutla yazılamaz; ödemeyi sunucu doğrular:

1. Telefonda RevenueCat hesap kimliğiyle kurulur (`appUserID` = hesap) ve ürün mağazadan satın alınır.
2. İstemci işlem kimliğini `POST /purchases` ile gönderir; sunucu ödemeyi RevenueCat REST API'den
   (gizli anahtar `REVENUECAT_SECRET_KEY`) doğrular, altını esas kayda işler ve işlemi `Purchase`
   tablosuna yazar. Aynı işlem ikinci kez altın vermez.
3. Sunucuya ulaşılamazsa ödeme telefonda saklanır; bağlantı gelince, uygulama öne gelince ve mağaza
   açılınca yeniden gönderilir.

Yapılandırma: istemcide `VITE_REVENUECAT_ANDROID_KEY` / `VITE_REVENUECAT_IOS_KEY` (genel anahtarlar),
sunucuda `REVENUECAT_SECRET_KEY`. Ürün kimlikleri `ECONOMY.shop` ve `ECONOMY.piggyBank.productId`
ile aynı olmalı (Google Play'de tek seferlik, tüketilebilir ürün). Tarayıcıda (geliştirme) mağaza yoktur:
sunucu `DEV_COMMANDS=1` iken deneme alımı yapılır.

## Ayarlar, ses ve titreşim

Ayarlar (ana ekranda çark): ses efektleri, müzik, titreşim, dil (Türkçe / English) ve hesap
(eşitleme durumu, çıkış, **Kaydı Sıfırla** — onay ister, bütün ilerlemeyi siler). Duraklat
penceresinde de ses, müzik ve titreşim anahtarları vardır. Dil seçilmediyse cihaz dili kullanılır
(Türkçe değilse İngilizce). Dil değişince ana ekran yeni dille yeniden çizilir.

- Titreşim Vibration API ile yapılır (büyük kombolar, kazanma); Capacitor aşamasında
  `src/services/Haptics.ts` içi Haptics eklentisine çevrilebilir.

## Ses ve müzik

Tüm sesler `src/assets/SoundManifest.ts` üzerinden çalınır (görseller için AssetManifest neyse
sesler için o). Şimdilik hepsi yer tutucudur ve dosyasızdır: Web Audio ile üretilen tonlar ve
gürültü (`src/assets/audio/sfx.ts`), kodla yazılmış iki müzik parçası (`src/assets/audio/songs.ts`:
kasaba 90 BPM, bölüm 116 BPM; akor, bas, arpej, melodi, hafif davul).

Gerçek sese geçiş: ilgili girdiyi `{ kind: 'file', url: 'assets/sfx/match.mp3' }` yapmak yeterli;
müzik için de aynı (`MUSIC_MANIFEST`). Oyun kodu yalnızca anahtarı bilir (`audio.play('match')`).

- Olaya özel sesler: kaydırma, geri dönen kaydırma, eşleşme (zincir ilerledikçe perde yükselir),
  düşme, güçlendirici doğuşu, her güçlendirici ve yardımcının kendi sesi, her engelin kırılma sesi,
  hedef toplama, kombo yazısı, altın, yıldız, kazanma, kaybetme, inşa, yeni eşya, pencere açılışı.
- Ses efektleri ve müzik ayrı kanallardadır; ayarlardan ayrı ayrı kapatılır, müzik yumuşakça
  söner/açılır. Tarayıcı sesi ilk dokunuşta açar; uygulama arka plana geçince ses tamamen durur.

## Geri bildirim ve animasyon

- Zincirleme kombo yazıları: "Güzel!", "Harika!", "Muhteşem!", "İnanılmaz!". Eşikler (zincir
  adımı ya da kırılan taş sayısı) `src/config/feedback.ts` içindedir.
- Bölüm girişinde taşlar sütun sütun tahtaya dökülür; güçlendiriciler tahtada hafifçe sallanır,
  doğarken parlak bir halka genişler.
- Az hamle kalınca hamle paneli nabız atar.
- Bölüm sonu kutlamasında kalan hamleler üçer üçer birlikte patlar ve animasyon hızlanır;
  ekrana dokunulursa kalan kutlama animasyonsuz hesaplanır.
- Kazanınca konfeti ve dönen ışık. Ana ekranda kazanılan yıldız sayaca uçar; günlük ödül ve
  bölge sandığındaki altınlar sayaca akar; görev yapılırken harcanan yıldızlar parçaya uçar.

## Performans

- Açılışta yalnızca arka plan ve Kaptan Pati çizilip açılış ekranı hemen başlar; diğer dokular
  bu sırada üretilir (ilerleme çubuğu).
- Kombo yazıları sahne açılırken bir kez çizilip yeniden kullanılır (oyun sırasında yazı dokusu
  üretmek yavaş telefonda kare atlatır).
- Kalite izleyicisi: FPS 3 saniye boyunca 45'in altında kalırsa parçacıklar yarıya iner
  (`src/services/Quality.ts`).
- Geliştirme modunda `?fps` sol üstte anlık FPS gösterir (telefonda denemek için:
  `http://<bilgisayar-ip>:5190/?fps`).
- Ölçüm (masaüstü Chrome, CPU 4 kat yavaşlatılmış ≈ orta seviye telefon): kare başına 4-6
  çizim çağrısı; büyük kombolarda bile karelerin %95'i 14 ms altında.

## Hesap, sunucu ve eşitleme

**Hesap zorunludur** (misafir yok): oyun ilk açılışta kayıt (kaptan adı, e-posta, şifre) ya da giriş
ister; bunun için o an internet gerekir. Oturum telefonda saklanır; sonraki açılışlarda oyun
**internetsiz de açılır ve oynanır**. Çıkış ayarlardan yapılır; kaydedilmemiş ilerleme varken internetsiz
çıkışa izin verilmez (ilerleme kaybolmasın).

**Komutlar** (`src/meta/commands.ts`): ekonomiyi değiştiren her işlem bir komuttur. Komutlar: seviyeye
başla, kazan, kaybet, ek hamle, yardımcı kullan, eşya al, can al, günlük ödül, inşaat başlat / bitir /
hızlandır, eksik malzemeyi tamamla, tasarım değiştir, malzeme / yıldız al, sandık aç, gemi yükselt,
kaydı sıfırla, eşya aç.

- İstemci komutu hemen yerelde uygular ve telefondaki günlüğe yazar.
- Sunucu aynı komutları **aynı kural koduyla** hesabın esas kaydında yeniden oynatır. Kural tek yerde
  olduğu için istemci ile sunucu ayrışmaz.
- Eşitleme: günlük `POST /sync` ile gider. Sunucu esas kaydı döndürür; istemci kendi kaydını onunla
  değiştirir ve istek sürerken yapılan yeni komutları üstüne yeniden uygular. İki cihazda oynansa da
  çakışma olmaz.
- Eşitleme zamanları: her komuttan kısa süre sonra, açılışta, internet gelince, uygulama öne gelince
  ve bekleyen komut varken düzenli aralıklarla. Çevrimdışıyken artan aralıklarla yeniden denenir.

**Hile önleme:** sunucu kurala uymayan komutu reddeder; reddedilen komut kayda girmez, istemci de
sunucunun kaydına döner. Kurallar:

- Açık bir seviye denemesi olmadan "kazandım" denemez ve kazanç en az 3 saniye sürmelidir.
- Seviye başına altın sınırı vardır: bölüm altını, her hamle için bonus, sandıklar ve satın alınan
  ek hamleler dikkate alınır.
- Açılmamış seviye oynanamaz; can, altın ya da eşya yetmiyorsa işlem yapılamaz.
- Telefon saati ileri alınarak can üretilemez, inşaat bitirilemez: sunucu saatinden 5 dakikadan ileri komut reddedilir.
- Saat geri alınarak inşaat geçmişte başlatılamaz: kaydın saati (son komut / son eşitleme anı) geriye gitmez.
- Altın yalnızca doğrulanmış ödemeyle gelir (`POST /purchases`); bölüm altınındaki gemi bonusunu kural ekler.
- Günlük ödül oyuncunun saat diliminde günde bir kez alınır.
- Telefondaki kaydı elle değiştirmek işe yaramaz: ilk eşitlemede sunucunun kaydı geri gelir.
- Her komut (kabul/ret ve nedeni) `GameEvent` tablosuna yazılır.

**Güvenlik:**

- Şifreler scrypt ile tuzlanıp özetlenir; düz metin saklanmaz.
- Oturum belirtecinin yalnızca SHA-256 özeti saklanır. Oturum 90 gündür ve her kullanımda uzar.
- Kaba kuvvete karşı deneme sınırı var: IP başına saatte 5 kayıt, IP ve e-posta başına 10 dakikada
  10 giriş. Sınırlar `.env` ile değiştirilebilir.
- Olmayan hesapla girişte de aynı süre harcanır; yanıt süresi e-postanın kayıtlı olup olmadığını
  ele vermez.

**HTTP uçları:**

| Uç | Açıklama |
|---|---|
| `POST /auth/register` | Kayıt → belirteç + hesap |
| `POST /auth/login` | Giriş → belirteç + hesap |
| `POST /auth/logout` | Oturumu kapatır |
| `GET /me` | Hesap bilgisi |
| `GET /save` | Esas kayıt |
| `POST /sync` | Komutları gönderir, esas kaydı alır |
| `POST /purchases` | Mağaza ödemesini doğrular, altını kayda işler |
| `GET /levels?after=N` | Pakette olmayan yeni seviyeler |
| `GET /health` | Sağlık |

**Veritabanı tabloları:**

| Tablo | İçerik |
|---|---|
| `User` | Hesap |
| `Session` | Oturum |
| `GameSave` | Esas kayıt (JSON); sıralama için seviye, yıldız ve altın ayrı sütunlarda |
| `GameEvent` | Komut günlüğü |
| `Purchase` | Doğrulanmış ödemeler (işlem kimliği tek) |
| `Level` | Seviyeler |

**Yeni seviye yayınlama (uygulama güncellemeden):**

1. `npm run levels` ile seviye dosyalarını üretin.
2. `npm run db:seed` ile veritabanına aktarın.

Sunucu yeni seviyeleri 5 dakika içinde tanır. Oyuncular bağlandıklarında indirir; seviyeler telefonda
önbelleğe alınır, sonra internetsiz de oynanır.

## Kayıt sistemi

`SaveService`, oyuncunun ilerlemesini tek bir sürümlü JSON belgesi olarak tutar: seviye, yıldız, altın,
malzemeler, kasaba (süren inşaat dahil), gemi, istatistikler, can, eşyalar, günlük ödül, açık seviye
denemesi, kumbara, sandık tohumu ve kaydın saati (sürüm 6; sürüm 4-5'teki tek tür malzeme 25'te 1 yıldıza çevrilir).

- Her hesabın telefondaki kaydı ayrı anahtardadır (`kaptan-pati/save/<hesap>`). Gönderilmemiş komutlar
  da ayrı tutulur (`kaptan-pati/journal/<hesap>`); uygulama kapanıp açılsa da kaybolmaz.
- Ses, müzik, titreşim ve dil ayarları cihaza özgüdür ve sunucuya gitmez (`kaptan-pati/settings`).
- Depo `SaveStorage` arayüzünün arkasındadır: tarayıcıda localStorage, sunucuda ve testlerde bellek.
- Bozuk veya eski kayıtlar `migrate()` ile onarılır: geçersiz alanlar varsayılana döner, oyun çökmez.
- Kayıt biçimi değişirse `SAVE_VERSION` artırılır ve `migrate()` içine dönüşüm eklenir.
