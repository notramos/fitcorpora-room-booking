# Sistem Booking Ruangan Kantor

Aplikasi booking ruangan kantor: satu app Next.js (App Router), login Microsoft Entra ID (Azure AD) via NextAuth, dan **Google Sheets** sebagai database — tanpa server database terpisah, dan cocok untuk deploy ke platform serverless seperti Vercel.

## Arsitektur

```
Browser (login Microsoft)
   -> Next.js App (App Router)
        -> /login — NextAuth signIn('azure-ad')
        -> / — Dashboard (server component ambil session + data ruangan)
        -> /api/rooms, /api/bookings, /api/bookings/[id]
   -> NextAuth + Azure AD (autentikasi, session JWT)
   -> lib/sheetsDb.ts (baca/tulis + lock in-process + validasi bentrok)
        -> Google Sheets API (tab Rooms, tab Bookings) via service account
```

## Setup

1. Buat **App Registration** di https://entra.microsoft.com (Applications > App registrations), catat **Client ID**, **Tenant ID**, dan buat **Client Secret**.
2. Tambahkan Redirect URI: `http://localhost:3000/api/auth/callback/azure-ad`.
3. Setup **Google Sheets** sebagai database — lihat bagian "Setup Google Sheets" di bawah.
4. Salin `.env.local.example` ke `.env.local` dan isi:
   ```
   AZURE_AD_CLIENT_ID=...
   AZURE_AD_CLIENT_SECRET=...
   AZURE_AD_TENANT_ID=...
   NEXTAUTH_SECRET=...
   NEXTAUTH_URL=http://localhost:3000
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
   GOOGLE_PRIVATE_KEY=...
   GOOGLE_SHEET_ID=...
   ```
   Generate `NEXTAUTH_SECRET` (Windows PowerShell, tanpa openssl):
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
5. Install & jalankan:
   ```bash
   npm install
   npm run dev
   ```
6. Buka `http://localhost:3000` — akan redirect ke `/login`, masuk dengan akun Microsoft.

## Setup Google Sheets

1. Buat project di https://console.cloud.google.com, aktifkan **Google Sheets API** (APIs & Services → Library).
2. **IAM & Admin → Service Accounts → Create Service Account**. Tidak perlu role IAM apa pun (akses diatur lewat "Share" di langkah 4).
3. Buka service account itu → tab **Keys → Add Key → Create new key → JSON** — file akan ter-download sekali, simpan baik-baik. Catat `client_email` dan `private_key` dari isinya.
4. Buat Google Sheet baru dengan 2 tab persis bernama `Rooms` dan `Bookings`, dengan header di baris 1:
   - `Rooms`: `id`, `name`, `location`, `capacity`
   - `Bookings`: `id`, `roomId`, `date`, `startTime`, `endTime`, `purpose`, `bookerName`, `bookerEmail`, `createdAt`
5. Klik **Share** pada sheet itu, tambahkan `client_email` dari langkah 3 sebagai **Editor**.
6. Ambil `GOOGLE_SHEET_ID` dari URL sheet (`https://docs.google.com/spreadsheets/d/<INI>/edit`).
7. Isi `.env.local`:
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email>
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_SHEET_ID=<sheet id>
   ```
   `GOOGLE_PRIVATE_KEY` disimpan sebagai satu baris dengan `\n` **literal** (bukan newline sungguhan, persis seperti di file JSON) — kode akan otomatis mengubahnya jadi newline asli saat dibaca.

3 ruangan contoh otomatis ditambahkan ke tab `Rooms` saat pertama kali aplikasi mengakses data (kalau tab itu masih kosong).

## Deploy ke Vercel

1. Push repo ke GitHub, import project di dashboard Vercel (atau `vercel` CLI).
2. Isi semua env var dari `.env.local` di Vercel Project Settings → Environment Variables — paste `GOOGLE_PRIVATE_KEY` apa adanya dengan `\n` literal, jangan biarkan Vercel "merapikan" jadi multi-baris.
3. Deploy, catat domain `https://<project>.vercel.app` (atau custom domain).
4. Di Azure Portal App Registration → **Authentication** → tambah redirect URI `https://<domain>/api/auth/callback/azure-ad`.
5. Update `NEXTAUTH_URL` di Vercel ke domain itu persis (termasuk `https://`, tanpa trailing slash), lalu redeploy.
6. Kalau integrasi Teams juga dipakai di produksi, update `NEXT_PUBLIC_TEAMS_APP_ID_URI` sesuai domain produksi (lihat bagian Teams di bawah).
7. **Perlu diputuskan sebelum go-live ke user asli**: `middleware.ts` saat ini sengaja bypass auth (`return NextResponse.next()` di awal fungsi) untuk memudahkan testing lokal. Uncomment logic aslinya di file itu sebelum aplikasi benar-benar dipakai orang lain.

