# Deploy HPP Master di Balik Coolify

Dokumen ini menjelaskan deploy produksi aplikasi HPP Master ke VPS Sumopod Ubuntu dengan domain `hpp-master.profitebel.web.id`, menggunakan proxy Coolify yang sudah terpasang di server.

## Ringkasan arsitektur deploy

- Aplikasi ini diperlakukan sebagai static Vite app.
- Build produksi tetap dibuat dengan `npm ci` lalu `npm run build`.
- Hasil build ada di folder `/var/www/hpp-master/dist`.
- Aplikasi dilayani oleh container `nginx:alpine` sederhana.
- Container frontend dihubungkan ke network Docker `coolify`.
- Routing domain dan HTTPS ditangani oleh proxy Coolify, bukan Nginx host-level biasa.

## Informasi server

- Domain produksi: `hpp-master.profitebel.web.id`
- Public IP VPS: `43.157.204.236`
- SSH user: `ubuntu`
- Lokasi source code: `/var/www/hpp-master`
- Lokasi file deploy Coolify: `/opt/hpp-master`
- Network Docker proxy: `coolify`
- Nama container frontend: `hpp-master`

## Kondisi yang wajib siap

Selesaikan hal berikut sebelum akses publik dianggap final:

1. Pastikan DNS `A record` `hpp-master.profitebel.web.id` mengarah ke `43.157.204.236`.
2. Pastikan domain tersebut bisa di-resolve dari internet, bukan hanya dari panel DNS.
3. Tambahkan `hpp-master.profitebel.web.id` ke Firebase Authentication Authorized Domains.
4. Jika Google Sign-In masih mode testing, masukkan email user produksi ke daftar test users atau publikasikan konfigurasi OAuth/Firebase sesuai kebutuhan.
5. Pastikan repository dapat diakses dari server lewat GitHub.

## Persiapan server

Masuk ke VPS:

```bash
ssh ubuntu@43.157.204.236
```

Verifikasi dependency dasar:

```bash
node -v
npm -v
git --version
sudo docker ps
sudo docker network ls | grep coolify
```

## Deploy pertama

Clone source code:

```bash
sudo mkdir -p /var/www/hpp-master
sudo chown ubuntu:ubuntu /var/www/hpp-master
git clone <repo-url> /var/www/hpp-master
cd /var/www/hpp-master
git checkout <branch>
```

Install dependency dan build:

```bash
cd /var/www/hpp-master
npm ci
npm run build
```

## File deploy untuk Coolify

Buat folder deploy:

```bash
sudo mkdir -p /opt/hpp-master
```

Buat file Nginx di dalam container frontend:

Path:

```text
/opt/hpp-master/default.conf
```

Isi:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Buat file compose:

Path:

```text
/opt/hpp-master/docker-compose.yml
```

Isi:

```yaml
services:
  hpp-master:
    image: nginx:1.27-alpine
    container_name: hpp-master
    restart: unless-stopped
    volumes:
      - /var/www/hpp-master/dist:/usr/share/nginx/html:ro
      - /opt/hpp-master/default.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - coolify
    labels:
      - traefik.enable=true
      - traefik.docker.network=coolify
      - traefik.http.middlewares.hpp-master-redirect.redirectscheme.scheme=https
      - traefik.http.middlewares.hpp-master-gzip.compress=true
      - traefik.http.routers.hpp-master-http.entrypoints=http
      - traefik.http.routers.hpp-master-http.rule=Host(`hpp-master.profitebel.web.id`)
      - traefik.http.routers.hpp-master-http.middlewares=hpp-master-redirect
      - traefik.http.routers.hpp-master-http.service=hpp-master
      - traefik.http.routers.hpp-master-https.entrypoints=https
      - traefik.http.routers.hpp-master-https.rule=Host(`hpp-master.profitebel.web.id`)
      - traefik.http.routers.hpp-master-https.middlewares=hpp-master-gzip
      - traefik.http.routers.hpp-master-https.tls=true
      - traefik.http.routers.hpp-master-https.tls.certresolver=letsencrypt
      - traefik.http.routers.hpp-master-https.service=hpp-master
      - traefik.http.services.hpp-master.loadbalancer.server.port=80

networks:
  coolify:
    external: true
```

