# Rental Ku — kategori barang dan satuan sewa

Tanggal: 27 Agustus 2026
Status: disetujui untuk disusun rencananya

## Kenapa sekarang

Aplikasi ini dibangun untuk satu rental sepeda di Garut. Pada 14 Agustus 2026 arah
SaaS sengaja ditunda dengan alasan yang masuk akal: bagian tersulit SaaS UMKM
Indonesia bukan kodenya melainkan akuisisi dan dukungan pelanggan, jadi membangun
fondasi multi-tenant sebelum ada pembeli nyata berisiko sia-sia.

Keputusan itu dibuka kembali oleh pemiliknya pada 27 Agustus 2026, dengan bentuk
yang berbeda: yang dibangun adalah **produknya**, bukan infrastruktur penyewaannya.
Aplikasi tetap melayani satu rental. Yang berubah adalah ia tidak lagi khusus
sepeda, dan ia punya wajah publik.

## Yang TIDAK dikerjakan

Disebut lebih dulu supaya tidak ada yang menyangka sedang dibangun diam-diam:

- **Tidak ada multi-tenant.** Tidak ada `tenant_id`, tidak ada pemisahan data antar
  pelanggan, tidak ada pendaftaran mandiri.
- **Tidak ada kode langganan.** Tidak ada status aktif atau kedaluwarsa, tidak ada
  gerbang pembayaran, tidak ada tagihan yang berjalan. Tombol "Langganan" di landing
  page membuka WhatsApp, dan urusannya berlanjut sebagai percakapan manusia.
- **Tidak ada satuan per barang.** Satuan melekat pada kategori. Ditolak secara sadar
  karena akan menambah satu keputusan pada setiap barang yang didaftarkan.

Kalau salah satu dari ketiganya nanti dibutuhkan, ia menjadi proyek tersendiri dengan
spec tersendiri.

## Tiga sub-proyek, dan urutannya

| # | Sub-proyek | Ukuran | Alasan urutan |
| --- | --- | --- | --- |
| 1 | Ganti nama menjadi "Rental Ku" | kecil | Membuka jalan penamaan di tempat lain |
| 2 | Kategori barang dan satuan sewa | besar | Inti pekerjaan |
| 3 | Landing page dan langganan lewat WhatsApp | sedang | Terakhir, supaya yang diiklankan sudah ada |

Landing page sengaja terakhir. Dibalik urutannya, halaman depan menjanjikan "motor,
mobil, HP" sementara aplikasinya masih hanya sepeda.

---

# Sub-proyek 1 — Ganti nama menjadi "Rental Ku"

Mengikuti pola penggantian nama sebelumnya: teks tampilan dan nilai bawaan, bukan
skema. Tempat yang harus disentuh sudah diketahui — judul metadata di `app/layout.tsx`,
judul halaman login, label cadangan di `components/nav/menu.ts`, `PENGATURAN_BAWAAN`
di `lib/queries/pengaturan.ts`, README, dan komentar berkas.

Nama usaha yang tersimpan di database adalah data milik pemakai, bukan identitas
aplikasi. "Rental Ku" adalah nama produknya; nama usaha tetap bisa diisi apa saja
lewat menu Pengaturan, dan laporan serta stiker QR sudah membacanya dari sana.

---

# Sub-proyek 2 — Kategori barang dan satuan sewa

## Masalah yang dipecahkan

Sepeda disewa per jam. Mobil hampir selalu per hari. HP per hari atau minggu. Tarif
per jam tertanam di 150 tempat pada 45 berkas — mesin harga, notifikasi, laporan,
formulir, dan tes.

Kolom `jenis` pada tabel `bikes` sudah berupa teks bebas, jadi mengetik "Motor" hari
ini pun sudah bisa. Yang belum ada bukan kemampuan menambah jenis, melainkan daftar
kategori yang dikelola beserta aturan yang melekat padanya.

## Skema

