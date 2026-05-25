# HPP Master

HPP Master adalah aplikasi web multi-tenant untuk pencatatan operasional usaha, perhitungan HPP, kontrol user per bisnis, dan simulasi profit menu F&B. Setiap bisnis memiliki data, user, dan visibilitas menu sendiri yang dipisahkan dengan `business_id`.

## Ringkasan Teknologi

- Frontend: React 19 + TypeScript + Vite
- Backend: Express 4 + Node.js ESM
- Database: PostgreSQL
- Styling: utility class berbasis Tailwind CSS
- Auth: email/password lokal dengan session `httpOnly cookie`
- Data access frontend: `fetch` ke endpoint REST `/api/*`
- Development proxy: Vite meneruskan `/api` ke `http://127.0.0.1:4000`
- State management frontend: React Context melalui `AppProvider`

## Bahasa dan Framework yang Dipakai

- `TypeScript / TSX`
  Dipakai di sisi frontend untuk komponen React, context aplikasi, helper, dan type model.
- `JavaScript ESM`
  Dipakai di sisi backend Express, konfigurasi server, utilitas keamanan, dan akses database.
- `SQL`
  Dipakai untuk migrasi schema PostgreSQL di `server/migrations/001_init.sql`.

## Struktur Kode Aplikasi

```text
Hpp-Master/
├── src/
│   ├── App.tsx                  # Root React app
│   ├── MainApp.tsx              # Shell aplikasi, sidebar, pemilihan view
│   ├── main.tsx                 # Entry point React/Vite
│   ├── index.css                # Global styles
│   ├── store/
│   │   └── AppContext.tsx       # State global, bootstrap data, action CRUD
│   ├── lib/
│   │   ├── api.ts               # Wrapper request frontend ke backend
│   │   ├── auth.ts              # Inisialisasi sesi dan login/logout
│   │   ├── calculators.ts       # Helper perhitungan stok/HPP dasar
│   │   ├── access.ts            # Rule izin role di frontend
│   │   ├── menu-config.ts       # Definisi menu bisnis yang bisa ditampilkan
│   │   └── types.ts             # Type model aplikasi
│   ├── components/
│   │   └── UserManagementSection.tsx
│   └── views/
│       ├── LoginView.tsx
│       ├── Dashboard.tsx
│       ├── InventoryView.tsx
│       ├── PurchasesView.tsx
│       ├── ProductionsView.tsx
│       ├── SalesView.tsx
│       ├── ExpensesView.tsx
│       ├── AdminPanel.tsx
│       └── BusinessCalculatorView.tsx
├── server/
│   ├── index.js                 # Server Express dan semua endpoint REST
│   ├── db.js                    # Koneksi Postgres dan transaction helper
│   ├── config.js                # Loader env dan konfigurasi runtime
│   ├── security.js              # Hash password dan session token
│   ├── utils.js                 # Helper umum backend
│   ├── menu-config.js           # Definisi menu bisnis di backend
│   └── migrations/
│       └── 001_init.sql         # Schema database utama
├── public/                      # Asset statis
├── package.json                 # Script dan dependency project
└── README.md
```

## Arsitektur Modul

### 1. Frontend

Frontend dirender oleh React dan dimulai dari `src/main.tsx`, lalu membungkus aplikasi dengan `AppProvider` di `src/App.tsx`.

`AppProvider` memiliki tanggung jawab utama:

- memeriksa sesi login saat aplikasi dibuka
- memanggil endpoint bootstrap untuk mengambil seluruh data bisnis aktif
- menyimpan state global seperti user, role, item, pembelian, produksi, penjualan, beban, user bisnis, aktivitas, dan visibilitas menu
- menyediakan action CRUD yang dipakai semua halaman

`MainApp.tsx` adalah shell utama aplikasi:

- membangun sidebar
- memilih view aktif
- menyembunyikan atau menampilkan menu berdasarkan `menuVisibility`
- menampilkan `Admin Panel` hanya untuk `super_admin` dan `admin`

### 2. Backend

Backend ada di `server/index.js` dan menggunakan Express untuk:

- autentikasi email/password
- validasi session cookie
- menentukan bisnis aktif user
- menyediakan endpoint CRUD untuk seluruh modul bisnis
- menegakkan role akses `super_admin`, `admin`, dan `staff`
- menyimpan setting visibilitas menu per bisnis

Backend ini menggunakan query SQL langsung melalui helper di `server/db.js`, bukan ORM.

### 3. Database

PostgreSQL menjadi sumber data utama. Tabel inti yang dipakai:

- `businesses`
- `users`
- `business_members`
- `sessions`
- `items`
- `purchases`
- `productions`
- `production_materials`
- `sales`
- `expenses`
- `activity_logs`
- `business_menu_settings`

