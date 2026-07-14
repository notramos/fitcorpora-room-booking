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

## Struktur file

```
app/
  layout.tsx, page.tsx            # dashboard (server component, cek session)
  login/page.tsx                  # halaman login Microsoft
  api/auth/[...nextauth]/         # konfigurasi NextAuth
  api/rooms/route.ts              # GET daftar ruangan
  api/bookings/route.ts           # GET & POST booking
  api/bookings/[id]/route.ts      # DELETE booking
components/
  Dashboard.tsx, RoomCard.tsx, BookingModal.tsx, RealtimeClock.tsx, AuthProvider.tsx
lib/
  auth.ts                         # authOptions NextAuth (Azure AD provider)
  excelDb.ts                      # semua baca/tulis ke file Excel
  roomStatus.ts                   # perhitungan status Tersedia/Sedang Dipakai
  types.ts                        # tipe Room, Booking
data/
  database.xlsx                   # dibuat otomatis saat pertama dijalankan
middleware.ts                      # proteksi semua route kecuali /login
```

## Keputusan desain yang perlu diketahui

- **Hapus booking**: semua user yang sudah login boleh membatalkan booking ruangan manapun (tidak ada pengecekan kepemilikan), karena spesifikasi tidak mendefinisikan model role/kepemilikan dan ini adalah tool internal skala kecil. Untuk membatasi hanya pemesan asli yang bisa membatalkan, tambahkan pengecekan `session.user.email === booking.bookerEmail` di `app/api/bookings/[id]/route.ts` sebelum memanggil `deleteBooking`.
- **Lock in-process**: `lib/excelDb.ts` menggunakan antrian promise in-process (`withLock`) untuk mencegah dua booking simultan saling menimpa file. Ini **hanya** melindungi dalam satu proses Node — tidak melindungi dari banyak instance server berjalan bersamaan. Sesuai skala kecil-menengah, satu instance server.
- File Excel cocok untuk volume booking kecil-menengah, bukan untuk multi-instance/load balancing atau volume sangat tinggi. Jika kebutuhan berkembang, pertimbangkan migrasi ke database asli (Postgres/MySQL/SQLite).