### Tabel baru: `categories`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| `id` | serial PK | |
| `nama` | text, unik | "Sepeda", "Motor", "Mobil", "HP" |
| `satuan` | enum `satuan_sewa` | `'jam'` atau `'hari'` |
| `toleransiTelatMenit` | integer | Kelewatan pengembalian yang masih dianggap wajar |
| `batasBerjalanSatuan` | integer | Setelah sekian satuan, rental berjalan ditandai mencurigakan di dashboard |
| `aktif` | boolean, default true | Kategori lama dinonaktifkan, tidak dihapus, supaya laporan lama tetap utuh |
| `urutan` | integer, default 0 | Urutan tampil di formulir |
| `dibuatPada` | timestamp | |

### `bikes` menjadi `items`

Nama tabel ikut berubah. Tanpa itu, tabel bernama `bikes` akan berisi mobil — hal
pertama yang terlihat janggal oleh siapa pun yang membaca kodenya.

| Perubahan | Dari | Menjadi |
| --- | --- | --- |
| Nama tabel | `bikes` | `items` |
| Jenis | `jenis` text bebas | `categoryId` → `categories.id`, `ON DELETE RESTRICT` |
| Tarif | `tarifPerJam` | `tarif` — rupiah bulat per satuan kategorinya |
| Enum status | `statusSepedaEnum` | `statusBarangEnum` (nilai tidak berubah) |

Kolom lain — `kode`, `nama`, `merk`, `fotoData`, `fotoTipe`, `fotoVersi`, `ownerId`,
`status`, `catatan` — tidak berubah.

### `rentals`

| Perubahan | Dari | Menjadi |
| --- | --- | --- |
| Acuan barang | `bikeId` | `itemId` |
| Snapshot tarif | `tarifPerJamSnapshot` | `tarifSnapshot` |
| Snapshot satuan | — | `satuanSnapshot` enum, **baru** |
| Durasi ditagih | `durasiJamDitagih` | `durasiSatuanDitagih` |

`satuanSnapshot` wajib ada dan bukan kenyamanan. Kolom snapshot lain sudah ada dengan
alasan yang sama: kalau kategori "Mobil" nanti diubah dari harian ke jaman, transaksi
bulan lalu tidak boleh ikut berubah artinya. Tanpa kolom ini, angka `durasiSatuanDitagih`
pada transaksi lama menjadi tidak bermakna.

### `settings`

`batasJamRental` dan `toleransiTelatMenit` menjadi tidak terpakai dan dibuang. Nilainya
turun ke kategori.

`toleransiBookingMenit` **tetap di settings**. Ia soal penyewa telat menjemput booking,
bukan soal barang telat kembali, dan sifatnya kebijakan rental — sama untuk semua jenis
barang.

## Mesin harga

Perhitungan yang ada sudah berbentuk umum dengan angka 60 tertanam di dalamnya. Jam
pokok adalah `floor(menit / 60)` minimum 1; blok denda 30 menit adalah separuh satuan;
tarif denda separuh tarif satuan. Mengganti 60 dengan "menit per satuan" membuat aturan
yang berlaku sekarang menjadi kasus khusus `satuan = 'jam'`.

```
MENIT_PER_SATUAN = { jam: 60, hari: 1440 }

hitungSatuanPokok(durasiMenit, menitPerSatuan)
  = max(1, floor(durasiMenit / menitPerSatuan))

hitungSisaMenit(durasiMenit, menitPerSatuan)
  = max(0, durasiMenit − hitungSatuanPokok(...) × menitPerSatuan)
  → selalu 0 .. menitPerSatuan−1

hitungSaranTambahan(sisaMenit, tarif, toleransiMenit, menitPerSatuan)
  blok = ceil(sisaMenit / (menitPerSatuan / 2))
  = blok × floor(tarif / 2)
```

`InputBiaya` menerima `tarif` dan `satuan` menggantikan `tarifPerJam`.
`HasilBiaya` mengembalikan `durasiSatuanDitagih` menggantikan `durasiJamDitagih`.

