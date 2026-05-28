# Rencana Pemisahan Fitur PoS dari HPP Master

## Tujuan

Memisahkan fitur PoS menjadi produk yang utuh untuk operasional staf bisnis, tanpa mengganggu fungsi `hpp-master` yang sudah berjalan sebagai aplikasi backoffice untuk admin bisnis dan super admin.

Target akhirnya:

- `hpp-master` tetap menjadi pusat admin bisnis:
  - dashboard
  - inventori
  - pembelian
  - produksi / HPP
  - penjualan dan laporan
  - beban operasional
  - admin panel
- aplikasi PoS menjadi kanal operasional staf:
  - transaksi kasir harian
  - checkout cepat
  - histori transaksi kasir
  - ringkasan shift
  - kontrol akses staf yang lebih sempit dan aman

## Ringkasan Rekomendasi

Rekomendasi implementasi adalah:

1. pisahkan PoS sebagai aplikasi frontend terpisah
2. tetap gunakan backend dan database yang sama pada fase awal
3. rapikan model data transaksi PoS terlebih dahulu sebelum PoS dipisah penuh
4. jadikan `hpp-master` sebagai backoffice, bukan layar operasional kasir

Alasan utama:

- risiko implementasi lebih rendah
- stok, HPP, dan laporan tetap konsisten
- admin bisnis tidak perlu pindah workflow
- staff mendapat pengalaman PoS yang lebih sederhana dan fokus

## Kondisi Saat Ini di Repository

Saat ini PoS masih menjadi bagian dari aplikasi `hpp-master`, bukan produk terpisah.

Temuan penting dari kode saat ini:

- menu PoS masih menjadi salah satu tab di konfigurasi menu bisnis pada `src/lib/menu-config.ts`
- tampilan kasir ada di `src/views/PosView.tsx`
- checkout PoS dipanggil dari `AppContext` melalui `checkoutPosSale()`
- endpoint `POST /api/pos/checkout` di `server/index.js` langsung membuat baris ke tabel `sales`
- bootstrap aplikasi di `server/index.js` masih memuat hampir semua data bisnis ke frontend:
  - `items`
  - `purchases`
  - `productions`
  - `sales`
  - `expenses`
  - `appUsers`
  - `activities`
- role `staff` sudah ada, tetapi boundary aplikasi masih belum tegas karena pembatasan utama masih di menu/UI, bukan di pemisahan aplikasi dan payload

Implikasinya:

- PoS saat ini masih terasa sebagai "mode kasir" di dalam backoffice
- data yang diterima staf lebih banyak dari yang sebenarnya dibutuhkan
- model transaksi PoS belum cukup kaya untuk disebut PoS utuh karena belum punya konsep order header, pembayaran, shift kasir, atau refund flow

## Target Arsitektur

### 1. Posisi Produk

`hpp-master`:

- tetap dipakai admin bisnis dan super admin
- fokus pada pengelolaan master data dan pelaporan
- menjadi sumber konfigurasi produk, harga, kategori, dan aturan bisnis

`hpp-pos`:

- dipakai staff bisnis untuk transaksi harian
- fokus pada kecepatan, kesederhanaan, dan stabilitas operasional
- hanya memuat data yang relevan untuk kasir

### 2. Prinsip Integrasi

- tetap satu sumber data bisnis per `business_id`
- item, harga jual, kategori, dan stok tetap dikelola dari `hpp-master`
- transaksi PoS tetap mengalir ke laporan bisnis yang dilihat admin
- otorisasi dibatasi berdasarkan peran dan jenis aplikasi

### 3. Boundary yang Disarankan

Boundary minimum yang sehat:

- frontend admin terpisah dari frontend PoS
- bootstrap admin terpisah dari bootstrap PoS
- endpoint admin terpisah dari endpoint PoS
- model transaksi PoS dibedakan dari input penjualan manual

## Scope PoS Utuh untuk Staf

