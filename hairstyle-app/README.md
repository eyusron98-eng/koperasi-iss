# Rekomendasi Gaya Rambut AI

Aplikasi web yang menganalisis foto wajah pengguna dan merekomendasikan gaya rambut yang cocok, menggunakan Claude Vision (Anthropic API).

## Cara Kerja

1. Pengguna mengunggah foto selfie + memilih preferensi (gender, panjang rambut).
2. Foto dikirim ke API route `/api/analyze` di server (bukan langsung dari browser ke Anthropic) agar API key tidak terekspos.
3. Server memanggil Claude Vision (`claude-haiku-4-5`) untuk mendeteksi bentuk wajah dan menghasilkan rekomendasi gaya rambut dalam format JSON.
4. Hasil ditampilkan di UI.

Jika `ANTHROPIC_API_KEY` belum diset, aplikasi otomatis berjalan dalam **mode demo** (menampilkan data contoh) supaya UI tetap bisa dicoba tanpa API key.

## Setup

### 1. Dapatkan Anthropic API Key

1. Buka [console.anthropic.com](https://console.anthropic.com)
2. Daftar/login, lalu buka menu **API Keys** → **Create Key**
3. Isi saldo billing secukupnya (biaya per analisis foto sangat kecil, model yang dipakai adalah Claude Haiku)

### 2. Install dependencies

```bash
npm install
```

### 3. Konfigurasi environment variable

```bash
cp .env.local.example .env.local
```

Lalu isi `ANTHROPIC_API_KEY` di `.env.local` dengan key asli kamu. Tanpa ini, aplikasi tetap jalan tapi dalam mode demo (hasil contoh, bukan analisis foto asli).

### 4. Jalankan development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Deploy ke Vercel

1. Push project ini ke repository GitHub
2. Import project di [vercel.com/new](https://vercel.com/new)
3. Tambahkan environment variable `ANTHROPIC_API_KEY` di pengaturan project Vercel (Settings → Environment Variables)
4. Deploy

## Struktur Proyek

```
app/
  api/analyze/route.ts   # API route yang memanggil Claude Vision
  page.tsx                # UI utama (upload foto, form preferensi, hasil)
  layout.tsx
lib/
  types.ts                 # Tipe data bersama frontend/backend
  mockResult.ts             # Data contoh untuk mode demo
.env.local.example
```

## Catatan Privasi

Foto yang diunggah hanya dikirim ke Anthropic API untuk dianalisis dan tidak disimpan di server maupun database.
