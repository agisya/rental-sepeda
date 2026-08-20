import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Data biner untuk foto sepeda. Foto disimpan di dalam database, bukan di
 * penyimpanan berkas, karena berkas yang ditulis di Vercel tidak permanen dan
 * layanan penyimpanan luar akan membuat pengembangan lokal butuh internet.
 * Jumlah sepeda di satu rental kecil, jadi ukurannya tidak jadi masalah.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const peranEnum = pgEnum("peran", ["admin", "kasir", "owner"]);

export const statusSepedaEnum = pgEnum("status_sepeda", [
  "tersedia",
  "disewa",
  "booking",
  "servis",
  "nonaktif",
]);

export const statusRentalEnum = pgEnum("status_rental", [
  "berjalan",
  "selesai",
  "batal",
]);

export const metodeBayarEnum = pgEnum("metode_bayar", [
  "tunai",
  "qris",
  "transfer",
]);

/** Setoran kas yang sudah dicatat kasir tapi belum ditandai diterima. */
export const statusSetoranEnum = pgEnum("status_setoran", [
  "menunggu",
  "diterima",
  "dibatalkan",
]);

/** Sesuai spesifikasi: 🟡 Booking, 🟢 Selesai, 🔴 Batal. */
export const statusBookingEnum = pgEnum("status_booking", [
  "booking",
  "selesai",
  "batal",
]);

export const jenisMaintenanceEnum = pgEnum("jenis_maintenance", [
  "servis",
  "sparepart",
  "lainnya",
]);

export const kategoriPengeluaranEnum = pgEnum("kategori_pengeluaran", [
  "gaji",
  "listrik",
  "pdam",
  "maintenance",
  "sparepart",
  "operasional",
  "lainnya",
]);

