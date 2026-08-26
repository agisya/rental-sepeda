# Rental Sepeda Garut

Aplikasi pencatatan rental sepeda per jam dengan bagi hasil pemilik. Alur kerjanya:
scan QR → mulai rental → scan lagi saat kembali → sistem menghitung durasi,
biaya, dan bagi hasil → semuanya masuk laporan harian.

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Postgres · Drizzle ORM · 340 tes

<!--
  TANGKAPAN LAYAR — belum ada berkasnya, jadi bloknya dinonaktifkan dulu supaya
  README tidak menampilkan ikon gambar rusak.

  Cara menyalakan: simpan tiga berkas di docs/gambar/ dengan nama persis seperti
  di bawah, lalu hapus baris pembuka komentar di atas dan baris penutupnya setelah
  tabel. Ambil dari alamat produksi memakai akun demo, bukan dari localhost, supaya
  datanya sama dengan yang dilihat pengunjung. Rinciannya ada di bagian
  "Tangkapan layar dan alamat".

![Dashboard](docs/gambar/dashboard.png)

| | |
| --- | --- |
| ![Scan QR](docs/gambar/scan.png) | ![Laporan harian](docs/gambar/laporan.png) |

-->

## Coba langsung

**https://rental-sepeda.vercel.app** — masuk dengan:

| Username | Kata sandi |
| --- | --- |
| `demo` | `demo-rental-2026` |

Akun demo berperan **kasir**: bisa scan QR, memulai dan menyelesaikan rental, serta
membuka seluruh laporan. Menu Pengeluaran dan Laba/Rugi sengaja tertutup untuk peran
ini. Datanya data contoh, jadi silakan dipakai sesuka hati.

## Masalah yang dipecahkan

Rental sepeda menghitung sewa per jam, dan sebagian besar sepedanya milik orang lain
yang menitipkan dengan pembagian hasil berbeda-beda — 60%, 55%, ada yang milik rental
sendiri. Pencatatan di buku membuat tiga hal gampang salah: durasi sewa yang dihitung
kasar, hak tiap pemilik yang harus direkap manual tiap bulan, dan sepeda yang lupa
tercatat sudah kembali.

Aplikasi ini memakai stiker QR di tiap sepeda sebagai penggantinya. Satu scan memulai
rental, satu scan lagi menutupnya, dan seluruh perhitungan — durasi, tarif, denda
keterlambatan, bagi hasil pemilik — jatuh ke laporan tanpa disentuh tangan.

## Keputusan teknis

Bagian yang menarik dari proyek ini bukan daftar fiturnya, melainkan beberapa
persoalan yang baru kelihatan setelah dipakai:

**Satu skema, tiga driver database.** `DATABASE_URL` yang dikosongkan menjalankan
Postgres di dalam proses lewat PGlite, sehingga `git clone && npm run dev` langsung
bisa dipakai tanpa mendaftar layanan apa pun dan tanpa internet. Alamat berakhiran
`.neon.tech` memakai driver WebSocket Neon, sisanya driver Postgres biasa. Ketiganya
Postgres yang sama, jadi query dan migrasinya cuma ditulis sekali —
[`lib/db/mode.ts`](lib/db/mode.ts), [`lib/db/index.ts`](lib/db/index.ts).

