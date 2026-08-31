# Deploy to EC2 with Docker + Traefik (Let's Encrypt)

Target: a single Ubuntu EC2 instance serving the app at
**https://room.fitcorpora.com**, TLS issued automatically by Let's Encrypt
via Traefik. No Cloudflare proxy required (DNS points straight at the
instance).

```
Internet ──► EC2 (ports 80/443) ──► Traefik ──► room-booking-system:3000 ──► postgres (db)
                                     │
                                     └─ ACME HTTP-01 challenge → Let's Encrypt cert
```

Postgres runs as the `db` service in `docker-compose.yml`; its data lives in
the `pgdata` Docker volume. To use a managed Postgres instead, point
`DATABASE_URL` in `.env.prod` at it (and set `DATABASE_SSL=true`), then drop
the `db` service.

---

## 1. EC2 instance

- Ubuntu 22.04 or 24.04 LTS, `t3.small` or larger (the Next.js build needs
  ~1.5 GB RAM; on `t3.micro` add a 2 GB swapfile first).
- **Elastic IP** associated so the address survives restarts.
- **Security group** inbound rules:
  | Port | Source | Why |
  |------|--------|-----|
  | 22   | your IP | SSH |
  | 80   | 0.0.0.0/0, ::/0 | HTTP + ACME challenge |
  | 443  | 0.0.0.0/0, ::/0 | HTTPS |

## 2. DNS

Create an **A record**: `room.fitcorpora.com` → the Elastic IP. If the DNS
is on Cloudflare, set it to **DNS only** (grey cloud), not proxied — the
ACME HTTP challenge must reach Traefik directly. Verify:

```bash
dig +short room.fitcorpora.com
```

## 3. Install Docker (on the instance)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker   # or log out/in
```

## 4. Get the code

```bash
git clone https://github.com/Facetology-Innovation-Technology/room-booking-system.git
cd room-booking-system
```

## 5. Configure env

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Fill every value. `NEXTAUTH_URL` must be exactly `https://room.fitcorpora.com`
(no trailing slash). Leave
`DATABASE_URL=postgres://booking:booking@db:5432/booking` as-is to use the
bundled `db` service.

Generate `NEXTAUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 6. Start Traefik (once per host)

```bash
docker network create traefik-public
ACME_EMAIL=you@fitcorpora.com docker compose -f docker-compose.traefik.yml up -d
```

`ACME_EMAIL` is the contact address Let's Encrypt uses for expiry notices.
The issued cert is stored in the `letsencrypt` Docker volume and persists
across restarts. Check Traefik came up clean:

```bash
docker logs -f traefik
```

## 7. Build & start the app

```bash
chmod +x build.sh
./build.sh
```

`build.sh` runs `docker compose build` then `docker compose up -d`, which
starts both `db` (Postgres) and the app. No build-time secrets are needed —
the app reads all data from Postgres at runtime, and creates its schema on
first connect. On first boot it also seeds 3 example rooms.

## 8. Azure redirect URI

In the Azure Portal → App Registration → **Authentication**, add redirect
URI:

```
https://room.fitcorpora.com/api/auth/callback/azure-ad
```

If Teams SSO is used, also add the SPA redirect
`https://room.fitcorpora.com/auth-end.html` and set
`NEXT_PUBLIC_TEAMS_APP_ID_URI` in `.env.prod` (see README → Teams).

## 9. Verify

```bash
curl -I https://room.fitcorpora.com        # expect HTTP/2 200 or 307 -> /login
curl -I http://room.fitcorpora.com         # expect 308 redirect to https
docker ps                                  # traefik + room-booking-system + room-booking-db up
docker logs room-booking-system
docker exec room-booking-db psql -U booking -d booking -c '\dt'  # expect rooms, bookings
```

Then open https://room.fitcorpora.com in a browser and sign in.

The first HTTPS request may take a few seconds while Traefik obtains the
cert. If it fails, `docker logs traefik | grep -i acme` shows why (usually
DNS not propagated, port 80 blocked by the security group, or a proxied
Cloudflare record).

---

## Cutover from the Google Sheets version

If a Sheets-backed version is already live, do this **before** pointing
users at the Postgres build — otherwise it comes up with an empty database
plus 3 auto-seeded example rooms, and every existing booking, room, and
kiosk `/display/<id>` link is gone.

1. Bring up only Postgres first: `./build.sh` starts both, or
   `docker compose up -d db`.
2. Freeze writes on the old version (short maintenance window) so nothing
   new lands in the sheet mid-copy.
3. Run the one-time migration from a checkout with both credential sets
   (see README → "Migrasi data dari Google Sheets"):
   ```bash
   npm ci
   GOOGLE_SERVICE_ACCOUNT_EMAIL=... GOOGLE_PRIVATE_KEY="..." GOOGLE_SHEET_ID=... \
   DATABASE_URL=postgres://booking:booking@localhost:5432/booking \
   node scripts/migrate-sheets-to-postgres.mjs
   ```
   It preserves every row id and is safe to re-run (`ON CONFLICT DO NOTHING`).
4. Verify counts match the sheet:
   ```bash
   docker exec room-booking-db psql -U booking -d booking \
     -c "SELECT (SELECT count(*) FROM rooms) AS rooms, (SELECT count(*) FROM bookings) AS bookings;"
   ```
5. Now cut traffic over (start/point Traefik at the app), sign in, and spot
   check: a known room detail page, a known kiosk link, the approval queue,
   and `/admin/bookings`.
6. Keep the sheet read-only as a fallback for a few days before deleting the
   `GOOGLE_*` secrets.

---

## Updating after a code change

```bash
cd room-booking-system
git pull
./build.sh
```

`middleware.ts` / `proxy.ts` — auth is currently bypassed for testing.
Re-enable it before real users (see README "Keputusan").

## Common issues

| Symptom | Fix |
|---|---|
| ACME `unable to get ACME account` / challenge fails | Port 80 not open, or DNS not pointing at the instance, or Cloudflare record is proxied (orange cloud). |
| Build OOM-killed on small instance | Add swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` (persist in `/etc/fstab`). |
| App logs `DATABASE_URL tidak diset` | `.env.prod` missing `DATABASE_URL`. |
| App logs `ECONNREFUSED` / `getaddrinfo` for `db` | `db` service not up yet or unhealthy — `docker logs room-booking-db`; app retries on next request. |
| `password authentication failed` | `DATABASE_URL` credentials don't match the `db` service's `POSTGRES_*` (or the managed DB). |
| 404 from Traefik | Container not on `traefik-public` network, or Host rule domain mismatch. |
| Auth redirect loop / callback error | `NEXTAUTH_URL` wrong, or Azure redirect URI not added. |
