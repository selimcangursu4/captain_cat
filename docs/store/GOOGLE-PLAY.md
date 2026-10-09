# Google Play Console yanıtları ve mağaza metinleri

Yanıtlar oyunun gerçekte yaptığıyla birebir aynıdır (`server/src/pages.ts` gizlilik politikası ile tutarlı).
Bunlardan farklı bir şey işaretlemek "yanıltıcı beyan" reddi getirir.

## Uygulama içeriği (App content)

| Bölüm | Yanıt |
|---|---|
| Gizlilik politikası | `https://SUNUCU/privacy` |
| Uygulama erişimi | **Tüm işlevler kısıtlamasız** (misafir olarak oynanır, giriş bilgisi gerekmez) |
| Reklamlar | **Hayır**, reklam içermiyor |
| İçerik derecelendirmesi | Aşağıdaki IARC yanıtları |
| Hedef kitle | **13-15, 16-17, 18+** (13 yaş altı seçilmez) · "Çocukların ilgisini çekebilir mi?" → **Hayır** |
| Haber uygulaması | Hayır |
| COVID-19, devlet, finans, sağlık | Hayır |
| Veri güvenliği | Aşağıdaki tablo |
| Hesap silme | Uygulama içinde: Ayarlar → Hesap → Hesabımı Sil · Web: `https://SUNUCU/delete-account` |

> 13 yaş altı hedef kitle seçilirse "Aileler" politikası devreye girer (e-postalı hesap, rastgele ödüllü
> satın alma vb. için ek şartlar). Oyun 13+ olarak yayınlanır; gizlilik politikası da bunu söyler.

## Veri güvenliği (Data safety)

- Uygulama gerekli kullanıcı verisi türlerinden herhangi birini topluyor ya da paylaşıyor mu? **Evet**
- Toplanan verilerin tümü aktarım sırasında şifreleniyor mu? **Evet** (HTTPS)
- Kullanıcılar verilerinin silinmesini isteyebilir mi? **Evet** (uygulama içi + web bağlantısı)
- Bağımsız güvenlik incelemesi: Hayır

| Veri türü | Toplanıyor | Paylaşılıyor | Zorunlu mu | Amaç |
|---|---|---|---|---|
| Kişisel bilgi → E-posta adresi | Evet | Hayır | **İsteğe bağlı** (yalnızca hesabı kaydedince) | Hesap yönetimi, uygulama işlevi |
| Kişisel bilgi → Ad (kaptan takma adı) | Evet | Hayır | Zorunlu | Uygulama işlevi, hesap yönetimi |
| Kişisel bilgi → Kullanıcı kimlikleri | Evet | Hayır | Zorunlu | Hesap yönetimi, uygulama işlevi, dolandırıcılık önleme |
| Finansal bilgi → Satın alma geçmişi | Evet | Hayır | Zorunlu | Uygulama işlevi, dolandırıcılık önleme |
| Uygulama etkinliği → Uygulama etkileşimleri (oyun ilerlemesi ve oyun içi işlemler) | Evet | Hayır | Zorunlu | Uygulama işlevi, dolandırıcılık önleme ve güvenlik |

- Konum, kişiler, fotoğraf, ses, dosya, takvim, sağlık, cihaz kimliği, reklam kimliği, kilitlenme kaydı: **toplanmıyor**.
- RevenueCat ödeme doğrulaması bizim adımıza çalışan hizmet sağlayıcıdır: Google'ın tanımına göre "paylaşım" sayılmaz.
- IP adresi yalnızca deneme sınırı için kısa süre bellekte tutulur (geçici işleme): beyan gerekmez.

## İçerik derecelendirmesi (IARC anketi)

- Kategori: **Oyun**
- Şiddet, korku, cinsellik, küfür, uyuşturucu: **Hayır**
- Kumar / benzetilmiş kumar: **Hayır** (para kazanılmaz, ödüller paraya çevrilemez)
- Kullanıcılar birbiriyle iletişim kurabiliyor mu / içerik paylaşabiliyor mu: **Hayır**
- Konum paylaşımı: **Hayır**
- Dijital ürün satın alımı: **Evet**
- Rastgele ödül içeren satın alma (ganimet kutusu): **Evet** (sandıklar oyun içi altınla açılır, olasılıklar gösterilir)

Beklenen sonuç: PEGI 3 / ESRB Everyone, "Uygulama İçi Satın Alma (rastgele öğeler dahil)" etiketiyle.

## Uygulama içi ürünler

Play Console → Para kazanma → Ürünler → Uygulama içi ürünler: [YAYIN-KONTROL-LISTESI.md](YAYIN-KONTROL-LISTESI.md#2-revenuecat-ve-ürünler)
tablosundaki 7 kimliği oluştur. Fiyatı bir kez (TRY) gir, diğer ülkeler otomatik çevrilir.

## Mağaza metinleri

**Uygulama adı (en çok 30):** Kaptan Pati: Liman Bulmacası

**Kısa açıklama (TR, en çok 80):**
Taşları eşleştir, Kaptan Pati'yle limanı yeniden kur! Sevimli 3'lü bulmaca oyunu.

**Short description (EN):**
Match tiles and rebuild the harbor with Captain Pati! A cozy match-3 puzzle game.

**Tam açıklama (TR):**

```
Sakar ama sevimli Kaptan Pati'nin limanı harabe halde! Taşları eşleştir, seviyeleri geç ve kasabayı
parça parça yeniden inşa et.

★ 200 seviye, her biri oynanabilirliği test edilerek dengelendi
★ Harpun, Gülle, Girdap ve Martı güçlendiricileri — birleştirip süper kombolar yap
★ Yosun, ağ, kum torbası, kilitli sandık ve martı yuvası gibi engeller
★ Deniz Feneri, İskele, Balıkçı Dükkânı, Liman Kafesi ve Kaptan'ın Gemisi: liman haritasında bölge bölge ilerle
★ Her parçayı Klasik, Okyanus ya da Gün Batımı tasarımıyla kendi zevkine göre kur
★ Pazar'dan malzeme al, gemini geliştir, sandıklardan sürprizler çıkar
★ Günlük ödüller ve her 10 seviyede hediye sandığı
★ İnternetsiz de oynanır; ilerlemen buluta kaydedilir

Hesap açmadan misafir olarak hemen oynamaya başla, istediğin zaman ilerlemeni e-postanla kaydet.

Oyun ücretsizdir; isteğe bağlı uygulama içi satın almalar içerir (rastgele ödüllü sandıklar dahil;
olasılıklar oyunda gösterilir).
```

**Full description (EN):**

```
Clumsy but lovable Captain Pati's harbor is in ruins! Match tiles, beat levels and rebuild the town piece by piece.

★ 200 levels, each tested and balanced for fair play
★ Harpoon, Cannonball, Whirlpool and Seagull boosters — combine them for super combos
★ Obstacles like moss, nets, sandbags, locked chests and seagull nests
★ Lighthouse, Pier, Fish Shop, Harbor Café and the Captain's Ship: progress area by area on the harbor map
★ Build every piece in Classic, Ocean or Sunset style
★ Buy materials at the Market, upgrade your ship and open surprise chests
★ Daily rewards and a gift chest every 10 levels
★ Play offline; your progress is saved to the cloud

Start right away as a guest — no account needed — and register your progress with an email any time.

Free to play with optional in-app purchases (including chests with random rewards; odds are shown in the game).
```

**Kategori:** Oyun → Bulmaca · **Etiketler:** Eşleştirme oyunu, Rahat, Tek oyunculu