## Deploy dengan Docker

Setup ini mengasumsikan Traefik sebagai reverse proxy bersama (satu Traefik untuk beberapa app di host yang sama) dan Cloudflare yang menangani TLS/DNS di depan (proxied, diarahkan ke `http://<host>:8080`).

1. Sekali per host, jalankan Traefik:
   ```
   docker network create traefik-public   # sekali saja kalau network belum ada
   docker compose -f docker-compose.traefik.yml up -d
   ```
2. Salin `.env.prod` (sudah di-gitignore) dan isi semua value — `NEXTAUTH_URL` sudah di-set ke `https://room-booking.fitcorpora.com`, tinggal isi secret Azure AD dan Google Sheets seperti di `.env.local`.
3. Build & jalankan app-nya lewat `./build.sh`. `app/display` melakukan fetch Google Sheets saat *build* (prerender), jadi script ini menyalin `GOOGLE_*` dari `.env.prod` ke `./.secrets/` (gitignored) lalu meneruskannya ke `docker compose build` sebagai BuildKit secret — pastikan `.env.prod` sudah terisi kredensial Google yang valid sebelum menjalankan ini:
   ```
   chmod +x build.sh   # sekali saja
   ./build.sh
   ```
4. Di Azure Portal App Registration → **Authentication**, tambah redirect URI `https://room-booking.fitcorpora.com/api/auth/callback/azure-ad`.
5. Di Cloudflare, arahkan DNS record `room-booking.fitcorpora.com` (proxied) ke IP host, port `8080` (port Traefik di `docker-compose.traefik.yml`).

## Integrasi Microsoft Teams (silent SSO)

Aplikasi bisa di-embed sebagai tab Teams dengan login otomatis (tanpa klik apa pun) memakai identitas Teams yang sedang aktif. Ini murni tambahan — tidak mengubah `/login`, `middleware.ts`, atau `/display/[id]`.

**Cara kerja:** tab Teams memuat `/teams`, yang lewat `@microsoft/teams-js` meminta token Azure AD secara diam-diam (`authentication.getAuthToken()`), lalu token itu diverifikasi di server (`lib/teamsAuth.ts`, pakai `jose` terhadap JWKS Azure AD) dan diubah jadi cookie session yang **identik** dengan cookie login browser biasa (pakai `encode()` dari `next-auth/jwt`) — jadi begitu sudah login lewat Teams, seluruh app (dan nanti middleware auth kalau diaktifkan lagi) mengenalinya seperti sesi NextAuth normal.

### Checklist Azure Portal (manual, App Registration yang **sama** dengan yang dipakai `/login`)

1. **Expose an API** → set Application ID URI: `api://<domain-anda>/<AZURE_AD_CLIENT_ID>`. Tambah scope `access_as_user` (State: Enabled).
2. **Authorized client applications** → tambahkan dua client ID Teams bawaan Microsoft untuk scope `access_as_user`:
   - `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams desktop & mobile)
   - `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams web)
3. **Authentication** → tambah platform **Single-page application**, redirect URI: `https://<domain-anda>/auth-end.html` (sudah tersedia di `public/auth-end.html`).
4. **API permissions** → **Grant admin consent** untuk scope `access_as_user` tenant-wide — wajib supaya proses benar-benar diam-diam (tanpa prompt user).

### Env var tambahan

```
NEXT_PUBLIC_TEAMS_APP_ID_URI=api://<domain-anda>/<AZURE_AD_CLIENT_ID>
```
Harus sama persis dengan Application ID URI dari langkah 1 di atas.

### Paket Teams (manifest)

