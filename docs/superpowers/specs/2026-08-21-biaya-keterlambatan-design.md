# Biaya keterlambatan, wajib scan, dan pemisahan booking/scan

Tanggal: 2026-08-21

## Masalah

Tiga keluhan yang datang bersamaan dari pemakaian sehari-hari:

1. **Sepeda telat semenit ditagih dobel.** `hitungJamDitagih()` membulatkan ke
   atas per jam, jadi sewa 1 jam 1 menit ditagih 2 jam. Di lapangan ini terasa
   tidak masuk akal dan kasir jadi enggan mencatat waktu apa adanya.
2. **Rental bisa ditutup tanpa sepedanya ada.** Tombol SELESAIKAN memang hanya
   muncul di halaman scan, tapi dashboard dan daftar sepeda-di-luar menaut
   langsung ke sana, jadi kasir cukup mengetuk satu baris.
3. **Kasir bingung mana booking mana rental langsung**, karena kedua jenis itu
   muncul bercampur di halaman scan.

Di balik nomor 1 ada kekhawatiran yang lebih serius: kalau sepeda telat satu
jam, uang satu jam tambahan itu tidak terduga besarnya, dan tidak ada catatan
yang memaksa kasir mempertanggungjawabkannya.

## Yang sudah ada dan tidak perlu dibuat ulang

Tabel `rentals` **sudah** menyimpan `waktuMulai`, `waktuSelesai`, `durasiMenit`
(menit persis, bukan pembulatan), dan `diselesaikanOleh` — petugas yang menerima
uangnya. Jadi "waktu sungguhan dari start sampai selesai" sudah tercatat sejak
awal; yang belum ada adalah menampilkannya ke kasir dan memberi kasir kendali
atas tagihannya.

## Aturan uang yang baru

```
jamPokok  = maks(1, bulat-bawah(durasiMenit ÷ 60))
sisaMenit = maks(0, durasiMenit − jamPokok × 60)
saran     = sisaMenit ≤ toleransiMenit ? 0
                                       : ceil(sisaMenit ÷ 30) × bulat-bawah(tarif ÷ 2)
total     = jamPokok × tarif + tambahanDitagih
```

Tarif Rp5.000, toleransi 5 menit:

| Durasi asli | Pokok | Sisa | Saran | Total baru | Total lama |
| ----------- | ----- | ---- | ----- | ---------- | ---------- |
| 0:20        | 1 jam | 0    | 0     | 5.000      | 5.000      |
| 1:04        | 1 jam | 4    | 0     | 5.000      | 10.000     |
| 1:30        | 1 jam | 30   | 2.500 | 7.500      | 10.000     |
| 2:10        | 2 jam | 10   | 2.500 | 12.500     | 15.000     |
| 2:45        | 2 jam | 45   | 5.000 | 15.000     | 15.000     |

### Sifat yang dijamin

- **`sisaMenit` selalu < 60**, karena jam penuhnya sudah diserap `jamPokok`.
  Akibatnya `saran` tidak pernah melebihi satu jam tarif. Ini invarian, bukan
  kebetulan, dan diuji.
- **`0 ≤ tambahanDitagih ≤ saran`.** Kasir hanya bisa *menurunkan*. Menaikkan
  ditolak server. Ini menutup arah penipuan yang lebih berbahaya daripada
  memberi keringanan: menagih penyewa di atas aturan lalu mengantongi
  selisihnya. Kalau suatu saat perlu menagih lebih karena sepeda rusak, itu
  harus jadi jenis catatan tersendiri — bukan menumpang kolom denda telat.
- **`bagianPemilik + bagianRental === totalBiaya`** tetap berlaku persis, dengan
  tambahan keterlambatan ikut dibagi seperti uang sewa biasa. Kalau denda tidak
  ikut dibagi, rental jadi punya insentif menggeser angka dari kolom sewa ke
  kolom denda.

### Jejak yang disimpan

| Kolom             | Isi                                          |
| ----------------- | -------------------------------------------- |
| `durasiMenit`     | menit sungguhan (sudah ada)                  |
| `durasiJamDitagih`| kini berarti `jamPokok`                      |
| `tambahanSaran`   | yang dihitung sistem                         |
| `tambahanDitagih` | yang benar-benar ditagih                     |
| `alasanPotongan`  | wajib bila `ditagih < saran`                 |
| `diselesaikanOleh`| penerima uang (sudah ada)                    |

Potongan tidak disimpan sebagai kolom sendiri — ia turunan
`tambahanSaran − tambahanDitagih`, dan menyimpan turunan hanya menambah
kemungkinan dua angka yang saling bertentangan.

