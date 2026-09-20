# Approval Engine

Dynamic Workflow & Approval Engine untuk membuat alur persetujuan yang bisa dikonfigurasi dari sisi admin.

Project ini dibuat untuk menangani proses approval seperti pengajuan pembelian, cuti, reimbursement, dan kebutuhan lain yang punya tahapan serta approver berbeda. Workflow bisa diatur tanpa perlu mengubah kode aplikasi.

## Fitur

### Admin

- Membuat dan mengatur workflow.
- Menambahkan stage/tahapan dan menentukan urutannya.
- Menambahkan action seperti setujui atau tolak.
- Menentukan approver berdasarkan role atau user tertentu.
- Membuat field form sesuai kebutuhan, seperti teks, angka, tanggal, dropdown, dan checkbox.
- Mengaktifkan workflow setelah struktur dan konfigurasinya valid.

### Employee

- Membuat request dari workflow yang sedang aktif.
- Menyimpan request sebagai draft.
- Mengajukan request.
- Melihat detail dan riwayat request.

### Approver

- Melihat request yang masuk ke approval queue.
- Memproses request pada stage yang menjadi tanggung jawabnya.
- Menyetujui atau menolak request.
- Memberikan komentar ketika menolak request.

### Lainnya

- Nomor request dibuat otomatis dengan format `REQ-YYYYMMDD-0001`.
- Setiap aktivitas approval disimpan sebagai riwayat.
- JWT digunakan untuk autentikasi.
- Hak akses admin dibatasi berdasarkan role.
- Approver ditentukan dari konfigurasi stage, bukan hanya dari role pada token.
- Employee tidak dapat menyetujui request miliknya sendiri.
- Draft tidak masuk ke approval queue.
- Optimistic locking menggunakan `version` untuk mencegah request diproses dua kali secara bersamaan.

## Tech Stack

| Bagian           | Teknologi                           |
| ---------------- | ----------------------------------- |
| Framework        | Next.js 16 (App Router), React 19   |
| Bahasa           | TypeScript                          |
| Database         | PostgreSQL                          |
| ORM              | Prisma 6                            |
| Authentication   | JWT (`jose`, HS256)                 |
| Password Hashing | `bcryptjs`                          |
| Validation       | Zod 4                               |
| UI               | Tailwind CSS 4, shadcn/ui (Base UI) |
| Icons            | lucide-react                        |
| Notification     | sonner                              |
| Tooling          | `tsx`, ESLint                       |

## Requirements

Sebelum menjalankan project, pastikan sudah tersedia:

- Node.js 20.9 atau lebih baru
- npm
- PostgreSQL 14 atau lebih baru

PostgreSQL bisa dijalankan secara lokal atau menggunakan Docker.

## Installation

Clone repository kemudian install dependency:

```bash
git clone <url-repository>
cd approval-engine
npm install
```

## Environment Variables

Buat file `.env` di root project:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/approval_engine?schema=public"
JWT_SECRET="ganti-dengan-string-acak-minimal-32-karakter"
```

### Environment Variables

| Variable       | Keterangan                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL` | Connection string PostgreSQL. Sesuaikan username, password, host, port, dan nama database. |
| `JWT_SECRET`   | Secret untuk menandatangani JWT. Minimal 32 karakter.                                      |

Untuk membuat secret secara acak:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Jangan commit `.env` ke repository.

## Database Setup

### 1. Buat database

Jika menggunakan Docker, bisa menjalankan PostgreSQL dengan:

```bash
docker run --name approval-db   -e POSTGRES_PASSWORD=postgres   -e POSTGRES_DB=approval_engine   -p 5432:5432   -d postgres:16
```

Jika PostgreSQL sudah tersedia secara lokal, cukup buat database bernama `approval_engine`.

### 2. Jalankan migration

```bash
npx prisma migrate dev
```

Perintah ini akan menjalankan migration dan menyiapkan Prisma Client.

### 3. Jalankan seed

```bash
npx prisma db seed
```

Seed akan membuat data awal untuk kebutuhan development, termasuk role, akun contoh, dan workflow contoh.

Beberapa command Prisma yang berguna:

```bash
npx prisma studio
npx prisma migrate reset
```

> `npx prisma migrate reset` akan menghapus database, menjalankan ulang migration, dan menjalankan seed. Gunakan hanya saat development.

## Menjalankan Project

### Development

```bash
npm run dev
```

Kemudian buka:

http://localhost:3000

### Production

```bash
npx prisma migrate deploy
npm run build
npm start
```

## NPM Scripts