/** Pengguna aplikasi: admin, kasir, dan owner rental. Pemilik sepeda tidak login. */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nama: text("nama").notNull(),
  peran: peranEnum("peran").notNull().default("kasir"),
  aktif: boolean("aktif").notNull().default(true),
  dibuatPada: timestamp("dibuat_pada", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Pemilik sepeda. Umumnya pihak luar yang menitipkan sepedanya, tapi satu di
 * antaranya mewakili rental itu sendiri untuk sepeda milik sendiri.
 */
export const owners = pgTable(
  "owners",
  {
    id: serial("id").primaryKey(),
    nama: text("nama").notNull(),
    noHp: text("no_hp").notNull(),
    alamat: text("alamat"),
    /** Bagian pemilik dalam persen bulat, mis. 60 berarti pemilik 60% / rental 40%. */
    persentaseBagiHasil: integer("persentase_bagi_hasil").notNull().default(60),

    /**
     * Menandai bahwa "pemilik" ini adalah rental itu sendiri.
     *
     * Sepeda milik sendiri tetap butuh baris pemilik supaya seluruh laporan dan
     * kolom snapshot bekerja tanpa perubahan. Yang berbeda hanya artinya:
     * persentasenya wajib 0, sehingga seluruh uangnya masuk ke bagian rental dan
     * ikut terhitung sebagai laba — bukan menumpuk sebagai utang kepada diri
     * sendiri di Laporan Pemilik.
     *
     * Sebelum kolom ini ada, sepeda milik sendiri dititipkan ke pemilik palsu
     * berpersentase 100, yang artinya justru terbalik: seluruh omzetnya dihitung
     * sebagai hak pihak lain dan sepeda milik sendiri menyumbang nol ke laba.
     */
    milikSendiri: boolean("milik_sendiri").notNull().default(false),

    catatan: text("catatan"),
    aktif: boolean("aktif").notNull().default(true),
    dibuatPada: timestamp("dibuat_pada", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Hanya boleh ada satu. Dua baris "milik sendiri" akan membuat omzet sepeda
    // sendiri terpecah dua tanpa alasan, dan tidak ada cara memilih mana yang
    // benar. Dijaga database, bukan hanya formulirnya.
    uniqueIndex("owners_satu_milik_sendiri")
      .on(t.milikSendiri)
      .where(sql`${t.milikSendiri} = true`),
  ],
);

export const bikes = pgTable(
  "bikes",
  {
    id: serial("id").primaryKey(),
    /** Isi QR yang ditempel di sepeda, mis. "MTB-023". */
    kode: text("kode").notNull().unique(),
    nama: text("nama").notNull(),
    jenis: text("jenis").notNull(),
    merk: text("merk"),
    /** Alamat gambar dari luar, dipakai kalau foto tidak diunggah. */
    fotoUrl: text("foto_url"),
    /** Foto yang diunggah, disimpan langsung di database. */
    fotoData: bytea("foto_data"),
    fotoTipe: text("foto_tipe"),
    /** Berubah tiap kali foto diganti; dipakai sebagai penanda versi di alamat gambar. */
    fotoVersi: integer("foto_versi").notNull().default(0),
    /** Rupiah bulat per jam. Tidak ada desimal di seluruh aplikasi. */
    tarifPerJam: integer("tarif_per_jam").notNull(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "restrict" }),
    status: statusSepedaEnum("status").notNull().default("tersedia"),
    catatan: text("catatan"),
    dibuatPada: timestamp("dibuat_pada", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("bikes_owner_idx").on(t.ownerId), index("bikes_status_idx").on(t.status)],
);

/** Penyewa dikenali dari nomor HP supaya pelanggan lama tidak terdata berulang. */
export const renters = pgTable("renters", {
  id: serial("id").primaryKey(),
  nama: text("nama").notNull(),
  noHp: text("no_hp").notNull().unique(),
  catatan: text("catatan"),
  dibuatPada: timestamp("dibuat_pada", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rentals = pgTable(
  "rentals",
  {
    id: serial("id").primaryKey(),
    bikeId: integer("bike_id")
      .notNull()
      .references(() => bikes.id, { onDelete: "restrict" }),
    renterId: integer("renter_id")
      .notNull()
      .references(() => renters.id, { onDelete: "restrict" }),
    /** Petugas yang memulai rental. */
    kasirId: integer("kasir_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    /**
     * Petugas yang menyelesaikan rental, dan karena itu yang menerima uangnya.
     *
     * Berbeda dari kasirId kalau shift berganti saat sepeda masih di jalan — dan
     * rental bisa berjam-jam, jadi itu bukan kejadian langka. Rekap kas harus
     * mengikuti siapa yang memegang uang, bukan siapa yang mencatat
     * keberangkatannya.
     */
    diselesaikanOleh: integer("diselesaikan_oleh").references(() => users.id, {
      onDelete: "restrict",
    }),

    // --- Kolom snapshot ---
    // Disalin saat rental dimulai. Kalau tarif atau persentase bagi hasil diubah
    // bulan depan, laporan dan bagi hasil bulan lalu tidak ikut berubah.
    ownerIdSnapshot: integer("owner_id_snapshot")
      .notNull()
      .references(() => owners.id, { onDelete: "restrict" }),
    tarifPerJamSnapshot: integer("tarif_per_jam_snapshot").notNull(),
    persentasePemilikSnapshot: integer("persentase_pemilik_snapshot").notNull(),

    waktuMulai: timestamp("waktu_mulai", { withTimezone: true }).notNull(),
    waktuSelesai: timestamp("waktu_selesai", { withTimezone: true }),
    /** Perkiraan durasi yang disebut penyewa saat mulai. Tidak dipakai untuk menagih. */
    estimasiJam: integer("estimasi_jam"),

    // --- Hasil perhitungan, diisi saat rental diselesaikan ---
    durasiMenit: integer("durasi_menit"),
    durasiJamDitagih: integer("durasi_jam_ditagih"),
    totalBiaya: integer("total_biaya"),
    bagianPemilik: integer("bagian_pemilik"),
    bagianRental: integer("bagian_rental"),

    metodeBayar: metodeBayarEnum("metode_bayar"),
    status: statusRentalEnum("status").notNull().default("berjalan"),
    jaminan: text("jaminan"),
    catatan: text("catatan"),

    // --- Jejak pembatalan ---
    // Sebelumnya jejak ini ditulis sebagai teks ke dalam kolom catatan, yang
    // berarti catatan asli kasir — jaminan apa yang ditahan, kondisi sepeda —
    // ikut terhapus, dan pertanyaan "siapa membatalkan apa bulan ini" hanya bisa
    // dijawab dengan memindai teks. Nama juga tidak bisa disambungkan kembali ke
    // tabel pengguna kalau namanya berubah.
    dibatalkanOleh: integer("dibatalkan_oleh").references(() => users.id, {
      onDelete: "restrict",
    }),
    dibatalkanPada: timestamp("dibatalkan_pada", { withTimezone: true }),
    alasanBatal: text("alasan_batal"),
    dibuatPada: timestamp("dibuat_pada", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Satu sepeda hanya boleh punya satu rental berjalan. Dijaga oleh database,
    // bukan hanya oleh pengecekan di aplikasi, supaya dua petugas yang menekan
    // START bersamaan tidak bisa membuat rental ganda.
    uniqueIndex("rentals_satu_berjalan_per_sepeda")
      .on(t.bikeId)
      .where(sql`${t.status} = 'berjalan'`),
    index("rentals_waktu_mulai_idx").on(t.waktuMulai),
    index("rentals_waktu_selesai_idx").on(t.waktuSelesai),
    index("rentals_status_idx").on(t.status),
    index("rentals_owner_snapshot_idx").on(t.ownerIdSnapshot),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    // Kode yang dibacakan ke penyewa lewat telepon (mis. BK-0031) sengaja tidak
    // disimpan sebagai kolom. Ia murni turunan dari id, jadi menyimpannya hanya
    // menambah satu kolom unik yang bisa bentrok tanpa memberi manfaat apa pun.
    // Lihat kodeBooking() di lib/booking/kode.ts.
    id: serial("id").primaryKey(),
    bikeId: integer("bike_id")
      .notNull()
      .references(() => bikes.id, { onDelete: "restrict" }),
    renterId: integer("renter_id")
      .notNull()
      .references(() => renters.id, { onDelete: "restrict" }),
    dicatatOleh: integer("dicatat_oleh")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    waktuMulai: timestamp("waktu_mulai", { withTimezone: true }).notNull(),
    /** Durasi yang dipesan, dalam jam bulat. Tarif memang dihitung per jam. */
    durasiJam: integer("durasi_jam").notNull(),

    /** Tarif saat booking dibuat, supaya perubahan tarif tidak mengubah janji harga. */
    tarifPerJamSnapshot: integer("tarif_per_jam_snapshot").notNull(),
    metodeBayar: metodeBayarEnum("metode_bayar"),

    status: statusBookingEnum("status").notNull().default("booking"),
    /** Diisi saat booking berubah menjadi rental yang berjalan. */
    rentalId: integer("rental_id").references(() => rentals.id, {
      onDelete: "set null",
    }),
    catatan: text("catatan"),
    dibuatPada: timestamp("dibuat_pada", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Satu booking tidak boleh melahirkan dua rental, bahkan kalau tombol
    // ditekan dua kali atau dua petugas menjemput booking yang sama.
    uniqueIndex("bookings_rental_unik")
      .on(t.rentalId)
      .where(sql`${t.rentalId} is not null`),
    index("bookings_waktu_mulai_idx").on(t.waktuMulai),
    index("bookings_status_idx").on(t.status),
    index("bookings_bike_idx").on(t.bikeId),
  ],
);

/**
 * Satu baris untuk tiap jam yang dipesan sebuah booking.
 *
 * Inilah yang mencegah dua booking bertumpang tindih. Cara yang biasa dipakai
 * untuk ini adalah EXCLUDE constraint dengan rentang waktu, tapi itu menuntut
 * ekstensi btree_gist yang TIDAK tersedia di PGlite — database lokal aplikasi
 * ini. Memecah booking menjadi baris per jam membuat pencegahan bentrok cukup
 * memakai indeks unik biasa, sehingga migrasi yang sama berjalan di PGlite
 * maupun Neon tanpa ekstensi apa pun.
 *
 * Satuan jam bukan batasan yang dipaksakan: tarif rental ini memang per jam,
 * dibulatkan ke atas dengan minimum satu jam.
 */
export const bookingSlots = pgTable(
  "booking_slots",
  {
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    bikeId: integer("bike_id")
      .notNull()
      .references(() => bikes.id, { onDelete: "cascade" }),
    /** Awal jam yang dipesan, selalu tepat di menit 00. */
    jam: timestamp("jam", { withTimezone: true }).notNull(),
    /** Menjadi false saat booking dibatalkan, sehingga jamnya bebas kembali. */
    aktif: boolean("aktif").notNull().default(true),
  },
  (t) => [
    uniqueIndex("booking_slots_satu_pemesan_per_jam")
      .on(t.bikeId, t.jam)
      .where(sql`${t.aktif}`),
    index("booking_slots_jam_idx").on(t.jam),
    index("booking_slots_booking_idx").on(t.bookingId),
  ],
);

export const maintenances = pgTable(
  "maintenances",
  {
    id: serial("id").primaryKey(),
    bikeId: integer("bike_id")
      .notNull()
      .references(() => bikes.id, { onDelete: "cascade" }),
    tanggal: timestamp("tanggal", { withTimezone: true }).notNull(),
    jenis: jenisMaintenanceEnum("jenis").notNull().default("servis"),
    deskripsi: text("deskripsi").notNull(),
    biaya: integer("biaya").notNull().default(0),
    /** Total jam pakai sepeda saat diservis, sebagai pengganti kilometer. */
    jamPakai: integer("jam_pakai"),
    tanggalServisBerikutnya: date("tanggal_servis_berikutnya"),
    mekanik: text("mekanik"),
    catatan: text("catatan"),
    dicatatOleh: integer("dicatat_oleh")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dibuatPada: timestamp("dibuat_pada", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("maintenances_bike_idx").on(t.bikeId),
    index("maintenances_tanggal_idx").on(t.tanggal),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    tanggal: timestamp("tanggal", { withTimezone: true }).notNull(),
    kategori: kategoriPengeluaranEnum("kategori").notNull(),
    keterangan: text("keterangan").notNull(),
    jumlah: integer("jumlah").notNull(),
    /**
     * Terisi kalau pengeluaran ini berasal dari catatan maintenance. Biaya
     * servis hanya boleh muncul sekali di laba/rugi, dan tabel inilah satu-satunya
     * sumber angka pengeluaran — biaya di tabel maintenance tidak ikut dijumlah.
     */
    maintenanceId: integer("maintenance_id").references(() => maintenances.id, {
      onDelete: "cascade",
    }),
    /**
     * Menentukan apakah uang ini keluar dari laci kasir atau dari rekening.
     * Laba/rugi tidak peduli caranya dibayar, tapi rekap kas harian peduli
     * sekali: pengeluaran tunai mengurangi uang yang harus disetorkan.
     *
     * Baris lama diisi "tunai" oleh migrasi. Rekap kas baru dipakai sejak fitur
     * ini ada, jadi tebakan itu tidak mengubah penutupan mana pun yang sudah
     * terjadi — tidak ada.
     */
    metode: metodeBayarEnum("metode").notNull().default("tunai"),
    dicatatOleh: integer("dicatat_oleh")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dibuatPada: timestamp("dibuat_pada", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("expenses_tanggal_idx").on(t.tanggal),
    index("expenses_kategori_idx").on(t.kategori),
    uniqueIndex("expenses_maintenance_unik")
      .on(t.maintenanceId)
      .where(sql`${t.maintenanceId} is not null`),
  ],
);

/** Setoran uang bagi hasil dari rental kepada pemilik sepeda. */
export const ownerPayments = pgTable(
  "owner_payments",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "restrict" }),
    tanggal: timestamp("tanggal", { withTimezone: true }).notNull(),
    jumlah: integer("jumlah").notNull(),
    metode: metodeBayarEnum("metode").notNull().default("tunai"),
    catatan: text("catatan"),
    dicatatOleh: integer("dicatat_oleh")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dibuatPada: timestamp("dibuat_pada", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("owner_payments_owner_idx").on(t.ownerId),
    index("owner_payments_tanggal_idx").on(t.tanggal),
  ],
);

/**
 * Penutupan kas harian oleh kasir.
 *
 * Aplikasi selama ini tahu berapa uang yang seharusnya masuk, tapi tidak pernah
 * tahu berapa yang benar-benar berpindah tangan. Selisih laci baru ketahuan
 * berhari-hari kemudian, saat ingatan semua orang sudah kabur.
 *
 * Dibuat dua langkah: kasir mencatat berapa yang ia serahkan, lalu admin atau
 * owner menandainya diterima. Satu langkah saja tidak cukup — tanpa penerimaan,
 * yang tercatat cuma pengakuan sepihak.
 */
export const cashDeposits = pgTable(
  "cash_deposits",
  {
    id: serial("id").primaryKey(),
    /** Awal hari WIB yang ditutup. Bukan waktu penutupannya dilakukan. */
    tanggal: timestamp("tanggal", { withTimezone: true }).notNull(),
    kasirId: integer("kasir_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    // --- Angka sistem, dibekukan saat penutupan dibuat ---
    // Disimpan, bukan dihitung ulang saat dibaca. Kalau besok ada rental yang
    // dibatalkan atau pengeluaran yang diperbaiki, penutupan yang sudah
    // ditandatangani tidak boleh ikut berubah diam-diam — kalau ia berubah,
    // selisih yang dulu disepakati jadi tidak bisa dipertanggungjawabkan lagi.
    penerimaanTunai: integer("penerimaan_tunai").notNull(),
    pengeluaranTunai: integer("pengeluaran_tunai").notNull(),
    setoranPemilikTunai: integer("setoran_pemilik_tunai").notNull(),
    jumlahSeharusnya: integer("jumlah_seharusnya").notNull(),

    /** Uang fisik yang benar-benar diserahkan. */
    jumlahDiserahkan: integer("jumlah_diserahkan").notNull(),
    /** Diserahkan dikurangi seharusnya. Negatif berarti kurang. */
    selisih: integer("selisih").notNull(),
    catatan: text("catatan"),

    status: statusSetoranEnum("status").notNull().default("menunggu"),
    diterimaOleh: integer("diterima_oleh").references(() => users.id, {
      onDelete: "restrict",
    }),
    diterimaPada: timestamp("diterima_pada", { withTimezone: true }),

    /**
     * Pembatalan penutupan yang salah ketik.
     *
     * Barisnya dibatalkan, tidak dihapus. Penutupan kas adalah tempat selisih
     * uang dipersoalkan; baris yang bisa lenyap tanpa jejak membuat seluruh
     * catatan itu tidak ada gunanya sebagai pertanggungjawaban.
     */
    dibatalkanOleh: integer("dibatalkan_oleh").references(() => users.id, {
      onDelete: "restrict",
    }),
    dibatalkanPada: timestamp("dibatalkan_pada", { withTimezone: true }),
    alasanBatal: text("alasan_batal"),

    dibuatPada: timestamp("dibuat_pada", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Satu penutupan per kasir per hari. Dijaga database, bukan hanya aplikasi,
    // supaya dua kali tekan tidak menghasilkan dua setoran untuk hari yang sama.
    //
    // Yang sudah dibatalkan dikecualikan, sehingga kasir bisa menutup ulang hari
    // itu. Syaratnya memakai kolom dibatalkan_pada, bukan nilai enum status:
    // Postgres menolak memakai nilai enum yang baru ditambahkan di dalam
    // transaksi yang sama, dan migrasi ini menambah nilai itu.
    uniqueIndex("cash_deposits_kasir_tanggal_unik")
      .on(t.kasirId, t.tanggal)
      .where(sql`${t.dibatalkanPada} is null`),
    index("cash_deposits_tanggal_idx").on(t.tanggal),
    index("cash_deposits_status_idx").on(t.status),
  ],
);

/**
 * Pengaturan aplikasi. Selalu tepat satu baris; kolom id dikunci bernilai 1
 * supaya tidak mungkin ada dua baris pengaturan yang saling bertentangan.
 */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  namaUsaha: text("nama_usaha").notNull().default("Rental Sepeda Garut"),
  alamat: text("alamat"),
  noHp: text("no_hp"),
  /** Batas jam sebelum rental berjalan ditandai mencurigakan di dashboard. */
  batasJamRental: integer("batas_jam_rental").notNull().default(12),
  /** Toleransi keterlambatan penjemputan booking, dalam menit. */
  toleransiBookingMenit: integer("toleransi_booking_menit").notNull().default(60),
  diperbaruiPada: timestamp("diperbarui_pada", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Owner = typeof owners.$inferSelect;
export type Bike = typeof bikes.$inferSelect;
export type Renter = typeof renters.$inferSelect;
export type Rental = typeof rentals.$inferSelect;

export type Booking = typeof bookings.$inferSelect;
export type Maintenance = typeof maintenances.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type OwnerPayment = typeof ownerPayments.$inferSelect;
export type Settings = typeof settings.$inferSelect;

export type Peran = (typeof peranEnum.enumValues)[number];
export type StatusSepeda = (typeof statusSepedaEnum.enumValues)[number];
export type StatusRental = (typeof statusRentalEnum.enumValues)[number];
export type MetodeBayar = (typeof metodeBayarEnum.enumValues)[number];
export type StatusBooking = (typeof statusBookingEnum.enumValues)[number];
export type JenisMaintenance = (typeof jenisMaintenanceEnum.enumValues)[number];
export type KategoriPengeluaran =
  (typeof kategoriPengeluaranEnum.enumValues)[number];
