# Envantra

Next.js, Firebase ve Firestore tabanlı çok işletmeli stok yönetimi uygulaması.

## Android uygulaması

Android projesi `android/` klasöründedir ve uygulama kimliği `com.envantra.app` olarak sabitlenmiştir. Web arayüzü korunurken cihaz işlevleri Capacitor üzerinden Android'in yerel API'lerine bağlanır.

Yerel Android özellikleri:

- Google Credential Manager ile Google girişi
- Google ML Kit ile cihaz üzerinde QR ve barkod tarama
- Firebase Cloud Messaging ile Android push bildirimleri
- Kamera ve Android 13+ bildirim izinleri
- Uygulama bağlantıları: `/product/{productId}` ve `/join`
- Fiziksel geri tuşu, ağ durumu, titreşim, durum çubuğu ve açılış ekranı
- Envantra adaptif uygulama ikonları

Geliştirme APK'sı oluşturmak için:

```powershell
pnpm android:debug
```

Oluşan dosya:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Android Studio'da açmak için:

```powershell
pnpm android:open
```

Google Play'e gönderilecek imzalı AAB için önce güvenli bir yayın anahtarı oluşturulmalı, ardından yayın sertifikasının SHA-1 değeri Firebase Android uygulamasına ve SHA-256 değeri `public/.well-known/assetlinks.json` dosyasına eklenmelidir.
