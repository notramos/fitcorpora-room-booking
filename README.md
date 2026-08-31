# Sistem Booking Ruangan Kantor

Aplikasi booking ruangan kantor: satu app Next.js (App Router), login Microsoft Entra ID (Azure AD) via NextAuth, dan **PostgreSQL** sebagai database. Skema tabel dibuat otomatis oleh aplikasi saat pertama kali connect — tidak perlu menjalankan migration manual.

## Arsitektur

```
Browser (login Microsoft)
   -> Next.js App (App Router)
        -> /login — NextAuth signIn('azure-ad')
        -> / — Dashboard (server component ambil session + data ruangan)
        -> /api/rooms, /api/bookings, /api/bookings/[id]
   -> NextAuth + Azure AD (autentikasi, session JWT)
   -> lib/db.ts (baca/tulis + lock in-process + transaksi + validasi bentrok)
        -> PostgreSQL (tabel rooms, bookings) via connection pool (paket `pg`)
```

## Setup

1. Buat **App Registration** di https://entra.microsoft.com (Applications > App registrations), catat **Client ID**, **Tenant ID**, dan buat **Client Secret**.
2. Tambahkan Redirect URI: `http://localhost:3000/api/auth/callback/azure-ad`.
3. Setup **PostgreSQL** sebagai database — lihat bagian "Setup PostgreSQL" di bawah.
4. Salin `.env.local.example` ke `.env.local` dan isi:
   ```
   AZURE_AD_CLIENT_ID=...
   AZURE_AD_CLIENT_SECRET=...
   AZURE_AD_TENANT_ID=...
   NEXTAUTH_SECRET=...
   NEXTAUTH_URL=http://localhost:3000
   ADMIN_EMAILS=you@fitcorpora.com
   DATABASE_URL=postgres://booking:booking@localhost:5432/booking
   DATABASE_SSL=
   ```
   `ADMIN_EMAILS` is a comma-separated allowlist — those accounts get
   `/admin/*`, room management, and booking approval.
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

## Setup PostgreSQL

Butuh satu database PostgreSQL (versi 13+). Aplikasi membuat sendiri tabel
`rooms` dan `bookings` (`CREATE TABLE IF NOT EXISTS`) saat pertama kali
connect, jadi tidak ada langkah migration manual. Skema referensi ada di
[`db/schema.sql`](db/schema.sql).

**Opsi A — Postgres lokal via Docker (paling cepat untuk dev):**

```bash
docker run --name booking-pg -e POSTGRES_USER=booking \
  -e POSTGRES_PASSWORD=booking -e POSTGRES_DB=booking \
  -p 5432:5432 -d postgres:17-alpine
```

Lalu di `.env.local`:

```
DATABASE_URL=postgres://booking:booking@localhost:5432/booking
DATABASE_SSL=
```

**Opsi B — Postgres terkelola (Neon, Supabase, RDS, Vercel Postgres, dll.):**
pakai connection string dari provider, dan set `DATABASE_SSL=true` kalau
provider mewajibkan TLS:

```
DATABASE_URL=postgres://user:pass@host:5432/dbname
DATABASE_SSL=true
```

3 ruangan contoh otomatis ditambahkan ke tabel `rooms` saat pertama kali
aplikasi mengakses data (kalau tabel itu **masih kosong**).

## Migrasi data dari Google Sheets (sekali jalan)

Kalau sudah ada data produksi di Google Sheet versi lama, jalankan
[`scripts/migrate-sheets-to-postgres.mjs`](scripts/migrate-sheets-to-postgres.mjs)
**sebelum** mengarahkan trafik ke versi Postgres. Script ini menyalin
semua baris `Rooms` dan `Bookings` apa adanya — **id dipertahankan**, jadi
link kiosk `/display/[id]` dan antrean approval yang pending tetap valid.

```bash
npm ci   # butuh `googleapis` (devDependency) + `pg`
GOOGLE_SERVICE_ACCOUNT_EMAIL=... \
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
GOOGLE_SHEET_ID=... \
DATABASE_URL=postgres://user:pass@host:5432/db \
DATABASE_SSL=true \
node scripts/migrate-sheets-to-postgres.mjs
```

Aman dijalankan ulang: insert pakai `ON CONFLICT (id) DO NOTHING`, jadi run
kedua hanya mengisi baris yang belum ada dan tidak menimpa data yang sudah
ditulis app. Kalau tabel Postgres masih kosong saat script jalan, seeding 3
ruangan contoh **tidak** terjadi (hanya jalan kalau app yang pertama kali
menyentuh tabel kosong) — data sheet yang jadi isinya.

Verifikasi setelah migrasi:

```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM rooms; SELECT count(*) FROM bookings;"
```

## Deploy ke Vercel

1. Push repo ke GitHub, import project di dashboard Vercel (atau `vercel` CLI).
2. Isi semua env var dari `.env.local` di Vercel Project Settings → Environment Variables. Untuk `DATABASE_URL` pakai Postgres terkelola (mis. Vercel Postgres atau Neon) dan set `DATABASE_SSL=true`. Serverless bikin banyak koneksi singkat — pakai endpoint pooler dari provider kalau ada.
3. Deploy, catat domain `https://<project>.vercel.app` (atau custom domain).
4. Di Azure Portal App Registration → **Authentication** → tambah redirect URI `https://<domain>/api/auth/callback/azure-ad`.
5. Update `NEXTAUTH_URL` di Vercel ke domain itu persis (termasuk `https://`, tanpa trailing slash), lalu redeploy.
6. Kalau integrasi Teams juga dipakai di produksi, update `NEXT_PUBLIC_TEAMS_APP_ID_URI` sesuai domain produksi (lihat bagian Teams di bawah).
7. **Perlu diputuskan sebelum go-live ke user asli**: `middleware.ts` saat ini sengaja bypass auth (`return NextResponse.next()` di awal fungsi) untuk memudahkan testing lokal. Uncomment logic aslinya di file itu sebelum aplikasi benar-benar dipakai orang lain.

