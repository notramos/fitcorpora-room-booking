# Sistem Booking Ruangan Kantor

Aplikasi booking ruangan kantor: satu app Next.js (App Router), login Microsoft Entra ID (Azure AD) via NextAuth, dan file Excel (`xlsx`) sebagai database — tanpa server database terpisah.

## Arsitektur

```
Browser (login Microsoft)
   -> Next.js App (App Router)
        -> /login — NextAuth signIn('azure-ad')
        -> / — Dashboard (server component ambil session + data ruangan)
        -> /api/rooms, /api/bookings, /api/bookings/[id]
   -> NextAuth + Azure AD (autentikasi, session JWT)
   -> lib/excelDb.ts (baca/tulis + lock + validasi bentrok)
        -> data/database.xlsx (sheet Rooms, sheet Bookings)
```

## Setup

1. Buat **App Registration** di https://entra.microsoft.com (Applications > App registrations), catat **Client ID**, **Tenant ID**, dan buat **Client Secret**.
2. Tambahkan Redirect URI: `http://localhost:3000/api/auth/callback/azure-ad`.
3. Salin `.env.local.example` ke `.env.local` dan isi:
   ```
   AZURE_AD_CLIENT_ID=...
   AZURE_AD_CLIENT_SECRET=...
   AZURE_AD_TENANT_ID=...
   NEXTAUTH_SECRET=...
   NEXTAUTH_URL=http://localhost:3000
   EXCEL_DB_PATH=./data/database.xlsx
   ```
   Generate `NEXTAUTH_SECRET` (Windows PowerShell, tanpa openssl):
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
4. Install & jalankan:
   ```bash
   npm install
   npm run dev
   ```
5. Buka `http://localhost:3000` — akan redirect ke `/login`, masuk dengan akun Microsoft.

`data/database.xlsx` dibuat otomatis (dengan 3 ruangan contoh) saat pertama kali aplikasi mengakses data. Hapus file ini untuk reset ke data awal.

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
  excelDb.ts                      # semua baca/tulis ke file Excel
  roomStatus.ts                   # perhitungan status Tersedia/Sedang Dipakai
  teamsAuth.ts                    # verifikasi token Teams SSO (jose + JWKS Azure AD)
  types.ts                        # tipe Room, Booking
teams-manifest/
  manifest.json                   # paket app Teams (isi placeholder sebelum sideload)
data/
  database.xlsx                   # dibuat otomatis saat pertama dijalankan
middleware.ts                      # proteksi semua route kecuali /login (saat ini di-bypass sementara untuk testing)
```

## Keputusan desain yang perlu diketahui

- **Hapus booking**: semua user yang sudah login boleh membatalkan booking ruangan manapun (tidak ada pengecekan kepemilikan), karena spesifikasi tidak mendefinisikan model role/kepemilikan dan ini adalah tool internal skala kecil. Untuk membatasi hanya pemesan asli yang bisa membatalkan, tambahkan pengecekan `session.user.email === booking.bookerEmail` di `app/api/bookings/[id]/route.ts` sebelum memanggil `deleteBooking`.
- **Lock in-process**: `lib/excelDb.ts` menggunakan antrian promise in-process (`withLock`) untuk mencegah dua booking simultan saling menimpa file. Ini **hanya** melindungi dalam satu proses Node — tidak melindungi dari banyak instance server berjalan bersamaan. Sesuai skala kecil-menengah, satu instance server.
- File Excel cocok untuk volume booking kecil-menengah, bukan untuk multi-instance/load balancing atau volume sangat tinggi. Jika kebutuhan berkembang, pertimbangkan migrasi ke database asli (Postgres/MySQL/SQLite).