Karena `jam` menghasilkan angka yang sama persis, tes yang ada menegaskan nilai yang
sama; yang berubah hanya tanda tangan pemanggilannya.

### Yang sengaja tidak diubah

Tiga aturan berikut punya alasan yang tertulis di komentar `lib/rental/pricing.ts`, dan
alasannya tidak tersentuh oleh satuan:

1. **Pokok dibulatkan ke bawah.** Dulu ke atas, sehingga sewa 1 jam 1 menit ditagih
   2 jam, dan kasir jadi enggan mencatat waktu apa adanya.
2. **Denda hanya saran, kasir hanya boleh menurunkan.** Menaikkan ditolak di mesin
   harga, bukan hanya di formulir.
3. **Bagian rental dihitung sebagai sisa**, bukan persentase tersendiri, supaya jumlah
   kedua bagian selalu persis sama dengan total dan tidak ada rupiah yang hilang atau
   tercipta karena pembulatan.

## Antarmuka

| Sekarang | Menjadi |
| --- | --- |
| Rute `/sepeda` | `/barang` |
| Menu "Data Sepeda" | "Data Barang" |
| Isian teks `jenis` pada formulir | Pemilih kategori |
| — | Menu **Kategori** baru di Pengaturan |

Menu Kategori hanya untuk admin dan owner, mengikuti `bolehKelolaDataInduk()` yang
sudah ada. Kategori yang sudah dipakai barang **tidak bisa dihapus**, hanya
dinonaktifkan — pola yang sama dengan pemilik yang masih punya barang, supaya laporan
lama tetap bisa dibaca.

Label durasi di seluruh aplikasi mengikuti satuan: "3 jam" atau "2 hari". Stiker QR
tidak berubah bentuknya; teks "sepeda" pada salinannya diganti "barang".

## Migrasi data

Satu migrasi maju, dijalankan `npm run db:migrate` seperti biasa:

1. Buat tabel `categories` dan enum `satuan_sewa`.
2. Sisipkan kategori "Sepeda" dengan `satuan='jam'`, `toleransiTelatMenit` dan
   `batasBerjalanSatuan` diambil dari baris `settings` yang ada — bukan dari angka
   tetap, supaya rental yang sudah menyesuaikan setelannya tidak diam-diam dikembalikan
   ke bawaan.
3. Ganti nama `bikes` → `items`, `tarif_per_jam` → `tarif`.
4. Tambah `category_id`, isi seluruh baris dengan id kategori "Sepeda", baru pasang
   `NOT NULL` dan foreign key.
5. Buang kolom `jenis`.
6. Pada `rentals`: ganti nama `bike_id` → `item_id`, `tarif_per_jam_snapshot` →
   `tarif_snapshot`, `durasi_jam_ditagih` → `durasi_satuan_ditagih`; tambah
   `satuan_snapshot` dan isi seluruh baris lama dengan `'jam'`.
7. Buang `settings.batas_jam_rental` dan `settings.toleransi_telat_menit`.

Urutan mengisi-dulu-baru-mengunci dipakai supaya migrasi tidak pernah gagal di tengah
pada database yang sudah berisi data. Tidak ada transaksi yang hilang.

## Pengujian

Yang sudah ada dipertahankan: seluruh tes kategori per jam menegaskan angka yang sama
seperti sekarang. Kalau ada satu saja yang angkanya berubah, itu regresi, bukan
penyesuaian.

Yang **baru dan wajib ada** — di sinilah bug akan bersembunyi:

- Satuan hari: sewa 2 hari 3 jam berpokok 2 hari, sisa 180 menit.
- Denda harian: blok separuh hari, separuh tarif harian, nol selama masih dalam
  toleransi kategori.
