# Deploy HPP Master via Coolify

Dokumen ini menjelaskan arsitektur dan prosedur deploy produksi aplikasi HPP Master di VPS Sumopod Ubuntu menggunakan Coolify sebagai source of truth deploy.

## Ringkasan

- Domain produksi: `https://hpp-master.profitebel.web.id`
- VPS: `43.157.204.236`
- SSH user: `ubuntu`
- Coolify project: `HPP Master`
- Coolify environment: `production`
- Coolify application name: `hpp-master`
- Repository: `RespatiBayu/Hpp-Master`
- Branch produksi: `migrate-to-postgre`
- Runtime: aplikasi Node/Express dari `Dockerfile`
- Exposed port: `4000`
- Healthcheck: `GET /api/health`

## Arsitektur deploy saat ini

- Deploy produksi dikelola penuh dari Coolify, bukan lagi dari `docker compose` manual.
- Coolify menarik source code langsung dari GitHub branch `migrate-to-postgre`.
- Image dibangun dari `Dockerfile` yang ada di repository.
- Aplikasi berjalan sebagai service Node/Express tunggal dan melayani frontend + API dari container yang sama.
- HTTPS, routing domain, dan proxy dikelola oleh Coolify/Traefik.
- Database produksi tetap memakai database PostgreSQL yang sama seperti sebelum migrasi.

## Informasi operasional penting

- URL aplikasi publik: `https://hpp-master.profitebel.web.id`
- Endpoint health publik: `https://hpp-master.profitebel.web.id/api/health`
- Endpoint health internal container: `http://localhost:4000/api/health`
- Auto Deploy: `OFF`
- Force HTTPS: `ON`
- Gzip: `ON`
- Persistent storage: tidak digunakan

Rollback material deploy lama masih ada di VPS:

- Source lama: `/var/www/hpp-master`
- Compose lama: `/opt/hpp-master/docker-compose.yml`

Catatan:

- Deploy manual lama sekarang harus tetap `down` dan hanya dipakai jika perlu rollback darurat.
- Source of truth operasional sekarang adalah konfigurasi resource di Coolify.

## Environment variables produksi

Set variabel berikut di Coolify pada resource `hpp-master`:

- `NODE_ENV=production`
- `PORT=4000`
- `APP_URL=https://hpp-master.profitebel.web.id`
- `AUTO_MIGRATE=true`
- `SESSION_COOKIE_NAME=<nilai produksi aktif>`
- `SESSION_TTL_DAYS=<nilai produksi aktif>`
- `DATABASE_URL=<database produksi aktif>`

Jangan commit secret ke repository. Semua secret harus dikelola di Coolify.

## Checklist setup Coolify

Konfigurasi yang harus aktif pada resource produksi:

- Project baru `HPP Master`
- Environment `production`
- Source: `Public GitHub`
- Repository: `RespatiBayu/Hpp-Master`
- Branch: `migrate-to-postgre`
- Build Pack: `Dockerfile`
- Port exposed: `4000`
- Domain: `https://hpp-master.profitebel.web.id`
- Healthcheck:
  - Type: `HTTP`
  - Method: `GET`
  - Host: `localhost`
  - Port: `4000`
  - Path: `/api/health`
  - Expected status: `200`

## Deploy rutin

Alur deploy normal sekarang:

1. Push perubahan ke branch `migrate-to-postgre`.
2. Buka Coolify project `HPP Master`.
3. Pilih application `hpp-master`.
4. Masuk ke tab `Deployments`.
5. Jalankan deploy manual.
6. Tunggu status menjadi `Running (healthy)`.
7. Verifikasi endpoint publik.

## Verifikasi setelah deploy

Lakukan verifikasi berikut setiap selesai deploy:

```bash
curl -I https://hpp-master.profitebel.web.id
curl -s https://hpp-master.profitebel.web.id/api/health
```

Hasil yang diharapkan:

- Root URL mengembalikan `200`
- `/api/health` mengembalikan `{"ok":true}`
- UI aplikasi bisa dibuka
- Session login tetap bekerja

Jika perlu verifikasi dari browser, buka:

- `https://hpp-master.profitebel.web.id`
- `https://hpp-master.profitebel.web.id/api/health`

## Prosedur cutover yang sudah dipakai

Migrasi dari deploy manual ke Coolify dilakukan dengan urutan berikut:

1. Buat project Coolify baru `HPP Master`.
2. Buat resource aplikasi `hpp-master`.
3. Konfigurasi source GitHub, branch, Dockerfile, env vars, dan healthcheck.
4. Deploy pertama di temporary domain Coolify.
5. Verifikasi staging di temporary domain dan `/api/health`.
6. Matikan deploy manual lama di VPS.
7. Pasang domain produksi `hpp-master.profitebel.web.id` ke resource Coolify.
8. Verifikasi domain publik dan endpoint health publik.

## Rollback

Jika deploy Coolify baru gagal dan perlu rollback cepat:

1. Lepas domain produksi dari resource Coolify atau nonaktifkan routing domain pada resource tersebut.
2. Masuk ke VPS.
3. Naikkan kembali deploy manual lama:

```bash
ssh ubuntu@43.157.204.236
cd /opt/hpp-master
sudo docker compose up -d
```

4. Verifikasi domain publik kembali merespons.

Setelah insiden selesai, evaluasi apakah rollback material lama masih perlu dipertahankan.

## Troubleshooting

### 1. Deploy selesai tetapi status tidak healthy

Periksa:

- tab `Deployments` di Coolify
- tab `Logs` di Coolify
- nilai `PORT`
- healthcheck path `/api/health`
- koneksi `DATABASE_URL`

### 2. Domain publik tidak membuka aplikasi

Periksa:

- domain pada field `Domains` di Coolify
- status deploy `Running`
- DNS `A record` ke `43.157.204.236`
- apakah deploy manual lama masih aktif dan bentrok

### 3. Session/login bermasalah

Periksa:

- `APP_URL`
- `NODE_ENV=production`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_DAYS`
- akses HTTPS publik

### 4. Perlu cek deploy manual lama

Gunakan hanya untuk rollback atau audit:

```bash
ssh ubuntu@43.157.204.236
cd /opt/hpp-master
sudo docker compose ps
```

Jika migrasi Coolify sudah stabil, deploy manual lama sebaiknya tetap dalam keadaan nonaktif.
