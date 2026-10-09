# Yayın kontrol listesi (Google Play + App Store)

Bu liste, mağaza incelemesinde ret almamak için **kodun dışında** yapılması gerekenleri sırayla verir.
Kod tarafındaki zorunluluklar (aşağıda "Kodda hazır") tamamlandı.

> Hiçbir mağaza onayı önceden garanti etmez; inceleme insan tarafından yapılır. Aşağıdakiler bilinen
> ret nedenlerinin hepsini kapatır. Ret gelirse gerekçesini (guideline numarasıyla) bana ilet.

## Kodda hazır

| Konu | Mağaza kuralı | Nerede |
|---|---|---|
| Misafir olarak oynama (kişisel bilgi zorunlu değil) | App Store 5.1.1(v) | Giriş ekranı → "Misafir olarak oyna" |
| Uygulama içinden hesap silme | App Store 5.1.1(v), Google Play hesap silme | Ayarlar → Hesap → Hesabımı Sil |
| Web'den hesap silme bağlantısı | Google Play hesap silme | `https://SUNUCU/delete-account` |
| Gizlilik politikası (uygulama içinde ve web'de) | Her iki mağaza | `https://SUNUCU/privacy` · giriş ekranı ve Ayarlar |
| Kullanım koşulları, destek sayfası | App Store destek URL'si | `/terms`, `/support` |
| Sandık olasılıkları satın almadan önce | App Store 3.1.1, Google Play | Pazar → Sandık kartları (%) |
| Gerçek para yalnızca mağaza ödemesiyle, sunucu doğrular | App Store 3.1.1, Play Billing | Mağaza (RevenueCat) |
| Telefonda yalnızca mağazanın yerel fiyatı | App Store 3.1.1 | Mağaza düğmeleri |
| iOS'ta başka platform adı geçmez | App Store 2.3.10 | Mağaza notu platforma göre |
| Gerçek simge ve açılış görseli | App Store 2.3 / Play kalite | `npm run assets` |
| Yayında yalnızca HTTPS (düz HTTP kapalı) | Her iki mağaza | `capacitor.config.ts`, debug'a özel izin |
| Hedef API 36, 16 KB sayfa (yerel kütüphane yok) | Google Play | `android/variables.gradle` |
| İmzalı .aab, sürüm package.json'dan | Google Play | `npm run android:release` |
| Gizlilik bildirimi (Privacy Manifest), şifreleme beyanı, yalnızca iPhone/dikey | App Store | `ios/App/App/PrivacyInfo.xcprivacy`, `Info.plist` |
| Çentik/çubuk altına taşmayan arayüz | App Store 4.0 | `index.html` güvenli alan |

## 1. Sunucuyu yayına al (ikisi için de zorunlu)

İnceleme sırasında oyun sunucuya bağlanabilmeli; aksi halde "uygulama çalışmıyor" (2.1) reddi gelir.

1. **Render (hazır):** [tek tıkla kurulum](https://render.com/deploy?repo=https://github.com/selimcangursu4/captain_cat) →
   `render.yaml` sunucuyu (Docker) ve PostgreSQL'i Frankfurt'ta birlikte kurar; adres `https://kaptan-pati-server.onrender.com` gibi olur.
   İncelemeden önce web servisini **Starter**, veritabanını **Basic** plana geçir (ücretsiz plan uyur ve 30 günde silinir).
   Başka bir barındırma (Railway, Fly.io, VPS) da olur: sunucu `Dockerfile` ile çalışır.
2. Render dışında kuruyorsan yönetilen bir PostgreSQL oluştur.
3. Sunucu ortam değişkenleri (`.env.example`):
   - `DATABASE_URL` = yayın veritabanı
   - `DEV_COMMANDS=0` (**mutlaka**; açık kalırsa hile komutları ve doğrulamasız alım açılır)
   - `CORS_ORIGINS=https://localhost,capacitor://localhost`
   - `SUPPORT_EMAIL` = gerçek destek adresin, `OPERATOR_NAME` = adın ya da şirketin
   - `REVENUECAT_SECRET_KEY` = RevenueCat gizli anahtarı (sk_…)
4. Tarayıcıdan kontrol et: `https://SUNUCU/health`, `https://SUNUCU/privacy`, `https://SUNUCU/delete-account`.

## 2. RevenueCat ve ürünler

Ürün kimlikleri (her iki mağazada aynı, **tüketilebilir / consumable**):

| Kimlik | İçerik |
|---|---|
| `com.kaptanpati.game.coins_500` | 500 altın |
| `com.kaptanpati.game.coins_1200` | 1.200 altın |
| `com.kaptanpati.game.coins_2500` | 2.500 altın |
| `com.kaptanpati.game.coins_5500` | 5.500 altın |
| `com.kaptanpati.game.coins_12000` | 12.000 altın |
| `com.kaptanpati.game.coins_30000` | 30.000 altın |
| `com.kaptanpati.game.piggy_bank` | Kumbara (içindeki altın, en az 500) |

1. RevenueCat'te proje aç; Google Play ve App Store uygulamalarını bağla (Play: servis hesabı JSON, Apple: In-App Purchase anahtarı).
2. Ürünleri iki mağazada da oluştur ve RevenueCat'e ekle.
3. Genel SDK anahtarlarını `.env.production.local` dosyasına yaz (`.env.production.example`'dan kopyala):
   `VITE_API_URL=https://SUNUCU`, `VITE_REVENUECAT_ANDROID_KEY=goog_…`, `VITE_REVENUECAT_IOS_KEY=appl_…`

## 3. Google Play

1. `npm run android:release` → `android/app/build/outputs/bundle/release/app-release.aab`
   (yükleme anahtarı `android/upload-keystore.jks` + `android/keystore.properties` üretildi: **ikisini de yedekle**).
2. Play Console → Uygulama oluştur (Oyun, Ücretsiz, Türkçe varsayılan dil).
3. "Play Uygulama İmzalama"yı kabul et, .aab'yi önce **Dahili test** kanalına yükle; kendi telefonunda satın almayı test et.
4. Formlar: [GOOGLE-PLAY.md](GOOGLE-PLAY.md) (Veri güvenliği, içerik derecelendirmesi, hedef kitle, reklam, uygulama erişimi, hesap silme).
5. Mağaza sayfası: metinler [GOOGLE-PLAY.md](GOOGLE-PLAY.md), simge `store/play-icon-512.png`, öne çıkan görsel
   `store/feature-graphic-1024x500.png`, telefon ekran görüntüleri `store/screenshots/play-*.png` (5 adet hazır,
   1080×2160; yenisi için `npm run screenshot -- ad`).
6. Yeni kişisel geliştirici hesaplarında üretime geçmeden önce **12 test kullanıcısıyla 14 gün kapalı test** zorunludur.

## 4. App Store (Mac + Xcode gerekir)

1. Apple Developer Program üyeliği; Identifiers'da `com.kaptanpati.game` (In-App Purchase yeteneği açık).
2. Mac'te: `npm ci && npm run mobile:build`, sonra `npx cap open ios`.
3. Xcode → Signing & Capabilities → Team seç; "In-App Purchase" yeteneğini ekle. Product → Archive → Distribute → App Store Connect.
4. App Store Connect: uygulamayı oluştur, ürünleri ekle ve **uygulamayla birlikte incelemeye gönder**.
5. Formlar ve metinler: [APP-STORE.md](APP-STORE.md) (App Privacy, yaş derecelendirmesi, inceleme notu).
6. Ekran görüntüleri: 6,9" iPhone için `store/screenshots/appstore-*.png` (5 adet hazır, 1290×2796; durum çubuğu ve
   Android arayüzü kırpılmış). Yenisi için `npm run screenshot -- ad`.

## 5. Her yeni sürümde

- `package.json` sürümünü artır (`1.0.1` …). Android sürüm kodu buradan hesaplanır; Play aynı kodu kabul etmez.
  iOS için Xcode'da `MARKETING_VERSION` ve `CURRENT_PROJECT_VERSION`'ı da artır.
- `npm test`, `npm run android:release`, dahili testte deneme.