| Command         | Fungsi                           |
| --------------- | -------------------------------- |
| `npm run dev`   | Menjalankan development server   |
| `npm run build` | Build aplikasi untuk production  |
| `npm start`     | Menjalankan aplikasi hasil build |
| `npm run lint`  | Menjalankan ESLint               |

## Akun Development

Akun berikut dibuat oleh seed dan ditujukan untuk development.

Semua akun menggunakan password:

`password123`

| Role     | Nama             | Email                |
| -------- | ---------------- | -------------------- |
| Admin    | Admin            | `admin@gmail.com`    |
| Employee | Andi Pratama     | `employee@gmail.com` |
| Manager  | Helio Warno      | `manager@gmail.com`  |
| Finance  | Farid Zulkarnain | `finance@gmail.com`  |

Jangan menggunakan password tersebut di environment production.

## Contoh Workflow

Project sudah menyediakan contoh workflow **Pengajuan Pembelian**.

Alurnya:

```text
Review Manager
      |
      | setujui
      v
Review Finance
      |
      | setujui
      v
   Approved

Dari kedua stage tersebut, request juga bisa masuk ke:
   Rejected
```

Approver yang digunakan:

| Stage          | Approver                        |
| -------------- | ------------------------------- |
| Review Manager | Role `Manager`                  |
| Review Finance | Role `Finance` dan user `Admin` |

Contoh field yang digunakan dalam form:

- Nominal
- Kategori
- Vendor
- Tanggal dibutuhkan
- Pengajuan mendesak
- Catatan

## Contoh Alur Penggunaan

Untuk mencoba project dari awal, gunakan alur berikut:

1. Login sebagai **Admin** dan buka konfigurasi workflow.
2. Cek workflow **Pengajuan Pembelian** yang dibuat oleh seed.
3. Login sebagai **Employee** dan buat request dari workflow tersebut.
4. Isi form kemudian simpan sebagai draft atau langsung ajukan.
5. Login sebagai **Manager** dan proses request dari approval queue.
6. Jika disetujui, request berpindah ke **Review Finance**.
7. Login sebagai **Finance** dan proses request tersebut.
8. Request dapat disetujui sampai selesai atau ditolak dengan komentar.
9. Buka detail request untuk melihat seluruh riwayat prosesnya.

## Struktur Project

Struktur utama project:

```text
app/
├── api/             Route handler API
├── admin/           Halaman konfigurasi admin
├── dashboard/       Dashboard
├── login/           Halaman login
└── request/         Halaman request

components/
└── ui/              Komponen UI dari shadcn/ui

lib/
├── prisma/          Prisma client
├── auth/            JWT dan authentication
├── validation/      Schema validation
└── workflow/        Logic workflow

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

proxy.ts             Authentication/authorization awal
```

## Authorization

Endpoint API menggunakan authentication dan authorization.

- `/api/*` membutuhkan user yang sudah login.
- `/api/admin/*` membutuhkan role `Admin`.
- Approver hanya dapat memproses request pada stage yang memang menjadi tanggung jawabnya.
- Employee tidak dapat memproses approval untuk request miliknya sendiri.

Selain pengecekan di frontend, aturan tersebut juga divalidasi di backend.

## Concurrency

Request menggunakan kolom `version` untuk optimistic locking.

Ketika sebuah request diproses, server memastikan `version` yang dikirim masih sama dengan versi terakhir di database. Jika request yang sama sudah diproses oleh request lain, update tidak akan dilakukan lagi.

Pendekatan ini digunakan untuk menghindari kondisi ketika dua approver memproses request yang sama secara bersamaan.

## Troubleshooting

### JWT_SECRET error

Jika muncul:

```text
JWT_SECRET wajib diisi dan minimal 32 karakter
```

Pastikan `JWT_SECRET` tersedia di `.env` dan memiliki minimal 32 karakter. Setelah mengubah `.env`, restart development server.

### DATABASE_URL tidak ditemukan

Pastikan:

- PostgreSQL sedang berjalan.
- Database `approval_engine` sudah dibuat.
- `DATABASE_URL` ada di `.env`.
- Connection string sesuai dengan konfigurasi PostgreSQL.

### Prisma Client belum mengenali perubahan schema

Setelah mengubah `schema.prisma`, jalankan:

```bash
npx prisma generate
```

Jika TypeScript server di editor masih menampilkan error, restart TypeScript server atau restart editor.

## Catatan

Project ini dibuat sebagai project pembelajaran sekaligus implementasi workflow approval yang configurable. Fokus utamanya adalah bagaimana workflow, stage, action, approver, request, dan audit trail saling terhubung di backend.