## Deploy dengan Docker

Deploy ke satu VPS/EC2 dengan Traefik sebagai reverse proxy dan TLS otomatis
dari Let's Encrypt. Domain produksi: **https://room.fitcorpora.com**. Langkah
lengkap khusus EC2 (security group, install Docker, DNS, swap) ada di
[`DEPLOY.md`](DEPLOY.md). Ringkasnya:

1. DNS: A record `room.fitcorpora.com` → IP publik host (Elastic IP). Kalau
   pakai Cloudflare, set **DNS only** (bukan proxied) supaya ACME HTTP
   challenge bisa masuk.
2. Buka port `80` dan `443` di firewall/security group.
3. Sekali per host, jalankan Traefik (`ACME_EMAIL` = alamat kontak Let's
   Encrypt):
   ```
   docker network create traefik-public
   ACME_EMAIL=you@fitcorpora.com docker compose -f docker-compose.traefik.yml up -d
   ```
4. Salin `.env.prod.example` → `.env.prod` (gitignored) dan isi semua value.
   `NEXTAUTH_URL` harus persis `https://room.fitcorpora.com`. Biarkan
   `DATABASE_URL=postgres://booking:booking@db:5432/booking` untuk memakai
   service `db` (Postgres) yang ikut jalan di `docker-compose.yml`.
5. Build & jalankan (app + Postgres) lewat `./build.sh` — tidak perlu secret
   saat build karena semua data dibaca dari Postgres saat runtime:
   ```
   chmod +x build.sh   # sekali saja
   ./build.sh
   ```
   Data Postgres persisten di volume `pgdata`. Untuk backup: `docker exec
   room-booking-db pg_dump -U booking booking > backup.sql`.
6. Di Azure Portal App Registration → **Authentication**, tambah redirect URI
   `https://room.fitcorpora.com/api/auth/callback/azure-ad`.

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
  approval/page.tsx               # antrean persetujuan (admin) — booking pending
  admin/rooms/page.tsx            # kelola ruangan (admin)
  admin/bookings/page.tsx         # kelola SEMUA booking (admin) — cari/ubah/hapus/setujui
  api/auth/[...nextauth]/         # konfigurasi NextAuth
  api/auth/teams/route.ts         # verifikasi token Teams SSO -> cookie session
  api/rooms/route.ts              # GET daftar ruangan
  api/bookings/route.ts           # GET & POST booking
  api/bookings/[id]/route.ts      # PATCH & DELETE booking
  api/bookings/[id]/approve|reject|reset-reminder/route.ts   # aksi admin
components/
  SearchBooking.tsx, RoomDetail.tsx, RoomDisplay.tsx, BookingModal.tsx,
  EditBookingModal.tsx, ApprovalQueue.tsx, AdminRoomsManager.tsx,
  AdminBookingsManager.tsx, RealtimeClock.tsx, StatusBadge.tsx, AuthProvider.tsx
lib/
  auth.ts                         # authOptions NextAuth (Azure AD provider)
  db.ts                           # semua baca/tulis ke PostgreSQL (pool + lock + transaksi + validasi bentrok)
  roomStatus.ts                   # perhitungan status Tersedia/Sedang Dipakai
  teamsAuth.ts                    # verifikasi token Teams SSO (jose + JWKS Azure AD)
  types.ts                        # tipe Room, Booking
teams-manifest/
  manifest.json                   # paket app Teams (isi placeholder sebelum sideload)
middleware.ts                      # proteksi semua route kecuali /login (saat ini di-bypass sementara untuk testing)
```

## Keputusan desain yang perlu diketahui

- **Hapus booking**: semua user yang sudah login boleh membatalkan booking ruangan manapun (tidak ada pengecekan kepemilikan), karena spesifikasi tidak mendefinisikan model role/kepemilikan dan ini adalah tool internal skala kecil. Untuk membatasi hanya pemesan asli yang bisa membatalkan, tambahkan pengecekan `session.user.email === booking.bookerEmail` di `app/api/bookings/[id]/route.ts` sebelum memanggil `deleteBooking`.
- **Anti double-booking**: `lib/db.ts` masih memakai antrian promise in-process (`withLock`) untuk serialisasi dalam satu proses, tapi `createBooking` / `updateBooking` sekarang jalan dalam satu **transaksi PostgreSQL** dengan `pg_advisory_xact_lock` per-ruangan — jadi cek bentrok + insert bersifat atomik dan aman lintas banyak instance sekaligus (mis. serverless), bukan lagi best-effort seperti di Google Sheets.
- **Skema otomatis**: tidak ada tool migration. `lib/db.ts` menjalankan `CREATE TABLE IF NOT EXISTS` sekali per proses saat pertama connect, dan seeding 3 ruangan contoh dilindungi advisory lock supaya dua instance tidak balapan. Kalau nanti butuh perubahan skema yang tidak idempotent, tambahkan tool migration (mis. `node-pg-migrate` atau Drizzle) dan hapus DDL inline itu.
- **Kelola booking tanpa buka database**: dulu memperbaiki/menghapus booking sembarang (ruangan apa pun, tanggal apa pun) berarti buka spreadsheet dan edit baris langsung. Penggantinya adalah halaman **`/admin/bookings`** (khusus admin): cari, ubah, hapus, setujui, dan atur ulang flag pengingat untuk booking mana pun.