**Satu permintaan halaman pernah menggantung 56 menit.** Bawaan `connectionTimeoutMillis`
pada `pg` adalah `0`, yang berarti menunggu selamanya. Ketika Postgres berada di VPS
lain dan jaringannya tersendat, halaman tidak gagal — ia diam. Ditambah
`idleTimeoutMillis` bawaan 10 detik yang selalu keburu menutup koneksi sebelum
penjajakan 60-detik berikutnya, dan itulah sumber `ECONNRESET` yang berulang —
[`lib/db/index.ts:59-79`](lib/db/index.ts#L59-L79).

**Halaman pendaftaran yang membeku saat build.** Halaman pembuatan akun pertama tidak
menyentuh cookie maupun `searchParams`, jadi Next menganggapnya bisa dibuat statis.
Akibatnya hasil pemeriksaan "apakah sistem masih kosong" ikut membeku ke dalam berkas:
build berjalan di mesin tanpa database, pemeriksaan gagal, pintu dinyatakan tertutup
selamanya, dan akun pertama tidak akan pernah bisa dibuat. Obatnya `await connection()`
— [`app/register/page.tsx:24-36`](app/register/page.tsx#L24-L36).

**Server menolak menyala daripada diam-diam kehilangan data.** `DATABASE_URL` kosong
berarti "pakai PGlite", dan itu benar saat pengembangan. Di produksi arti yang sama
berubah jadi jebakan: aplikasi tetap melayani, tapi menulis ke berkas yang lenyap tiap
instance baru dibuat. Gejalanya bukan galat melainkan data yang hilang tanpa jejak,
jadi keadaan itu dibuat menggagalkan startup — [`instrumentation.ts`](instrumentation.ts).

**Kamera hanya jalan di alamat aman.** Menguji scan QR dari HP lewat `http://192.168.x.x`
tidak akan pernah berhasil, berapa kali pun dicoba. `npm run dev:hp` menyalakan server
ber-HTTPS dengan sertifikat buatan sendiri supaya kameranya bisa dibuka.

## Menjalankan di komputer sendiri

Cukup dua perintah. Tidak perlu mendaftar layanan apa pun dan tidak perlu internet.

```bash
npm run db:seed     # membuat tabel + mengisi 3 akun, 3 pemilik, 10 sepeda
npm run dev
```

Buka http://localhost:3000 lalu masuk:

| Username | Kata sandi | Peran |
| --- | --- | --- |
| `kasir` | `kasir123` | Scan, rental, lihat laporan — dipakai sehari-hari |
| `admin` | `admin123` | Semua di atas + kelola sepeda & pemilik |
| `owner` | `owner123` | Sama seperti admin |

**Ganti semua kata sandi bawaan sebelum dipakai sungguhan.**

Kalau ada yang tidak beres, jalankan `npm run db:cek` — perintah itu memberi tahu
apakah databasenya terhubung, tabelnya sudah ada, dan akunnya sudah terisi.

### Database mana yang dipakai

Ditentukan oleh `DATABASE_URL` di `.env.local`:

| Isi `DATABASE_URL` | Driver yang dipakai |
| --- | --- |
| dikosongkan (bawaan) | **PGlite** — Postgres asli yang berjalan di dalam proses aplikasi, datanya berkas di `./data/rental` |
| host berakhiran `neon.tech` | **Driver Neon**, lewat WebSocket |
| `postgresql://…` lainnya | **Driver Postgres biasa** — untuk Postgres di Dokploy, VPS, atau mesin sendiri |

Ketiganya Postgres yang sama, jadi query, migrasi, dan transaksinya identik. Pindah
antar-database cukup dengan menempel connection string — tidak ada kode yang perlu
diubah.

Pemisahan Neon dan Postgres biasa bukan pilihan gaya. Driver Neon bicara lewat
WebSocket ke proksi milik Neon dan **tidak bisa** menyambung ke Postgres biasa;
sebaliknya juga demikian. Salah driver membuat koneksi ditolak saat aplikasi
berjalan, bukan saat build — karena itu jenisnya dikenali otomatis dari nama host.

Database lokal berupa berkas dan hanya boleh dibuka satu proses. Kalau `npm run dev`
sedang berjalan, hentikan dulu sebelum menjalankan `db:seed` atau `db:migrate`.

### Pindah ke Neon saat siap online

1. Daftar gratis di [neon.tech](https://neon.tech), buat project, pilih region **Singapore**.
2. Salin **Pooled connection string**-nya ke `DATABASE_URL` di `.env.local`.
3. `npm run db:seed` — tabel dan data awal dibuat di sana.

Data yang sudah ada di database lokal tidak ikut berpindah sendiri.

## Perintah yang tersedia

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Menjalankan aplikasi untuk pengembangan |
| `npm run build` | Membuat versi produksi |
| `npm test` | Menjalankan 121 uji otomatis |
| `npm run db:seed` | Membuat tabel + mengisi data awal (aman diulang) |
| `npm run db:cek` | Memeriksa kesiapan database dan akun login |
| `npm run db:migrate` | Menerapkan migrasi saja, tanpa mengisi data |
| `npm run db:generate` | Membuat berkas migrasi baru setelah skema diubah |
| `npm run db:studio` | Membuka penjelajah data Drizzle |

## Cara kerja perhitungan

**Tarif** dibulatkan ke atas per jam dengan minimum 1 jam. Sewa 1 jam 10 menit dengan
tarif Rp15.000/jam ditagih 2 jam = Rp30.000.

**Bagi hasil** memakai persentase yang diatur per pemilik. Bagian rental dihitung
sebagai sisa, bukan persentase tersendiri, sehingga jumlah kedua bagian selalu persis
sama dengan total biaya tanpa ada rupiah yang hilang karena pembulatan.

**Nilai disalin saat rental dimulai.** Tarif dan persentase yang berlaku saat itu
disimpan di baris transaksi. Menaikkan tarif bulan depan tidak akan mengubah omzet
maupun bagi hasil bulan lalu.

**Tanggal berarti tanggal WIB.** Transaksi pukul 23:30 masuk hari itu, bukan hari
berikutnya. Batas hari dihitung pada 00:00 Asia/Jakarta.

## Cara scan QR

Tiga cara, semuanya bermuara ke halaman yang sama:

1. **Kamera HP** — tombol "Scan pakai kamera". Ini cara yang dipakai sehari-hari.
   Butuh HTTPS (otomatis di alamat produksi; di localhost juga jalan).
2. **Scanner USB/Bluetooth** — bekerja seperti keyboard; kolom pencarian menjaga
   fokus sendiri, jadi petugas cukup menembak. Perlu tipe **2D imager**: scanner
   laser bergaris merah secara fisik tidak bisa membaca QR.
3. **Ketik manual** — cadangan kalau stiker rusak. Kodenya ikut tercetak sebagai
   teks di stiker untuk keadaan ini.

Stiker QR dicetak dari **Data Sepeda → pilih sepeda → Cetak QR** (empat stiker
per halaman).

Kode sepedanya ditulis apa adanya ke dalam QR — `MTB-023`, bukan tautan. Stiker
menempel bertahun-tahun di rangka sepeda, sedangkan alamat situs bisa berubah;
alamat yang tertanam di stiker akan mati lebih dulu daripada stikernya.

Tingkat koreksi galatnya **H**, yang tertinggi: sekitar sepertiga modul boleh
rusak dan kodenya tetap terbaca. Untuk kode sepanjang `MTB-023` tingkat ini
gratis — ukurannya tetap 21×21 modul, sama seperti tingkat bawaan.

Peralihan dari Code 128: stiker lama **tidak lagi dibaca**. Pemindai sengaja
hanya menerima QR, supaya sepeda yang stikernya belum diganti ketahuan pada hari
pertama, bukan berbulan kemudian.

### Menguji kamera dari HP

`npm run dev:hp` menyalakan HTTPS bersertifikat buatan sendiri. Halamannya bisa
dibuka setelah peringatan sertifikat dilewati, **tapi kameranya tetap ditolak** —
peramban tidak mengizinkan kamera pada sertifikat yang tidak dipercaya, dan
penolakannya datang sebagai `NotAllowedError`, galat yang sama persis dengan izin
yang pernah ditolak petugas.

Jadi `dev:hp` berguna untuk menguji tata letak di layar HP, bukan untuk menguji
kameranya. **Uji kamera lewat alamat produksi** yang sertifikatnya sah.

## Struktur kode

```
app/
  login/                 halaman masuk
  (app)/                 semua halaman yang butuh login
    dashboard/  scan/  sepeda/  pemilik/  penyewa/  transaksi/  laporan/harian/
lib/
  db/                    skema, pemilihan driver, migrasi, seed, pemeriksaan
  auth/                  kata sandi, sesi JWT, lapisan otorisasi (dal.ts)
  queries/               semua pembacaan data — tidak ada SQL di komponen
  actions/               semua penulisan data (Server Actions)
  rental/pricing.ts      inti perhitungan uang, fungsi murni
  waktu.ts               batas hari WIB dan penulisan tanggal
components/              komponen UI, navigasi, scan, form
test/                    uji integrasi terhadap Postgres sungguhan (PGlite)
proxy.ts                 pengalihan optimistik ke /login
```

Dua aturan yang dijaga di seluruh kode:

- **Setiap Server Action memanggil `wajibPengguna()` di baris pertama.** Server Action
  bisa dipanggil langsung lewat POST tanpa melewati navigasi halaman, jadi `proxy.ts`
  saja tidak cukup.
- **Semua akses data lewat `lib/queries/` dan `lib/actions/`.** Tidak ada query
  yang berserak di dalam komponen.

## Pengujian

```bash
npm test
```

121 uji, terbagi delapan:

- **Perhitungan uang** — pembulatan jam, dan invarian bahwa bagian pemilik ditambah
  bagian rental selalu persis sama dengan total biaya, diuji pada puluhan kombinasi
  tarif dan persentase.
- **Waktu WIB** — batas hari, batas minggu Senin–Minggu, slot jam booking yang
  melewati tengah malam, transaksi larut malam, penulisan tanggal Indonesia.
- **Token sesi** — token yang diubah isinya atau ditandatangani kunci lain ditolak,
  bukan diterima sebagai peran yang lebih tinggi.
- **Pemilihan database** — nilai `DATABASE_URL` yang salah tempel ditolak dengan
  pesan jelas, bukan diam-diam membuat database lokal kosong.
- **Pemeriksaan foto** — berkas yang mengaku gambar padahal bukan ditolak dari isinya,
  dan SVG ditolak karena bisa memuat skrip.
- **Bentrok booking** — setiap bentuk tumpang tindih ditolak database: mulai di tengah,
  berakhir di tengah, menelan, sama persis, dan berada di dalam. Booking yang bersambung
  persis tetap diterima, dan booking yang dibatalkan melepaskan jamnya.
- **Keuangan & laporan** — laba dihitung dari bagian rental bukan omzet kotor, biaya
  maintenance tidak terhitung dua kali, saldo pemilik tidak menggandakan angka saat
  ada banyak rental dan banyak setoran, serta pengelompokan harian mengikuti WIB.
- **Alur rental** — dari mulai sampai masuk laporan harian, termasuk bukti bahwa
  perubahan tarif tidak mengubah transaksi lama.

## Deploy ke Dokploy

Image dibangun di GitHub Actions, bukan di server. Dokploy tinggal menarik image
yang sudah jadi, sehingga deploy ringan dan server tidak perlu ikut membangun.

### 1. Image dibangun otomatis

Setiap push ke `main` menjalankan [.github/workflows/docker.yml](.github/workflows/docker.yml):
lint dan 121 uji dijalankan lebih dulu, baru image dibangun dan didorong ke GitHub
Container Registry. Kalau uji gagal, image tidak pernah terdorong.

Alamat image:

```
ghcr.io/gitapik/rental_apik:latest
```

Tag yang tersedia: `latest` (dari `main`), `<sha-pendek>` untuk tiap commit, dan
`v1.2.3` beserta `v1.2` kalau Anda membuat tag rilis.

**Sekali saja setelah build pertama:** buka Packages di GitHub → paket
`rental_apik` → Package settings. Kalau repositorinya privat, image juga privat,
jadi tambahkan Registry Credentials di Dokploy dengan username GitHub Anda dan
sebuah Personal Access Token berizin `read:packages`. Kalau image dibuat publik,
Dokploy bisa menariknya tanpa kredensial.

### 2. Siapkan database

Di Dokploy, buat service **PostgreSQL**. Catat connection string internalnya,
bentuknya seperti:

```
postgresql://postgres:sandi@nama-service-postgres:5432/rental
```

Aplikasi mengenali sendiri jenis databasenya dari alamat ini — Postgres biasa,
Neon, atau berkas lokal — dan memilih driver yang sesuai. Neon dan Postgres biasa
memakai protokol yang berbeda, jadi salah driver membuat koneksi ditolak.

### 3. Buat aplikasi di Dokploy

Buat resource bertipe **Compose**, lalu arahkan ke repositori ini:

| Isian | Nilai |
| --- | --- |
| Provider | Github → repositori ini, branch `main` |
| Compose Path | `./docker-compose.yml` |

[docker-compose.yml](docker-compose.yml) tidak punya bagian `build`: isinya hanya
menarik image yang sudah jadi dari GHCR. Jadi meski sumbernya repositori, server
tetap tidak ikut membangun apa pun — kode di repositori hanya dipakai untuk
membaca berkas compose-nya.

Environment Variables:

```env
DATABASE_URL=postgresql://postgres:sandi@nama-service-postgres:5432/rental
SESSION_SECRET=<kunci acak baru, minimal 32 karakter>
```

Dokploy menuliskan keduanya menjadi `.env` di sebelah berkas compose, dan berkas
compose meneruskannya ke container. Kalau salah satu belum diisi, deploy berhenti
dengan pesan yang menyebut nama variabelnya — bukan menyalakan container yang
pasti gagal di setiap halaman.

Buat `SESSION_SECRET` **baru** untuk produksi, jangan pakai yang ada di komputer
Anda:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Terakhir, di tab **Domains**, tambahkan domain dengan service `app` dan port
`3000`. Port itu tidak dibuka ke IP publik server; Traefik milik Dokploy yang
meneruskan permintaan dari domain ke container, dan itulah sebabnya service
`app` ikut bergabung ke `dokploy-network` di berkas compose.

### 4. Deploy

Tekan Deploy. Saat container menyala, migrasi database dijalankan otomatis lebih
dulu lewat [instrumentation.ts](instrumentation.ts) — server baru menerima
permintaan setelah skema siap. Kalau migrasi gagal, container ikut gagal menyala
sehingga versi sebelumnya tetap melayani.

Cek kesehatan tidak perlu disetel di Dokploy karena sudah ikut di dalam image
(lihat [Dockerfile](Dockerfile)). Pemeriksaannya memanggil `/api/health`, yang
ikut menguji koneksi database — jadi `DATABASE_URL` yang salah ketahuan sebagai
container tidak sehat, bukan sebagai kegagalan saat petugas mencoba login.

### 5. Buat akun pertama

Migrasi hanya membuat tabel; isinya masih kosong, sehingga belum ada akun untuk
login. Image produksi sengaja tidak memuat skrip seed — kode dan perkakas
pengembangan tidak ikut masuk ke image — jadi pengisian awal dijalankan dari
komputer Anda.

Di Dokploy, buka service PostgreSQL dan aktifkan akses eksternal untuk sementara,
lalu salin connection string eksternalnya. Dari komputer Anda:

```bash
# .env.local — arahkan sementara ke database produksi
DATABASE_URL="postgresql://postgres:sandi@ip-server:5432/rental"
```

```bash
npm run db:seed     # membuat 3 akun, 3 pemilik, 10 sepeda contoh
npm run db:cek      # memastikan semuanya siap
```

Setelah bisa masuk: **ganti ketiga kata sandi bawaan** lewat menu Pengaturan,
**matikan lagi akses eksternal** Postgres di Dokploy, dan kembalikan
`DATABASE_URL` di `.env.local` ke kosong supaya pengembangan lokal memakai
database lokal lagi.

Kalau tidak ingin memakai data contoh, isi hanya akun admin lalu hapus pemilik
dan sepeda contohnya lewat aplikasi.

### Memperbarui aplikasi

Push ke `main`, tunggu Actions selesai, lalu tekan Redeploy di Dokploy. Migrasi
skema ikut berjalan sendiri.

Redeploy bisa ikut otomatis: salin **Webhook URL** dari Dokploy, simpan di GitHub
sebagai secret `DOKPLOY_WEBHOOK_URL` (Settings → Secrets and variables → Actions),
maka setiap push ke `main` yang lulus uji langsung tayang tanpa disentuh. Tanpa
secret itu alurnya tetap jalan, hanya penekanan Redeploy-nya manual.

### Mundur ke versi sebelumnya

Setiap commit punya tag image sendiri, jadi tidak perlu me-revert kode dulu.
Isi `APP_IMAGE` di Environment Dokploy dengan tag versi yang masih sehat lalu
Redeploy:

```env
APP_IMAGE=ghcr.io/gitapik/rental_apik:a1b2c3d
```

Daftar tag ada di halaman Packages GitHub, atau di ringkasan Actions milik build
tersebut. Setelah perbaikannya terdorong ke `main`, hapus kembali `APP_IMAGE`
supaya kembali mengikuti `latest`.

Perlu diingat migrasi skema hanya maju, tidak turun. Kalau versi yang bermasalah
sudah menambah tabel atau kolom, mundurnya image aman — tapi migrasi yang sudah
diterapkan tetap ada di database.

## Deploy ke Vercel

Penyimpanan berkas di Vercel tidak permanen, jadi database lokal tidak bisa dipakai
di sana. Siapkan Neon lebih dulu — Vercel Postgres di Marketplace juga Neon, jadi
keduanya sama saja.

### 1. Setel versi Node

Project Settings → General → Node.js Version → **24**. `package.json` menuntut
`>=24`, dan build gagal di pemeriksaan engines kalau Vercel memakai versi lain.

### 2. Isi Environment Variables

Pasang di ketiga environment (Production, Preview, Development):

| Variabel | Isi |
| --- | --- |
| `DATABASE_URL` | Connection string Neon, **yang pooled** — hostnya mengandung `-pooler` |
| `SESSION_SECRET` | Acak, minimal 32 karakter. Buat baru, jangan pakai punya laptop |

Hanya dua. Variabel baru tidak berlaku pada deployment yang sudah jadi, jadi setelah
menambahkannya harus **Redeploy**.

Neon membagikan banyak nama variabel sekaligus (`POSTGRES_URL`,
`POSTGRES_PRISMA_URL`, `DATABASE_URL_UNPOOLED`, dan seterusnya). Aplikasi ini hanya
membaca `DATABASE_URL`; sisanya boleh diabaikan. Yang berakhiran `_PRISMA_URL` tidak
menandakan apa-apa soal proyek ini — datanya diakses lewat Drizzle, bukan Prisma.

Driver dipilih otomatis dari nama host, jadi tidak ada yang perlu disetel: host
berakhiran `.neon.tech` memakai driver WebSocket Neon, yang memang untuk serverless.

**Migrasi otomatis mati sendiri di Vercel**, tidak perlu variabel apa pun.
`instrumentation.ts` mengenali `VERCEL` dan melewatinya.

Alasannya bukan sekadar tidak diinginkan, melainkan mustahil: migrasi membaca berkas
SQL dari `./drizzle` lewat filesystem, sedangkan penelusuran berkas Next hanya
mengikuti `import` secara statis dan tidak melihat pembacaan direktori di dalam
drizzle. Folder itu tidak pernah ikut ke bundle. Di Docker ia ada semata karena
[`Dockerfile`](Dockerfile) menyalinnya dengan satu baris `COPY`; di Vercel tidak ada
tempat untuk menaruh baris serupa. Memaksanya jalan membuat `register()` melempar
ENOENT, server gagal menyala, dan yang muncul cuma "Internal Server Error" tanpa
penjelasan.

`MIGRASI_OTOMATIS=0` tetap ada untuk mematikan migrasi otomatis di tempat lain,
misalnya Dokploy, tapi di Vercel tidak ada gunanya diisi.

Kalau `DATABASE_URL` lupa diisi, server sengaja **menolak menyala** — tanpa penjaga
itu aplikasi diam-diam jatuh ke database berbasis berkas dan datanya hilang tiap
cold start. Untuk menguji build produksi di komputer sendiri tanpa database, setel
`IZINKAN_DB_LOKAL=1`.

### 3. Terapkan migrasi sekali dari komputer sendiri

Karena Vercel tidak bisa menjalankannya sendiri, skemanya dibuat dari luar:

```bash
# .env.local — arahkan sementara ke database Vercel/Neon
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
```

```bash
npm run db:migrate
```

Kembalikan `.env.local` seperti semula setelah selesai supaya pengembangan lokal
tidak lagi menyentuh database produksi.

### 4. Buat akun pertama — segera

Buka `/register` di alamat produksinya dan daftarkan akun admin **sebelum alamat itu
dibagikan ke siapa pun**. Halaman itu terbuka tanpa sesi karena harus bisa membuat
akun pertama, dan ia menutup diri begitu ada satu pengguna. Selama masih kosong,
siapa pun yang membuka alamatnya bisa menjadi admin.

Urutannya tidak bisa dibalik: `/register` menutup diri pada pengguna **pertama**, siapa
pun dia. Membuat akun demo lebih dulu berarti mengunci diri sendiri di luar.

### 5. Baru buat akun demo

Setelah masuk sebagai admin, buka **Pengaturan → Tim** dan tambahkan satu akun berperan
**Kasir** dengan username `demo`. Peran kasir tidak bisa membuka Pengeluaran dan
Laba/Rugi, jadi angka keuangan tetap tertutup meski kata sandinya tertulis terang-terangan
di bagian atas berkas ini.

Jangan pernah menjalankan `npm run db:seed` ke database produksi. Perintah itu membuat
akun `admin`, `kasir`, dan `owner` yang kata sandinya terbaca siapa saja di
[`lib/db/seed.ts`](lib/db/seed.ts) — aman untuk database lokal, tidak untuk alamat publik.

### 6. Tangkapan layar dan alamat

Dua hal terakhir di bagian atas berkas ini masih perlu disesuaikan tangan:

**Alamat.** Ganti `https://rental-sepeda.vercel.app` dengan alamat yang benar-benar
diberikan Vercel. Nama proyek yang sudah terpakai orang lain membuat Vercel menambahi
akhiran, jadi jangan diasumsikan.

**Gambar.** Ambil tiga tangkapan layar dari alamat produksi memakai akun demo, simpan
di `docs/gambar/`, lalu buang tanda komentar di sekitar blok gambar pada bagian atas:

| Berkas | Halaman | Kenapa yang ini |
| --- | --- | --- |
| `dashboard.png` | Dashboard | Angka-angkanya langsung menunjukkan aplikasi ini mengurus sesuatu yang nyata |
| `scan.png` | Scan QR | Fitur yang paling membedakan, dan paling sulit ditebak dari daftar fitur |
| `laporan.png` | Laporan Harian | Bagi hasil per pemilik memperlihatkan kedalaman domainnya |

Ambil dalam lebar peramban sekitar 1280px supaya teksnya masih terbaca setelah
diperkecil GitHub.

### Yang tidak perlu disiapkan

- **Vercel Blob.** Foto sepeda sudah disimpan di dalam database sebagai `bytea`,
  justru karena berkas di Vercel tidak permanen. Memindahkannya ke Blob malah
  melepas penjagaan sesi yang sekarang ada di `/api/sepeda/[id]/foto`. Blob baru
  masuk akal kalau kuota penyimpanan Neon mulai terdesak foto.
- **`output: "standalone"`.** Sudah dimatikan otomatis saat berjalan di Vercel;
  setelan itu hanya untuk memperkecil image Docker.

## Menu yang tersedia

| Menu | Isi |
| --- | --- |
| **Dashboard** | Total sepeda, tersedia, disewa, booking, servis, tidak aktif, transaksi & omzet hari ini |
| **Scan QR** | Kartu sepeda, mulai rental, selesaikan rental, jemput booking |
| **Booking** | Catat pesanan, konfirmasi, batalkan, tandai hangus |
| **Transaksi** | Daftar dan rincian seluruh rental |
| **Data Sepeda** | CRUD, foto, status, cetak stiker QR |
| **Data Pemilik** | CRUD, persentase bagi hasil, rekap bulan berjalan |
| **Data Penyewa** | Terdata otomatis dari transaksi |
| **Maintenance** | Servis, sparepart, biaya, jam pakai, jadwal servis berikutnya |
| **Laporan Harian** | Transaksi, sepeda dipakai, jam, omzet, bagi hasil per pemilik |
| **Laporan Mingguan** | Rekap Senin–Minggu, penggunaan sepeda, hari teramai & tersepi |
| **Laporan Bulanan** | Top 10 sepeda, sepeda menganggur, rekap per pemilik |
| **Laporan Pemilik** | Total hak, sudah dibayar, sisa, dan pencatatan setoran |
| **Pengeluaran** | Gaji, listrik, PDAM, maintenance, sparepart, operasional, lain-lain |
| **Laba / Rugi** | Hari ini, minggu ini, bulan ini, tahun ini |
| **Pengaturan** | Identitas usaha, aturan operasional, ganti kata sandi |

Menu Pengeluaran dan Laba/Rugi hanya bisa dibuka admin dan owner, tidak oleh kasir.

## Cara laba bersih dihitung

**Laba bersih = Pendapatan rental − Pengeluaran.** Pendapatan rental adalah omzet
kotor dikurangi bagian pemilik sepeda.

Rumus `Omzet − Pengeluaran` **tidak** dipakai karena omzet kotor masih memuat bagian
pemilik sepeda — uang yang wajib disetorkan dan bukan milik rental. Contoh: omzet
Rp1.290.000 dengan bagi hasil 60% berarti Rp774.000 milik pemilik. Kalau pengeluaran
Rp300.000 dikurangkan dari omzet kotor, laba terbaca Rp990.000; padahal yang
sebenarnya Rp216.000.

Omzet kotor dan bagian pemilik tetap ditampilkan berdampingan supaya angkanya bisa
ditelusuri.

## Cara booking dijaga dari bentrok

Satu booking dipecah menjadi satu baris per jam di tabel `booking_slots`, lalu
dijaga indeks unik `(bike_id, jam)`. Dua booking yang bertumpang tindih pasti
bertabrakan pada minimal satu jam yang sama, sehingga ditolak database — bukan
sekadar dicek di aplikasi.

Cara yang lazim untuk ini, `EXCLUDE constraint` dengan `tstzrange`, **tidak** dipakai
karena menuntut ekstensi `btree_gist` yang tidak tersedia di PGlite. Memakainya akan
membuat aplikasi jalan di Neon tapi rusak total di database lokal.

Booking yang dibatalkan melepaskan slotnya, sehingga jam-jamnya bisa dipesan lagi.

## Booking hangus tanpa penjadwal

Aplikasi ini tidak punya proses latar belakang. "Hangus" karena penyewa tidak datang
karena itu dihitung saat data dibaca, dengan membandingkan jam mulai terhadap
toleransi keterlambatan di Pengaturan. Petugas yang memutuskan menandainya hangus,
dan hanya booking yang jam mulainya benar-benar sudah lewat yang bisa ditandai.

## Belum ada

Katalog publik dan akun pelanggan — booking dicatat petugas dari telepon atau
WhatsApp, bukan dipesan sendiri oleh penyewa.