Supaya benar-benar menjadi PoS utuh, fitur minimum yang disarankan untuk aplikasi PoS adalah:

### Fitur inti fase awal

- login staff
- pilih bisnis aktif sesuai membership
- katalog produk siap jual
- filter kategori dan pencarian produk
- keranjang transaksi
- validasi stok real-time saat checkout
- input pembayaran tunai
- hitung kembalian
- simpan transaksi dan cetak / tampilkan struk sederhana
- histori transaksi hari ini untuk kasir

### Fitur operasional yang sebaiknya ikut direncanakan

- buka shift kasir
- tutup shift kasir
- ringkasan kas harian per shift
- identitas kasir pada setiap transaksi
- transaksi void / pembatalan dengan jejak audit
- refund terbatas dengan approval admin

### Fitur lanjutan setelah stabil

- multi-metode pembayaran
- hold / resume cart
- printer thermal
- cash drawer integration
- mode tablet / mobile
- antrean offline sementara jika koneksi putus

## Perubahan Model Data yang Dibutuhkan

Saat ini PoS langsung menulis banyak baris ke tabel `sales`. Itu cukup untuk pencatatan penjualan sederhana, tetapi kurang ideal untuk PoS utuh.

### Masalah model saat ini

- satu checkout PoS belum punya entitas transaksi induk
- pembayaran belum tersimpan sebagai data tersendiri
- kasir yang memproses transaksi belum menjadi bagian utama dari model transaksi
- belum ada struktur untuk shift, refund, void, atau audit PoS yang rapi

### Model data target yang disarankan

Tambahkan entitas baru:

- `pos_orders`
  - header transaksi
  - nomor struk
  - business id
  - cashier / member id
  - tanggal dan waktu
  - status transaksi
  - subtotal, total, uang bayar, kembalian
  - payment method
- `pos_order_lines`
  - item
  - qty
  - harga jual per item saat transaksi
  - line total
- `pos_cash_sessions`
  - shift buka/tutup
  - modal awal kas
  - kas akhir
  - selisih
- `pos_order_events` atau perluasan `activity_logs`
  - audit untuk void, refund, reopen, close shift

### Relasi dengan tabel `sales`

Ada dua opsi:

1. `sales` tetap dipakai sebagai tabel ringkasan akuntansi/laporan, lalu diisi dari transaksi PoS
2. `sales` digeser menjadi projection/reporting dari `pos_orders` dan `pos_order_lines`

Rekomendasi fase awal:

- pertahankan `sales` agar dashboard dan laporan existing tidak langsung rusak
- tambahkan penanda sumber transaksi seperti `source = 'manual' | 'pos'`
- setiap checkout PoS membuat:
  - record transaksi PoS lengkap
  - record ringkasan ke `sales` untuk kompatibilitas laporan existing

Dengan begitu pemisahan bisa dilakukan bertahap tanpa memaksa refactor besar di semua view laporan.

## Perubahan API yang Dibutuhkan

### API admin tetap di `hpp-master`

Contoh area API yang tetap milik admin:

- item master
- harga jual
- kategori produk
- pembelian bahan
- produksi
- beban
- user management
- menu/package management
- laporan penjualan

### API khusus PoS

Disarankan menambah endpoint khusus PoS:

- `GET /api/pos/bootstrap`
- `GET /api/pos/catalog`
- `POST /api/pos/orders`
- `GET /api/pos/orders/today`
- `POST /api/pos/shifts/open`
- `POST /api/pos/shifts/close`
- `POST /api/pos/orders/:id/void`
- `POST /api/pos/orders/:id/refund`

### Catatan penting

Jangan gunakan payload bootstrap yang sama antara admin dan PoS.

Bootstrap PoS idealnya hanya berisi:

- identitas user
- identitas bisnis aktif
- katalog produk siap jual
- stok tersedia
- konfigurasi kasir yang relevan
- transaksi hari ini yang relevan bagi kasir
- shift aktif jika ada