Naikkan servicenya:

```bash
cd /opt/hpp-master
sudo docker compose up -d
```

## Verifikasi deploy

Cek container:

```bash
sudo docker compose -f /opt/hpp-master/docker-compose.yml ps
sudo docker ps --filter name=hpp-master
```

Verifikasi HTTP router dari sisi lokal VPS:

```bash
curl -I -H 'Host: hpp-master.profitebel.web.id' http://127.0.0.1
```

Respons yang benar biasanya redirect ke HTTPS.

Verifikasi HTTPS dari sisi lokal VPS:

```bash
curl -k -I --resolve hpp-master.profitebel.web.id:443:127.0.0.1 https://hpp-master.profitebel.web.id
```

Jika DNS sudah benar dan sertifikat sudah terbit, tes tanpa `-k` juga harus berhasil:

```bash
curl -I --resolve hpp-master.profitebel.web.id:443:127.0.0.1 https://hpp-master.profitebel.web.id
```

## Update rutin

Saat ada perubahan baru di repo:

```bash
ssh ubuntu@43.157.204.236
cd /var/www/hpp-master
git pull origin <branch>
npm ci
npm run build
cd /opt/hpp-master
sudo docker compose up -d
```

Karena container membaca folder `dist` dari host, update frontend biasanya cukup dengan rebuild lalu `docker compose up -d`.

## Status deploy saat ini

Langkah berikut sudah berhasil dijalankan di server:

1. Repo di-clone ke `/var/www/hpp-master`.
2. Build produksi berhasil dibuat dengan `npm ci` dan `npm run build`.
3. Container `hpp-master` berhasil dijalankan.
4. Container sudah terhubung ke network `coolify`.
5. Proxy merespons `307 Temporary Redirect` dari HTTP ke HTTPS untuk host `hpp-master.profitebel.web.id`.
6. Proxy merespons `200` di HTTPS saat diuji lokal dengan `--resolve`.

Catatan penting:

- Saat pengecekan terakhir, `hpp-master.profitebel.web.id` belum bisa di-resolve dari server dengan `getent hosts`.
- Karena itu, sertifikat valid Let’s Encrypt belum siap, dan pengecekan HTTPS tanpa `-k` masih menghasilkan self-signed certificate fallback.

## Troubleshooting

### 1. Domain belum resolve

Gejala:

- `getent hosts hpp-master.profitebel.web.id` tidak mengembalikan IP
- browser publik belum bisa membuka domain
- sertifikat valid belum keluar

Solusi:

1. Pastikan `A record` domain mengarah ke `43.157.204.236`.
2. Tunggu propagasi DNS.
3. Ulangi tes:

```bash
getent hosts hpp-master.profitebel.web.id
curl -I http://hpp-master.profitebel.web.id
```

### 2. HTTPS masih self-signed

Gejala:

- `curl -I --resolve ... https://hpp-master.profitebel.web.id` gagal verifikasi SSL

Solusi:

1. Pastikan DNS domain sudah publik dan mengarah benar.
2. Tunggu Coolify atau Traefik mengambil sertifikat Let’s Encrypt.
3. Cek ulang beberapa menit setelah DNS valid.

### 3. Firebase login gagal

Gejala:

- popup Google login ditolak
- Firebase menganggap domain tidak valid

Solusi:

1. Tambahkan `hpp-master.profitebel.web.id` ke Firebase Authorized Domains.
2. Pastikan konfigurasi OAuth/Firebase Auth aktif.
3. Jika masih testing mode, tambahkan email user yang akan dipakai.

### 4. Halaman `404` saat refresh route

Gejala:

- halaman awal terbuka
- refresh di route tertentu gagal

Solusi:

Pastikan file `/opt/hpp-master/default.conf` tetap memakai:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Lalu restart service:

```bash
cd /opt/hpp-master
sudo docker compose up -d
```

## Placeholder yang harus diganti

- `<repo-url>`
- `<branch>`

## Catatan keamanan

- Dokumen ini tidak menyertakan password VPS asli.
- Jika domain berubah, update label host Traefik, DNS, dan Firebase Authorized Domains.
