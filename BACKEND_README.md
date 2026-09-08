# TikTok Profil Çeker - Backend Kurulumu

## 🚀 Hızlı Başlangıç

### 1. Node.js İndirin
Eğer Node.js yüklü değilse: https://nodejs.org/ (LTS sürümünü indirin)

### 2. Bağımlılıkları Yükleyin
Terminal/PowerShell'i açın ve şu klasöre girin:
```
cd c:\APP\tüm oyunlar\TikTok\ttcoinpp
```

Sonra bağımlılıkları yükleyin:
```
npm install
```

### 3. Backend'i Çalıştırın
```
npm start
```

Çıktı şuna benzemelidir:
```
🚀 Backend çalışıyor: http://localhost:3000
🔌 Profil API: http://localhost:3000/api/profile?username=tiktok
```

### 4. Test Edin
Tarayıcıda açın: `http://localhost:3000/health`

Başarı mesajı göreceksiniz.

## 🎯 Kullanım

HTML dosyasını açarsanız ve TikTok kullanıcı adı yazarsanız:
1. Frontend `http://localhost:3000/api/profile?username=...` API'yi çağırır
2. Backend TikTok'a bağlanıp gerçek verileri getirir
3. Profil resmi ve takipçi sayısı gösteriliyor

## 🔧 Sorun Giderme

### "Port 3000 zaten kullanılıyor" hatası
Başka bir port kullanın: `PORT=4000 npm start`

### "npm: command not found"
Node.js düzgün yüklenmemiş. https://nodejs.org/ adresinden yeniden indirin

### Profil hala gelmiyor
1. Backend çalışıyor mu? Konsolda `🚀 Backend çalışıyor` yazısı var mı?
2. F12 → Network sekmesinde `api/profile` istekini kontrol edin
3. Gerçek TikTok kullanıcı adı yazıyor musunuz?

## 📝 Vercel'e Deploy Etmek (İsteğe Bağlı)

Eğer sunucuyu hep açık tutmak istiyorsanız Vercel'e deploy edin:

1. https://vercel.com adresine gidin
2. "New Project" tıklayın
3. GitHub repository'sini bağlayın (repo'ya push edin)
4. Deploy edin

Sonra HTML'de:
```javascript
const apiUrl = 'https://your-vercel-url.vercel.app/api/profile?username=';
```

## 📚 API Parametreleri

```
GET /api/profile?username=tiktok

Response:
{
  "success": true,
  "user": {
    "uniqueId": "tiktok",
    "avatarLarger": "https://...",
    "followerCount": 5000000
  }
}
```

## ⚡ Geliştirme Modu

Otomatik reload için:
```
npm run dev
```

(Bunun için nodemon zaten `package.json` içinde kurulmuş)