Relasi utamanya:

- satu `business` memiliki banyak `business_members`
- satu `business` memiliki item, pembelian, produksi, penjualan, beban, log aktivitas, dan setting menu
- satu `user` bisa terhubung ke satu atau lebih bisnis melalui `business_members`

## Role dan Hak Akses

Role bisnis saat ini:

- `super_admin`
  Berperan sebagai pemilik platform. Bisa melihat user lintas bisnis, serta menambah, mengubah, dan menghapus user `super_admin`, `admin`, maupun `staff` di bisnis mana pun, sekaligus membuka/menutup menu bisnis pada bisnis aktif.
- `admin`
  Bisa mengelola user `staff`.
- `staff`
  Tidak punya akses pengelolaan user maupun pengaturan admin.

Catatan:

- halaman login publik hanya menyediakan fitur `Masuk`
- fitur `Daftar` disembunyikan dari UI depan
- akun baru dioperasikan dari panel internal oleh `super_admin`

## Keseluruhan Fitur Aplikasi

### Autentikasi dan sesi

- login email/password
- session cookie `httpOnly`
- bootstrap data otomatis setelah login
- logout dan pembersihan state lokal

### Multi-tenant bisnis

- setiap data bisnis dipisahkan dengan `business_id`
- user aktif selalu bekerja di dalam satu konteks bisnis
- semua query CRUD bisnis dibatasi ke bisnis aktif, kecuali pengelolaan user oleh `super_admin`
- daftar user untuk `super_admin` dapat ditampilkan dan dikelola lintas bisnis

### Dashboard laba rugi

- total penjualan
- total HPP barang terjual
- laba kotor
- laba bersih
- peringatan stok minimum

### Inventori

- tambah/edit/hapus item
- jenis item `RAW`, `HALF_FINISHED`, `FINISHED`
- satuan, stok minimum, dan harga jual

### Pembelian bahan

- catat pembelian bahan baku
- ubah atau hapus transaksi pembelian
- pembelian memengaruhi stok dan rata-rata biaya bahan

### Produksi / HPP

- catat proses produksi barang jadi
- simpan pemakaian bahan baku per produksi
- simpan overhead cost dan total HPP
- hasil produksi menambah stok barang jadi dan mengurangi stok bahan

### Penjualan

- catat penjualan barang jadi
- edit/hapus transaksi penjualan
- penjualan mengurangi stok dan menjadi dasar ringkasan pendapatan

### Beban operasional

- catat biaya non-bahan seperti listrik, sewa, gaji, dll
- edit/hapus beban
- beban dipakai untuk menghitung laba bersih di dashboard

### Manajemen user bisnis

- `super_admin` bisa melihat, membuat, mengubah, dan menghapus user lintas bisnis
- `super_admin` bisa memilih bisnis target saat menambah user dari `Admin Panel`
- `super_admin` bisa mengelola role `super_admin`, `admin`, dan `staff`
- tambah user dengan password langsung agar akun aktif
- buat user tanpa password agar status menjadi undangan
- ubah role user
- isi/reset password user dari modal edit
- hapus akses user dari bisnis

### Admin panel

- ringkasan user dan aktivitas
- manajemen user bisnis
- log aktivitas sistem
- kontrol visibilitas menu per bisnis

### Kalkulator F&B

- simulasi harga jual
- rincian HPP resep per bahan
- biaya marketing, gaji, dan operasional
- target omzet dan target porsi
- hitung unit economics
- hitung net profit dan margin
- export data ke file `.xls`

## Alur Proses Aplikasi

### 1. Saat aplikasi dibuka

1. Frontend memanggil `initAuth()` dari `src/lib/auth.ts`.
2. Backend memeriksa cookie sesi.
3. Jika sesi valid, frontend memanggil `/api/bootstrap`.
4. Backend mengembalikan:
   - info user
   - info bisnis aktif
   - semua collection utama
   - daftar user bisnis
   - activity log
   - setting visibilitas menu
5. `AppContext` menyimpan seluruh data ini ke state global.

### 2. Saat user login

1. `LoginView` mengirim email/password ke `/api/auth/login`.
2. Backend memverifikasi password terhadap tabel `users`.
3. Backend mencari membership aktif user di `business_members`.
4. Jika valid, backend membuat session di tabel `sessions`.
5. Token sesi dikirim sebagai cookie `httpOnly`.
6. Frontend melakukan bootstrap ulang agar semua data bisnis masuk ke state.

### 3. Saat transaksi bisnis dibuat atau diubah

1. User mengisi form pada salah satu view.
2. View memanggil action dari `AppContext`.
3. `AppContext` memanggil helper di `src/lib/api.ts`.
4. Backend menjalankan query SQL ke PostgreSQL.
5. Respons hasil simpan dikembalikan ke frontend.
6. State lokal diperbarui tanpa perlu reload halaman.
7. Aktivitas user dicatat ke `activity_logs`.