- Sewa di bawah satu satuan tetap ditagih satu satuan, untuk jam maupun hari.
- `satuanSnapshot` tidak ikut berubah ketika satuan kategorinya diubah setelah
  transaksi selesai.
- Kategori yang masih dipakai barang tidak bisa dihapus.
- Toleransi dan batas dibaca dari kategori barangnya, bukan dari settings.

---

# Sub-proyek 3 — Landing page dan langganan

Halaman publik di `/`. Aplikasi tetap berada di belakang login seperti sekarang.

Pada `proxy.ts`, `/` masuk ke `RUTE_PUBLIK`. Setelah itu aturan khusus
`sesi && path === "/"` yang berlaku sekarang menjadi mubazir dan dibuang: aturan umum
`sesi && rutePublik → /dashboard` sudah menanganinya, dan menyisakan keduanya berarti
dua tempat yang harus sama-sama benar untuk satu perilaku. Pemakai yang sudah login
tetap tidak mendarat di halaman jualan.

Isi: penjelasan produk, kategori yang didukung, tangkapan layar, bagian harga, dan
tombol ajakan berlangganan.

**Tidak ada kode langganan.** Tidak ada status langganan yang disimpan, tidak ada akses
yang tertutup ketika masa berlaku habis. Ini konsekuensi langsung dari keputusan
satu-tenant.

## Tahap: tata letak dulu, isi menyusul

Diputuskan 27 Agustus 2026: sub-proyek ini dikerjakan **hanya sampai tata letaknya**.
Harga dan nomor WhatsApp belum ditentukan dan ditunda dengan sengaja.

Konsekuensinya pada rancangan — dan ini yang membuat penundaan itu murah:

- Angka harga dan isi paket ditaruh di **satu konstanta** di puncak berkasnya, bukan
  tersebar di markup. Mengisinya nanti berarti menyunting satu tempat.
- Tombol berlangganan sementara **tidak menunjuk ke mana pun** yang bisa diklik keliru.
  Ia dinonaktifkan dengan keterangan singkat, bukan diarahkan ke nomor palsu. Nomor
  contoh yang lupa diganti akan mengirim calon pelanggan ke orang asing.
- Tata letaknya dirancang untuk **tiga paket**, karena itu bentuk yang paling mungkin
  dipakai. Kalau nanti jadi dua, satu kolom dihapus tanpa menyentuh yang lain.

Yang dibutuhkan sebelum tahap berikutnya: nomor WhatsApp tujuan, jumlah paket, harga
tiap paket, dan isi tiap paket. Semuanya isi, bukan keputusan teknis, dan tidak
menghalangi sub-proyek 1 maupun 2.

## Kejujuran isi

Paket yang dipajang hanya boleh menyebut kemampuan yang benar-benar ada di aplikasi,
atau perbedaan **layanan** — dukungan, backup — yang tidak menuntut kode. Landing page
yang menjanjikan multi-cabang sementara aplikasinya satu tenant adalah ketidakcocokan
yang justru diperiksa orang yang membuka repo ini.

---

# Risiko

**Diff-nya besar.** 93 berkas menyebut `bikes` atau `sepeda`. Sebagian besar
penggantian nama yang mekanis, tapi jumlahnya membuat review sulit dan konflik merge
mahal. Rencana implementasinya harus memecah ini menjadi langkah-langkah yang tiap
langkahnya hijau — bukan satu commit raksasa.

**Migrasi tidak bisa mundur.** Migrasi di proyek ini hanya maju. Kolom `jenis` yang
sudah dibuang tidak kembali. Database produksi harus dicadangkan sebelum migrasi
dijalankan.

**Satuan hari mengubah arti toleransi.** Toleransi 5 menit yang berlaku sekarang, kalau
terbawa ke kategori harian, membuat mobil yang telat 6 menit kena denda separuh hari.
Karena itu toleransi pindah ke kategori — dan nilai bawaan untuk kategori harian harus
dipikirkan saat kategori dibuat, bukan diwarisi begitu saja.
