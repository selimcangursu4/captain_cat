# App Store Connect yanıtları ve mağaza metinleri

## Uygulama bilgileri

| Alan | Değer |
|---|---|
| Ad (en çok 30) | Kaptan Pati: Liman Bulmacası |
| Alt başlık (en çok 30) | Eşleştir, limanı yeniden kur |
| Paket kimliği | `com.kaptanpati.game` |
| Birincil kategori | Oyunlar → Bulmaca · İkincil: Oyunlar → Rahat (Casual) |
| Gizlilik politikası URL'si | `https://SUNUCU/privacy` |
| Destek URL'si | `https://SUNUCU/support` |
| Telif hakkı | `2026 OPERATOR_NAME` |
| Cihaz | Yalnızca iPhone (iPad ekran görüntüsü gerekmez) |

## App Privacy (gizlilik etiketleri)

"Bu uygulamadan veri topluyor musunuz?" → **Evet**. İzleme (tracking) → **Hayır**, hiçbir veri izleme için kullanılmaz.

| Veri türü | Kullanıcıya bağlı | Amaç |
|---|---|---|
| İletişim bilgileri → E-posta adresi | Evet | Uygulama işlevselliği |
| Tanımlayıcılar → Kullanıcı kimliği | Evet | Uygulama işlevselliği |
| Satın almalar → Satın alma geçmişi | Evet | Uygulama işlevselliği |
| Kullanıcı içeriği → Oyun içeriği (ilerleme) | Evet | Uygulama işlevselliği |
| Kullanıcı içeriği → Diğer kullanıcı içeriği (kaptan takma adı) | Evet | Uygulama işlevselliği |

Bu tablo `ios/App/App/PrivacyInfo.xcprivacy` ile aynıdır; birini değiştirirsen ötekini de değiştir.

## Yaş derecelendirmesi

- Çizgi film / fantastik şiddet, gerçekçi şiddet, korku, cinsellik, küfür, alkol/uyuşturucu: **Yok**
- Kumar / benzetilmiş kumar: **Yok** · Yarışmalar: **Yok**
- Sınırsız web erişimi: **Hayır** (yalnızca kendi gizlilik/destek sayfalarımız tarayıcıda açılır)
- Kullanıcılar arası iletişim / kullanıcı içeriği paylaşımı: **Hayır**
- Uygulama içi satın almalar: **Evet** · Ganimet kutuları (rastgele öğeler): **Evet**

## Uygulama içi satın almalar

[YAYIN-KONTROL-LISTESI.md](YAYIN-KONTROL-LISTESI.md#2-revenuecat-ve-ürünler) tablosundaki 7 ürünü
**Consumable (Tüketilebilir)** olarak oluştur; her birine görünen ad, açıklama ve inceleme ekran görüntüsü
(mağaza penceresinin görüntüsü) ekle. İlk sürümde ürünleri **uygulamayla aynı gönderimde** incelemeye gönder.
Tüketilebilir ürünler olduğu için "Satın alımları geri yükle" düğmesi gerekmez (altın hesapta saklanır).

## İnceleme notu (App Review Information → Notes) — İngilizce

```
Kaptan Pati is a single-player match-3 puzzle game.

• No login required: tap "Play as Guest" on the first screen. Registering with email is optional
  (Settings → Account → Register) and only used to sync progress across devices.
• Account deletion: Settings → Account → Delete Account (permanently deletes the account and all data).
• In-app purchases (consumable coins and the Piggy Bank) are in the Shop (bag icon on the home screen).
  Coins can be spent in the Market; chests there are bought with in-game coins and the odds of every
  reward type are shown on each chest card before purchase (Guideline 3.1.1).
• Privacy policy, terms and support pages open from Settings and the first screen.
• The game needs an internet connection only for the first start (guest account creation) and to sync.
```

İletişim bilgileri: adın, telefonun ve e-postan. Demo hesap: **gerekmez** (misafir giriş).

## Mağaza metinleri

**Promosyon metni (en çok 170, TR):** Kaptan Pati'nin limanı seni bekliyor! 200 seviye, güçlendirici kombolar ve kendi tasarımınla yeniden kurduğun sevimli bir liman kasabası.

**Anahtar kelimeler (en çok 100, TR):** eşleştirme,bulmaca,3lü,match 3,kedi,liman,kasaba,inşa,rahat,taş,patlat,kombo

**Keywords (EN):** match 3,puzzle,cat,harbor,town,build,casual,tiles,combo,captain,relaxing,blast

**Açıklama:** [GOOGLE-PLAY.md](GOOGLE-PLAY.md#mağaza-metinleri) içindeki tam açıklamanın aynısı (TR ve EN).