### 4. Saat super admin mengelola user

1. Super admin membuka `Admin Panel`.
2. Frontend mengirim request ke `/api/members` atau `/api/members/:id`.
3. Backend memeriksa role aktif user dan menentukan bisnis target jika diperlukan.
4. Backend membuat, mengubah, mengaktifkan, atau menghapus membership user bisnis, termasuk lintas bisnis untuk `super_admin`.
5. Jika password diberikan untuk user baru atau undangan, backend juga membuat atau memperbarui record di tabel `users`.
6. Frontend memperbarui daftar user bisnis dan mencatat log aktivitas.

### 5. Saat super admin membuka atau menutup menu

1. Toggle di `AdminPanel` memanggil endpoint `/api/business/menu-visibility/:menuKey`.
2. Backend menyimpan hasilnya di `business_menu_settings`.
3. Frontend menerima `menuVisibility` terbaru.
4. Sidebar `MainApp` langsung menyesuaikan menu yang tampil.

## Interaksi Frontend, Backend, dan Database

### Gambaran umum

```text
Browser / React UI
    ↓
AppContext + api.ts
    ↓ HTTP / JSON + Cookie Session
Express API (/api/*)
    ↓ SQL Query / Transaction
PostgreSQL
```

### Penjelasan interaksi

- Frontend tidak pernah mengakses database secara langsung.
- Semua data melewati backend Express.
- Backend bertanggung jawab atas:
  - autentikasi
  - otorisasi role
  - validasi bisnis aktif
  - transaksi database
  - pembentukan payload yang aman untuk frontend
- Database hanya menerima operasi dari backend melalui `pg`.

### Contoh aliran data per modul

- Inventori:
  `InventoryView` → `AppContext.addItem()` → `appApi.items.create()` → `POST /api/items` → insert ke `items`
- Produksi:
  `ProductionsView` → `POST /api/productions` → insert ke `productions` dan `production_materials` dalam transaction
- User bisnis:
  `AdminPanel` / `UserManagementSection` → `POST/PUT/DELETE /api/members` → update `users` dan/atau `business_members`
- Visibilitas menu:
  `AdminPanel` → `PUT /api/business/menu-visibility/:menuKey` → upsert ke `business_menu_settings`

## File Penting untuk Dipahami Developer

- `src/store/AppContext.tsx`
  Titik pusat state aplikasi dan action CRUD frontend.
- `src/lib/api.ts`
  Pintu utama komunikasi frontend ke backend.
- `server/index.js`
  Semua endpoint inti aplikasi berada di sini.
- `server/migrations/001_init.sql`
  Menjelaskan seluruh model data bisnis.
- `src/MainApp.tsx`
  Shell aplikasi, sidebar, dan panel akun.
- `src/components/UserManagementSection.tsx`
  Tabel dan aksi pengelolaan user bisnis.
- `src/views/AdminPanel.tsx`
  Ringkasan admin, manajemen user, dan kontrol menu bisnis.

## Menjalankan Project

### Prasyarat

- Node.js
- PostgreSQL

### Environment minimum

Buat `.env` atau `.env.local` dengan nilai minimal:

```env
DATABASE_URL=postgres://user:password@host:5432/hpp_master
APP_URL=http://localhost:3000
PORT=4000
AUTO_MIGRATE=true
SESSION_COOKIE_NAME=hpp_session
SESSION_TTL_DAYS=14
NODE_ENV=development
```

### Perintah lokal

```bash
npm install
npm run dev:server
npm run dev
```

Frontend development berjalan di `http://localhost:3000` dan backend default di `http://localhost:4000`.

Saat development:

- browser mengakses frontend Vite di port `3000`
- request `fetch('/api/...')` dari frontend diteruskan oleh proxy Vite ke backend port `4000`
- backend berkomunikasi langsung ke PostgreSQL

Saat production build:

- jalankan `npm run build`
- folder `dist/` akan dihasilkan oleh Vite
- `server/index.js` dapat menyajikan asset frontend build sekaligus endpoint API dari proses Express yang sama

## Build dan Validasi

Perintah yang umum dipakai:

```bash
npm run lint
npm run build
node --check server/index.js
```

## Catatan Pengembangan

- Backend masih memakai satu file route utama (`server/index.js`), sehingga jika fitur bertambah besar sebaiknya dipisah per domain.
- Endpoint `signup` backend masih ada untuk kebutuhan provisioning/migrasi internal, tetapi UI publik saat ini tidak menampilkannya.
- Fitur `Isi Otomatis` pada kalkulator F&B belum dihubungkan ke API AI aktif pada build saat ini.