Pengaturan baru: `toleransiTelatMenit`, bawaan 5. Berbeda dari
`toleransiBookingMenit` yang sudah ada — yang itu soal terlambat *menjemput*
booking, yang ini soal terlambat *mengembalikan* sepeda.

## Wajib scan untuk menyelesaikan

`ScannerInput` menambahkan penanda `&pindai=1` pada URL tujuannya. Tautan dari
daftar mana pun tidak membawanya. Halaman scan hanya menampilkan panel
penyelesaian kalau penanda itu ada; tanpa penanda, yang muncul adalah info
rental berjalan dan ajakan memindai.

**Ini disiplin kerja, bukan pagar keamanan.** Scanner USB pada dasarnya
mengetikkan kodenya, jadi kasir yang hafal kode tetap bisa mengetiknya manual,
dan penanda di URL bisa disunting siapa pun yang paham alamat. Yang dibeli dari
mekanisme ini adalah "menutup rental jadi tindakan yang disengaja", bukan
"mustahil dipalsukan". Pertanggungjawaban sesungguhnya ada pada jejak di atas.

Gerbang ini **hanya** untuk menyelesaikan rental. Memulai rental dan menyerahkan
booking punya alasan yang serupa tapi tidak diminta, jadi tidak ikut diubah.

## Booking dan scan: dipisah, lalu disatukan lagi

Keputusan pertama adalah memisahkan — halaman scan hanya rental langsung,
halaman booking hanya pemesanan. Setelah dipakai, keputusan itu dibalik: kedua
halaman menampilkan daftar yang **sama persis**, dan yang membedakan tiap baris
cuma lencana tahapnya. Alasannya masuk akal: petugas jadi harus tahu lebih dulu
sebuah sepeda "jenisnya apa" sebelum tahu harus mencarinya di mana, padahal yang
ia pedulikan cuma sepeda ini sekarang ada di tahap apa.

Lencananya: **Sedang dibooking**, **Sedang disewa**, **Selesai**, **Hangus**,
**Batal**. Asal-usulnya turun menjadi penanda kecil "dari booking" atau
"langsung" pada tiap baris, jadi keterangan itu tidak hilang meski bukan lagi
pemisah.

### Aturan yang menentukan: satu kejadian, satu baris

Saat sepeda booking diserahkan, `lib/actions/booking.ts` membuat rental baru
**sekaligus** menandai bookingnya `status = "selesai"`. Kalau kedua tabel
digabung mentah-mentah, sepeda yang baru saja berangkat muncul dua kali
sekaligus: berlencana "Selesai" sebagai booking dan "Sedang disewa" sebagai
rental. Itu kebingungan yang lebih parah daripada pemisahan yang hendak dibuang.

Karena itu `daftarAktivitas()` **tidak** mengambil booking yang sudah dijemput
dari tabel booking — ia sudah terwakili oleh rentalnya. Penanda "dari booking"
didapat dari `bookings.rentalId` yang menunjuk rental itu. Aturan ini diuji di
`test/aktivitas.test.ts`.

### Cakupan

Yang masih berjalan (dibooking, disewa) diambil **tanpa batas waktu** — sepeda
yang belum kembali tidak boleh hilang dari layar hanya karena berangkatnya
kemarin. Yang sudah tuntas (selesai, batal) dibatasi **hari ini**; riwayat lama
tetap di halaman Transaksi.

Kartu serah-terima booking saat sebuah sepeda di-scan **tetap ada** — itu alur
penyerahan, bukan daftar, dan tanpanya booking tidak bisa menjadi rental.

## Laporan potongan

Halaman laporan mendapat ringkasan potongan per kasir per periode: berapa kali
memberi keringanan, total rupiahnya, dan alasannya. Tanpa ini, jejak yang
dikumpulkan di atas hanya jadi data yang tidak pernah dibaca siapa pun.

## Batasan yang disadari

- **Transaksi lama tidak berubah.** Kolom baru kosong dan dibaca sebagai 0.
  Laporan bulan-bulan sebelumnya tetap apa adanya.
- **Aturan lama benar-benar ditinggalkan.** Sebagian `pricing.test.ts` ditulis
  ulang karena ia mengunci perilaku pembulatan ke atas yang sekarang dibuang.
- **`durasiJamDitagih` berubah makna** dari "jam hasil pembulatan ke atas"
  menjadi "jam pokok". Angka "total jam" di dashboard akan sedikit turun untuk
  transaksi baru, dan itu memang lebih jujur.

## Tahapan

**Tahap 1** — aturan uang, kolom baru, pengaturan toleransi, tampilan
penyelesaian. Inti keluhannya ada di sini.

**Tahap 2** — gerbang wajib-scan, pemisahan daftar, laporan potongan.
