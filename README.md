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

| Isi `DATABASE_URL` | Yang dipakai |
| --- | --- |
| dikosongkan (bawaan) | Berkas lokal di `./data/rental` lewat PGlite — Postgres asli yang berjalan di dalam proses aplikasi |
| `postgresql://…` | Neon atau Postgres lain, lewat koneksi jaringan |

Keduanya Postgres yang sama, jadi query, migrasi, dan transaksinya identik. Pindah
dari lokal ke cloud cukup dengan menempel connection string — tidak ada kode yang
perlu diubah.

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
| `npm test` | Menjalankan 119 uji otomatis |
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

119 uji, terbagi tujuh:

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