Isi `teams-manifest/manifest.json`: ganti `id` (GUID baru khusus app Teams), `packageName`, `developer.*`, `webApplicationInfo.id`/`resource`, `staticTabs[0].contentUrl`/`websiteUrl`, dan `validDomains` dengan domain asli Anda. Tambahkan `color.png` (192×192) dan `outline.png` (32×32, transparan) di folder yang sama, lalu zip ketiga file itu (`manifest.json`, `color.png`, `outline.png`) untuk di-sideload lewat Teams Admin Center atau "Upload a custom app".

### Yang perlu diuji langsung di Teams (tidak bisa disimulasikan lokal)

- Flow `getAuthToken()` yang sesungguhnya di dalam client Teams asli.
- Tab benar-benar termuat di iframe Teams (CSP `frame-ancestors` di `/teams` mengizinkan domain Teams).
- Admin consent benar-benar ter-grant (kalau belum, `getAuthToken()` akan gagal dengan error spesifik saat dites langsung).

### Catatan untuk nanti

Kalau `middleware.ts` diaktifkan kembali (saat ini sengaja di-bypass untuk testing), tambahkan `teams` ke daftar pengecualian matcher-nya — supaya load pertama tab Teams tidak ke-redirect ke `/login` sebelum sempat mendapat cookie dari `/api/auth/teams`.

## Struktur file

```
app/
  layout.tsx, page.tsx            # dashboard (server component, cek session)
  login/page.tsx                  # halaman login Microsoft
  rooms/[id]/page.tsx             # halaman detail ruangan
  display/[id]/page.tsx           # tampilan tablet/kiosk (publik, tanpa login)
  teams/page.tsx                  # entry tab Microsoft Teams (silent SSO)
  api/auth/[...nextauth]/         # konfigurasi NextAuth
  api/auth/teams/route.ts         # verifikasi token Teams SSO -> cookie session
  api/rooms/route.ts              # GET daftar ruangan
  api/bookings/route.ts           # GET & POST booking
  api/bookings/[id]/route.ts      # DELETE booking
components/
  Dashboard.tsx, RoomCard.tsx, RoomDetail.tsx, RoomDisplay.tsx, BookingModal.tsx,
  RealtimeClock.tsx, StatusBadge.tsx, AuthProvider.tsx
lib/
  auth.ts                         # authOptions NextAuth (Azure AD provider)
  sheetsDb.ts                     # semua baca/tulis ke Google Sheets (lock + validasi bentrok)
  roomStatus.ts                   # perhitungan status Tersedia/Sedang Dipakai
  teamsAuth.ts                    # verifikasi token Teams SSO (jose + JWKS Azure AD)
  types.ts                        # tipe Room, Booking
teams-manifest/
  manifest.json                   # paket app Teams (isi placeholder sebelum sideload)
middleware.ts                      # proteksi semua route kecuali /login (saat ini di-bypass sementara untuk testing)
```

## Keputusan desain yang perlu diketahui

- **Hapus booking**: semua user yang sudah login boleh membatalkan booking ruangan manapun (tidak ada pengecekan kepemilikan), karena spesifikasi tidak mendefinisikan model role/kepemilikan dan ini adalah tool internal skala kecil. Untuk membatasi hanya pemesan asli yang bisa membatalkan, tambahkan pengecekan `session.user.email === booking.bookerEmail` di `app/api/bookings/[id]/route.ts` sebelum memanggil `deleteBooking`.
- **Lock in-process**: `lib/sheetsDb.ts` menggunakan antrian promise in-process (`withLock`) untuk mencegah dua booking simultan dalam proses yang sama saling menimpa. Ini **hanya** melindungi dalam satu instance/proses Node — tidak melindungi lintas banyak instance serverless yang jalan bersamaan (mis. di Vercel). Google Sheets API sendiri juga tidak punya row-level lock. Ini tetap peningkatan nyata dibanding file lokal: sekarang semua instance baca/tulis ke sumber yang sama dan benar-benar persisten, walau race condition di jendela waktu yang sangat sempit tetap mungkin terjadi pada volume tinggi.
- Google Sheets API punya quota per-project (ratusan request/menit) — cukup untuk tool booking kantor skala kecil-menengah, bukan untuk volume sangat tinggi. Jika kebutuhan berkembang, pertimbangkan migrasi ke database asli (Postgres/MySQL/SQLite, mis. Vercel Postgres atau Neon).
