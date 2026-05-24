<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/14bc0814-8b23-4820-97b7-fefab4fc4c40

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `pnpm install` atau `npm install`
2. Isi `.env.local` dengan minimal `DATABASE_URL`, `APP_URL`, dan jika perlu `GEMINI_API_KEY`
3. Jalankan backend:
   `npm run dev:server`
4. Jalankan frontend:
   `npm run dev`

## Arsitektur saat ini

- Frontend: React + Vite
- Backend: Express
- Database: Postgres
- Auth: email/password lokal dengan `httpOnly cookie`
- Multi-tenant: satu aplikasi bisa menampung banyak bisnis

## Setup Postgres

- Buat database kosong, misalnya `hpp_master`
- Isi `DATABASE_URL` ke Postgres VPS Anda
- Saat backend start dengan `AUTO_MIGRATE=true`, tabel dasar akan dibuat otomatis dari `server/migrations/001_init.sql`

## Flow akun

- User yang belum diundang bisa mendaftar dan membuat bisnis baru
- User yang sudah diundang owner/admin bisa mendaftar memakai email yang sama untuk masuk ke bisnis tersebut