Ini penting agar aplikasi PoS tetap ringan, aman, dan fokus.

## Perubahan Frontend yang Dibutuhkan

### Arah yang direkomendasikan

Buat aplikasi frontend PoS terpisah, misalnya:

- `apps/hpp-admin` atau tetap root project sekarang untuk backoffice
- `apps/hpp-pos` untuk kasir

Jika belum ingin langsung monorepo multi-app, alternatif sementara:

- tetap satu repo
- tambah entry/frontend app baru untuk PoS
- pisahkan route, bundle, dan layout

### HPP Master setelah split

Menu PoS di `hpp-master` sebaiknya berubah fungsi menjadi salah satu dari dua opsi:

1. dihapus dari sidebar staff dan admin setelah PoS baru stabil
2. diubah menjadi halaman monitoring transaksi PoS, bukan layar kasir

Rekomendasi:

- jadikan PoS di `hpp-master` sebagai monitoring atau redirect ke aplikasi PoS
- jangan pertahankan dua layar kasir aktif terlalu lama karena rawan beda perilaku

### Aplikasi PoS baru

Frontend PoS harus punya:

- layout sederhana, fokus sentuh/click cepat
- login dan validasi role staff
- daftar produk siap jual
- keranjang
- checkout
- histori transaksi singkat
- shift drawer / kasir

## Perubahan Hak Akses

Model peran yang disarankan:

- `super_admin`
  - tetap penuh di `hpp-master`
- `admin`
  - tetap penuh di `hpp-master`
  - bisa melihat laporan PoS
  - bisa approval refund/void tertentu
- `staff`
  - default masuk ke aplikasi PoS
  - tidak memerlukan akses ke seluruh data backoffice

Tambahan yang sebaiknya dibuat:

- permission berbasis capability, tidak hanya role global
- contoh capability:
  - `pos.access`
  - `pos.checkout`
  - `pos.refund`
  - `pos.close_shift`
  - `sales.manual_input`

Ini akan membantu jika nanti ada variasi role operasional.

## Tahapan Implementasi

### Fase 0 - Alignment bisnis dan teknis

Output:

- definisi apa yang dimaksud "PoS utuh"
- daftar fitur minimum saat go-live
- keputusan apakah admin tetap boleh input penjualan manual di `SalesView`
- keputusan apakah struk, shift, dan refund masuk fase 1 atau fase 2

Checklist:

- sepakati scope MVP PoS
- sepakati target user utama: staff kasir
- sepakati bahwa `hpp-master` tetap backoffice

### Fase 1 - Rapikan domain transaksi PoS di backend

Output:

- tabel baru untuk order PoS dan shift
- endpoint PoS baru
- kompatibilitas laporan existing tetap aman

Pekerjaan:

- tambahkan migrasi tabel PoS
- tambahkan `source` atau penanda kanal di `sales`
- ekstrak logic checkout dari `server/index.js` menjadi service yang lebih modular
- simpan identitas kasir dan data pembayaran

Acceptance criteria:

- satu checkout PoS menghasilkan transaksi yang bisa diaudit
- laporan penjualan existing masih tetap berjalan
- stok tetap berkurang konsisten

### Fase 2 - Pisahkan bootstrap dan otorisasi

Output:

- payload PoS lebih kecil
- boundary staff vs admin lebih tegas

Pekerjaan:

- buat `GET /api/pos/bootstrap`
- kurangi data yang dikirim ke staff
- pastikan staff tidak lagi menerima payload admin yang tidak perlu
- buat guard role/capability di endpoint PoS

Acceptance criteria:

- staff bisa menjalankan PoS tanpa menerima seluruh data backoffice
- admin tetap memakai bootstrap existing

### Fase 3 - Bangun frontend PoS terpisah

Output:

- aplikasi PoS baru siap dipakai internal

Pekerjaan:

- buat shell frontend PoS
- pindahkan logic dari `src/views/PosView.tsx` ke app baru
- buat state khusus PoS, jangan bergantung ke seluruh `AppContext` existing
- buat UX kasir yang lebih cepat dan sederhana

Acceptance criteria:

- staff bisa login dan checkout dari aplikasi PoS terpisah
- admin tidak perlu memakai PoS app untuk pekerjaan backoffice

### Fase 4 - Monitoring dan reporting di HPP Master

Output:

- admin tetap bisa memonitor hasil PoS tanpa menjadi user operasional kasir

Pekerjaan:

- ubah halaman PoS existing menjadi monitoring atau redirect
- tampilkan sumber transaksi: manual vs PoS
- tambahkan filter kasir, shift, dan kanal transaksi bila data sudah tersedia

Acceptance criteria:

- admin tetap melihat seluruh dampak penjualan PoS pada laporan
- tidak ada kebingungan antara penjualan manual dan penjualan kasir

### Fase 5 - Rollout bertahap

Output:

- transisi aman tanpa memutus operasional bisnis

Pekerjaan:

- uji pilot pada 1 bisnis terlebih dahulu
- bandingkan total transaksi PoS vs laporan `sales`
- siapkan fallback jika PoS baru mengalami kendala
- nonaktifkan layar PoS lama setelah pilot stabil

Acceptance criteria:

- bisnis pilot bisa menjalankan transaksi harian tanpa kembali ke PoS lama
- tim admin tetap nyaman memakai `hpp-master`

## Risiko Utama dan Mitigasi

### 1. Laporan admin berubah atau rusak

Risiko:

- dashboard, penjualan, dan laba rugi existing bergantung pada tabel `sales`

Mitigasi:

- jangan langsung mengganti seluruh laporan ke model baru
- pakai pendekatan kompatibilitas bertahap
- tambahkan source/channel transaksi lebih dulu

### 2. Inkonsistensi stok saat trafik checkout naik

Risiko:

- checkout paralel bisa menimbulkan oversell jika lock transaksi tidak kuat

Mitigasi:

- semua checkout PoS tetap wajib lewat database transaction
- perketat validasi stok pada saat commit, bukan hanya saat render UI

### 3. Staff masih menerima data backoffice yang tidak perlu

Risiko:

- payload berat
- akses data terlalu luas

Mitigasi:

- pisahkan bootstrap PoS
- audit endpoint yang masih bisa dipanggil staff

### 4. Dua aplikasi kasir hidup bersamaan terlalu lama

Risiko:

- perilaku berbeda
- bug sulit dilacak

Mitigasi:

- tentukan cutover date
- jadikan PoS lama read-only, monitoring-only, atau redirect setelah PoS baru siap

## Keputusan Produk yang Perlu Disepakati Sejak Awal

Sebelum implementasi, ada beberapa keputusan penting:

1. apakah `SalesView` tetap dipakai admin untuk input penjualan manual non-PoS
2. apakah semua penjualan staff wajib lewat aplikasi PoS
3. apakah refund menjadi bagian MVP atau fase berikutnya
4. apakah shift kasir wajib pada go-live pertama
5. apakah PoS perlu cetak struk fisik sejak awal

## Urutan Eksekusi yang Paling Aman

Urutan yang saya sarankan:

1. rapikan model data PoS
2. pisahkan API dan bootstrap PoS
3. bangun frontend PoS terpisah
4. ubah PoS lama di `hpp-master` menjadi monitoring/redirect
5. rollout bertahap per bisnis

## Hasil Akhir yang Diinginkan

Jika rencana ini dijalankan, maka hasil akhirnya adalah:

- admin bisnis tetap nyaman memakai `hpp-master` existing
- staf bisnis memakai aplikasi PoS yang lebih fokus dan ringan
- stok, HPP, dan laporan tetap tersambung ke sistem yang sama
- PoS tidak lagi hanya menjadi halaman tambahan, tetapi menjadi modul operasional yang utuh
