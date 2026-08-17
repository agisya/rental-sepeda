# Rental Sepeda Garut

Aplikasi pencatatan rental sepeda per jam dengan bagi hasil pemilik. Alur kerjanya:
scan barcode → mulai rental → scan lagi saat kembali → sistem menghitung durasi,
biaya, dan bagi hasil → semuanya masuk laporan harian.

Dibangun dengan Next.js 16 (App Router), TypeScript, Tailwind 4, Postgres, dan Drizzle ORM.

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

## Cara scan barcode

Tiga cara, semuanya bermuara ke halaman yang sama:

1. **Scanner USB/Bluetooth** — paling cepat di meja kasir. Alatnya bekerja seperti
   keyboard; kolom pencarian menjaga fokus sendiri, jadi petugas cukup menembak.
2. **Kamera HP** — tombol "Scan pakai kamera". Butuh HTTPS (otomatis di Vercel;
   di localhost juga jalan).
3. **Ketik manual** — cadangan kalau stiker rusak.

Stiker barcode dicetak dari **Data Sepeda → pilih sepeda → Cetak barcode**
(format Code128, empat stiker per halaman).

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
di sana. Siapkan Neon lebih dulu.

1. Push ke GitHub, lalu impor repositorinya di Vercel.
2. Isi Environment Variables: `DATABASE_URL` (connection string Neon) dan
   `SESSION_SECRET`.
3. Dari komputer sendiri, dengan `DATABASE_URL` yang sama di `.env.local`, jalankan
   `npm run db:seed` sekali untuk membuat tabel dan akunnya.

## Menu yang tersedia

| Menu | Isi |
| --- | --- |
| **Dashboard** | Total sepeda, tersedia, disewa, booking, servis, tidak aktif, transaksi & omzet hari ini |
| **Scan Barcode** | Kartu sepeda, mulai rental, selesaikan rental, jemput booking |
| **Booking** | Catat pesanan, konfirmasi, batalkan, tandai hangus |
| **Transaksi** | Daftar dan rincian seluruh rental |
| **Data Sepeda** | CRUD, foto, status, cetak stiker barcode |
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
