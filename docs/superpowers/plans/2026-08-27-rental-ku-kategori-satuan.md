# Rental Ku — kategori barang dan satuan sewa: rencana implementasi

> **Untuk pekerja agentik:** SUB-SKILL WAJIB: pakai superpowers:subagent-driven-development
> (disarankan) atau superpowers:executing-plans untuk mengerjakan rencana ini task demi
> task. Langkah memakai checkbox (`- [ ]`) untuk penanda.

**Goal:** Mengubah aplikasi rental sepeda menjadi "Rental Ku" yang melayani kategori
barang apa pun, dengan satuan sewa (jam atau hari) yang melekat pada kategori.

**Architecture:** Konsep "satuan" masuk sebagai parameter murni ke mesin harga lebih
dulu, dengan `jam` menghasilkan angka yang identik dengan sekarang. Setelah itu barulah
kategori diperkenalkan sebagai tabel, tarif dan aturan keterlambatan pindah ke sana, dan
terakhir `bikes` diganti nama menjadi `items`. Urutan ini dipilih supaya setiap task
berakhir dengan tes hijau dan build berhasil.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Drizzle ORM, Postgres (Neon di
produksi, PGlite lokal dan di uji), Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-27-rental-ku-kategori-satuan-design.md`

## Global Constraints

- Seluruh nilai uang **rupiah bulat**. Tidak ada desimal di mana pun.
- Migrasi **hanya maju**. Tidak ada rollback. Cadangkan database produksi sebelum
  menjalankan migrasi apa pun dari rencana ini.
- Bahasa kode dan komentar: **Indonesia**, mengikuti seluruh repo.
- Nama tabel Inggris, nama kolom Indonesia — konvensi yang sudah berlaku.
- Setiap task berakhir hijau: `npx vitest run --maxWorkers=2`, `npm run cek:tipe`,
  `npm run lint`, `npm run build` semuanya exit 0.
- Jalankan vitest dengan `--maxWorkers=2`. Tanpa itu 30 berkas uji menyalakan 30
  instance PGlite WASM sekaligus dan prosesnya mati dengan `VirtualAlloc failed` —
  kegagalan memori yang menyamar sebagai kegagalan tes.
- Tiga aturan mesin harga **tidak boleh berubah**: pokok dibulatkan ke bawah, denda
  hanya saran yang cuma boleh diturunkan kasir, bagian rental dihitung sebagai sisa.

## BAHAYA: drizzle-kit dan penggantian nama

`drizzle.config.ts` memakai `strict: true`. Rencana ini memuat lima penggantian nama:

| Dari | Menjadi |
| --- | --- |
| tabel `bikes` | `items` |
| `bikes.tarif_per_jam` | `items.tarif` |
| `rentals.bike_id` | `rentals.item_id` |
| `rentals.tarif_per_jam_snapshot` | `rentals.tarif_snapshot` |
| `rentals.durasi_jam_ditagih` | `rentals.durasi_satuan_ditagih` |

`drizzle-kit generate` **menebak** apakah perubahan itu penggantian nama atau kolom
lama dibuang lalu kolom baru dibuat. Tebakan yang salah menghasilkan `DROP COLUMN`, dan
seluruh isi kolom itu hilang tanpa peringatan.

**Setelah setiap `npm run db:generate` dalam rencana ini, WAJIB buka berkas SQL yang
baru dibuat di `drizzle/` dan pastikan isinya `ALTER TABLE ... RENAME`, bukan
`DROP COLUMN` atau `DROP TABLE`.** Kalau yang muncul DROP, hapus berkas migrasinya,
tulis tangan SQL `RENAME`-nya, dan sesuaikan berkas snapshot di `drizzle/meta/` dengan
menjalankan ulang generate setelah SQL-nya benar.

---

## Struktur berkas

**Dibuat:**

| Berkas | Tanggung jawab |
| --- | --- |
| `lib/rental/satuan.ts` | Definisi satuan sewa dan menit per satuan. Murni, tanpa impor. Diimpor mesin harga dan skema supaya nilainya tidak mungkin berbeda di dua tempat. |
| `lib/queries/kategori.ts` | Pembacaan kategori |
| `lib/actions/kategori.ts` | Simpan dan nonaktifkan kategori |
| `app/(app)/pengaturan/kategori/page.tsx` | Halaman kelola kategori |
| `components/pengaturan/form-kategori.tsx` | Formulirnya |
| `test/satuan-hari.test.ts` | Uji satuan hari |
| `test/kategori.test.ts` | Uji aturan kategori |

**Diubah besar:** `lib/rental/pricing.ts`, `lib/db/schema.ts`, `lib/actions/rental.ts`,
`lib/queries/bikes.ts` → `lib/queries/items.ts`, `lib/actions/bikes.ts` →
`lib/actions/items.ts`, `components/sepeda/*` → `components/barang/*`,
`app/(app)/sepeda/*` → `app/(app)/barang/*`.

---

## Task 1: Ganti nama produk menjadi "Rental Ku"

**Files:**
- Modify: `app/layout.tsx:36-38`, `app/login/page.tsx:50`, `components/nav/menu.ts:165`,
  `lib/queries/pengaturan.ts:10`, `app/globals.css:4`, `README.md:1`
- Test: tidak ada tes baru — ini teks tampilan

**Interfaces:**
- Consumes: —
- Produces: — (tidak ada API yang berubah)

Nama usaha yang tersimpan di database adalah data milik pemakai, bukan identitas
aplikasi. Jangan menyentuh baris `settings` mana pun di sini.

- [ ] **Step 1: Ganti metadata**

`app/layout.tsx`:
```ts
  title: {
    default: "Rental Ku",
    template: "%s · Rental Ku",
  },
  description:
    "Pencatatan rental per jam atau per hari, bagi hasil pemilik, dan laporan harian.",
```

- [ ] **Step 2: Ganti judul halaman login**

`app/login/page.tsx`, ganti isi `<h1>` menjadi `Rental Ku`.

- [ ] **Step 3: Ganti label cadangan menu**

`components/nav/menu.ts`:
```ts
  return cocok?.label ?? "Rental Ku";
```

- [ ] **Step 4: Ganti nilai bawaan pengaturan**

`lib/queries/pengaturan.ts`:
```ts
  namaUsaha: "Rental Ku",
```

- [ ] **Step 5: Ganti komentar dan judul README**

`app/globals.css` baris 4 menjadi `Sistem warna Rental Ku.`; `README.md` baris 1 menjadi
`# Rental Ku`.

- [ ] **Step 6: Verifikasi**

```bash
npx vitest run --maxWorkers=2 && npm run cek:tipe && npm run lint && npm run build
```
Harapan: semuanya exit 0, 356 tes lolos.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Ganti nama produk menjadi Rental Ku"
```

---

## Task 2: Mesin harga menerima satuan

Task terpenting dan paling berisiko. Dikerjakan lebih dulu justru karena `lib/rental/pricing.ts`
murni — tanpa database, tanpa jam sistem — sehingga bisa dibuktikan benar sebelum apa pun
yang lain bergerak.

**Files:**
- Create: `lib/rental/satuan.ts`
- Modify: `lib/rental/pricing.ts`, `lib/rental/pricing.test.ts`
- Modify (pemanggil): `lib/actions/rental.ts`, `lib/queries/rentals.ts`,
  `components/rental/finish-panel.tsx`, dan berkas lain yang muncul dari
  `git grep -l "tarifPerJam" -- lib components app`
- Test: `lib/rental/pricing.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `type Satuan = "jam" | "hari"`
  - `MENIT_PER_SATUAN: Record<Satuan, number>` = `{ jam: 60, hari: 1440 }`
  - `hitungSatuanPokok(durasiMenit: number, satuan: Satuan): number`
  - `hitungSisaMenit(durasiMenit: number, satuan: Satuan): number`
  - `hitungSaranTambahan(sisaMenit: number, tarif: number, toleransiMenit: number, satuan: Satuan): number`
  - `InputBiaya` kini `{ waktuMulai, waktuSelesai, tarif, satuan, persentasePemilik, toleransiMenit, tambahanDitagih? }`
  - `HasilBiaya` kini memuat `durasiSatuanDitagih` menggantikan `durasiJamDitagih`

- [ ] **Step 1: Tulis tes yang gagal untuk satuan hari**

Tambahkan di `lib/rental/pricing.test.ts`:

```ts
import { hitungSatuanPokok, hitungSisaMenit, hitungSaranTambahan } from "./pricing";

describe("satuan hari", () => {
  // 2 hari 3 jam = 2*1440 + 180 = 3060 menit
  it("membulatkan pokok ke bawah dalam satuan hari", () => {
    expect(hitungSatuanPokok(3060, "hari")).toBe(2);
    expect(hitungSisaMenit(3060, "hari")).toBe(180);
  });

  it("menagih satu hari penuh untuk sewa di bawah sehari", () => {
    expect(hitungSatuanPokok(600, "hari")).toBe(1);
    expect(hitungSisaMenit(600, "hari")).toBe(0);
  });

  // Blok denda harian adalah separuh hari (720 menit), tarifnya separuh tarif harian.
  it("menghitung denda harian per separuh hari", () => {
    expect(hitungSaranTambahan(180, 200_000, 60, "hari")).toBe(100_000);
    expect(hitungSaranTambahan(800, 200_000, 60, "hari")).toBe(200_000);
  });

  it("tidak mendenda selama sisa masih dalam toleransi", () => {
    expect(hitungSaranTambahan(45, 200_000, 60, "hari")).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

```bash
npx vitest run lib/rental/pricing.test.ts
```
Harapan: GAGAL. Pesannya soal jumlah argumen atau `hitungSatuanPokok` tidak ada — bukan
soal salah ketik.

- [ ] **Step 3: Buat modul satuan**

`lib/rental/satuan.ts`:
```ts
/**
 * Satuan sewa. Murni tanpa impor apa pun supaya bisa dipakai mesin harga maupun
 * definisi skema, dan nilainya tidak mungkin berbeda di dua tempat.
 */

export const SATUAN = ["jam", "hari"] as const;

export type Satuan = (typeof SATUAN)[number];

/**
 * Sepeda disewa per jam, mobil hampir selalu per hari. Seluruh perhitungan bekerja
 * dalam menit, jadi satuan cukup diterjemahkan menjadi angka ini.
 */
export const MENIT_PER_SATUAN: Record<Satuan, number> = {
  jam: 60,
  hari: 1440,
};
```

- [ ] **Step 4: Umumkan mesin harga**

Di `lib/rental/pricing.ts`, hapus `MENIT_PER_BLOK_DENDA` dan ganti ketiga fungsi:

```ts
import { MENIT_PER_SATUAN, type Satuan } from "./satuan";

export function hitungSatuanPokok(durasiMenit: number, satuan: Satuan): number {
  pastikanDurasiSah(durasiMenit);
  return Math.max(1, Math.floor(durasiMenit / MENIT_PER_SATUAN[satuan]));
}

export function hitungSisaMenit(durasiMenit: number, satuan: Satuan): number {
  pastikanDurasiSah(durasiMenit);
  return Math.max(
    0,
    durasiMenit - hitungSatuanPokok(durasiMenit, satuan) * MENIT_PER_SATUAN[satuan],
  );
}

export function hitungSaranTambahan(
  sisaMenit: number,
  tarif: number,
  toleransiMenit: number,
  satuan: Satuan,
): number {
  pastikanTarifSah(tarif);
  pastikanToleransiSah(toleransiMenit);
  if (sisaMenit <= toleransiMenit) return 0;

  // Blok denda adalah separuh satuan: 30 menit untuk jam, 12 jam untuk hari.
  const menitPerBlok = MENIT_PER_SATUAN[satuan] / 2;
  const blok = Math.ceil(sisaMenit / menitPerBlok);
  return blok * Math.floor(tarif / 2);
}
```

Perbarui juga komentar puncak berkas: purnamanya sekarang "tanpa database, tanpa jam
sistem, tanpa impor selain tipe satuan".

- [ ] **Step 5: Sesuaikan `hitungBiaya`**

```ts
export type InputBiaya = {
  waktuMulai: Date;
  waktuSelesai: Date;
  tarif: number;
  satuan: Satuan;
  persentasePemilik: number;
  toleransiMenit: number;
  tambahanDitagih?: number;
};

export type HasilBiaya = {
  durasiMenit: number;
  durasiSatuanDitagih: number;
  sisaMenit: number;
  tambahanSaran: number;
  tambahanDitagih: number;
  totalBiaya: number;
  bagianPemilik: number;
  bagianRental: number;
};
```

Di dalam badannya, ganti pemanggilan menjadi bersatuan dan
`totalBiaya = durasiSatuanDitagih * tarif + tambahanFinal`. Jangan sentuh aturan
"kasir hanya boleh menurunkan" maupun perhitungan `bagianRental` sebagai sisa.

Perbaiki pesan galat `pastikanTarifSah` menjadi "Tarif harus berupa rupiah bulat dan
tidak negatif." — kata "per jam" di situ sekarang salah.

- [ ] **Step 6: Sesuaikan tes lama**

Di `lib/rental/pricing.test.ts`, seluruh pemanggilan lama diberi `"jam"` dan
`tarifPerJam:` menjadi `tarif:` + `satuan: "jam"`. **Angka yang ditegaskan tidak boleh
berubah satu pun.** Kalau ada yang berubah, itu regresi, bukan penyesuaian.

- [ ] **Step 7: Sesuaikan pemanggil di aplikasi**

```bash
git grep -l "tarifPerJam\|durasiJamDitagih" -- lib components app
```

Di setiap pemanggil `hitungBiaya`, kirim `satuan: "jam"` sebagai nilai tetap sementara.
Task 7 yang akan menggantinya dengan satuan asli dari kategori. Kolom database
`tarifPerJamSnapshot` dan `durasiJamDitagih` **belum** berganti nama di task ini —
hanya sisi TypeScript-nya yang menyesuaikan.

- [ ] **Step 8: Verifikasi**

```bash
npx vitest run --maxWorkers=2 && npm run cek:tipe && npm run lint && npm run build
```
Harapan: semuanya exit 0. Jumlah tes bertambah 4 dari yang baru.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Mesin harga menerima satuan sewa, jam jadi kasus khususnya"
```

---

## Task 3: Tabel kategori

**Files:**
- Modify: `lib/db/schema.ts`
- Create: migrasi di `drizzle/` (hasil generate)
- Create: `test/kategori.test.ts`

**Interfaces:**
- Consumes: `Satuan`, `SATUAN` dari `lib/rental/satuan.ts`
- Produces: tabel `categories` dengan kolom `id`, `nama`, `satuan`, `toleransiTelatMenit`,
  `batasBerjalanSatuan`, `aktif`, `urutan`, `dibuatPada`; tipe `Category`

- [ ] **Step 1: Tulis tes yang gagal**

`test/kategori.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buatDbUji, type DbUji } from "./db-uji";
import { categories } from "@/lib/db/schema";

let uji: DbUji;

beforeAll(async () => {
  uji = await buatDbUji();
});

afterAll(async () => {
  await uji.tutup();
});

beforeEach(async () => {
  await uji.db.delete(categories);
});

describe("kategori barang", () => {
  it("menyimpan satuan sewa dan aturan keterlambatannya", async () => {
    const [baru] = await uji.db
      .insert(categories)
      .values({
        nama: "Mobil",
        satuan: "hari",
        toleransiTelatMenit: 60,
        batasBerjalanSatuan: 7,
      })
      .returning();

    expect(baru.satuan).toBe("hari");
    expect(baru.aktif).toBe(true);
  });

  it("menolak dua kategori bernama sama", async () => {
    await uji.db.insert(categories).values({
      nama: "Sepeda",
      satuan: "jam",
      toleransiTelatMenit: 5,
      batasBerjalanSatuan: 12,
    });

    await expect(
      uji.db.insert(categories).values({
        nama: "Sepeda",
        satuan: "jam",
        toleransiTelatMenit: 5,
        batasBerjalanSatuan: 12,
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

```bash
npx vitest run test/kategori.test.ts
```
Harapan: GAGAL karena `categories` tidak diekspor dari schema.

- [ ] **Step 3: Tambahkan tabel ke skema**

Di `lib/db/schema.ts`, sebelum definisi `bikes`:

```ts
import { SATUAN } from "@/lib/rental/satuan";

export const satuanSewaEnum = pgEnum("satuan_sewa", SATUAN);

/**
 * Kategori barang yang disewakan.
 *
 * Satuan sewa melekat di sini, bukan di barang: sepeda disewa per jam, mobil hampir
 * selalu per hari, dan menaruh keputusan itu pada tiap barang berarti menambah satu
 * pertanyaan pada setiap unit yang didaftarkan.
 *
 * Toleransi keterlambatan dan ambang rental mencurigakan ikut ke sini karena keduanya
 * kehilangan arti kalau global: toleransi 5 menit yang wajar untuk sepeda membuat mobil
 * yang telat 6 menit kena denda separuh hari.
 */
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  nama: text("nama").notNull().unique(),
  satuan: satuanSewaEnum("satuan").notNull(),
  /** Kelewatan pengembalian yang masih dianggap wajar, dalam menit. */
  toleransiTelatMenit: integer("toleransi_telat_menit").notNull(),
  /** Setelah sekian satuan, rental berjalan ditandai mencurigakan di dashboard. */
  batasBerjalanSatuan: integer("batas_berjalan_satuan").notNull(),
  /** Kategori lama dinonaktifkan, tidak dihapus, supaya laporan lama tetap terbaca. */
  aktif: boolean("aktif").notNull().default(true),
  urutan: integer("urutan").notNull().default(0),
  dibuatPada: timestamp("dibuat_pada", { withTimezone: true }).notNull().defaultNow(),
});

export type Category = typeof categories.$inferSelect;
```

- [ ] **Step 4: Buat migrasi**

```bash
npm run db:generate
```

**Lalu buka berkas SQL barunya di `drizzle/` dan baca.** Harapan: `CREATE TYPE
"satuan_sewa"` dan `CREATE TABLE "categories"`. Tidak boleh ada `DROP` apa pun.

- [ ] **Step 5: Jalankan tes**

```bash
npx vitest run test/kategori.test.ts
```
Harapan: LOLOS. Uji memakai PGlite yang membangun skema dari berkas migrasi, jadi
migrasinya ikut terbukti bisa dijalankan.

- [ ] **Step 6: Verifikasi penuh dan commit**

```bash
npx vitest run --maxWorkers=2 && npm run cek:tipe && npm run lint && npm run build
git add -A
git commit -m "Tambah tabel kategori barang beserta satuan sewanya"
```

---

## Task 4: Kategori "Sepeda" dari pengaturan yang ada

Migrasi data, dipisah dari Task 3 supaya kegagalannya tidak bercampur dengan kegagalan
pembuatan tabel.

**Files:**
- Create: migrasi tulis tangan di `drizzle/`
- Modify: `lib/db/seed.ts`, `lib/db/demo.ts`

**Interfaces:**
- Consumes: tabel `categories` dari Task 3
- Produces: tepat satu baris kategori bernama "Sepeda" pada database yang sudah ada

- [ ] **Step 1: Tulis migrasi tangan**

Buat `drizzle/0007_kategori_sepeda_awal.sql` (sesuaikan nomornya dengan yang terakhir):

```sql
INSERT INTO "categories" ("nama", "satuan", "toleransi_telat_menit", "batas_berjalan_satuan", "urutan")
SELECT 'Sepeda', 'jam', "toleransi_telat_menit", "batas_jam_rental", 0
FROM "settings" WHERE "id" = 1
ON CONFLICT ("nama") DO NOTHING;
```

Nilainya diambil dari baris `settings`, bukan angka tetap, supaya rental yang sudah
menyesuaikan setelannya tidak diam-diam dikembalikan ke bawaan.

- [ ] **Step 2: Daftarkan migrasi ke jurnal**

Tambahkan entri untuk berkas itu di `drizzle/meta/_journal.json`, meniru bentuk entri
sebelumnya. Tanpa ini migrasinya tidak akan pernah dijalankan.

- [ ] **Step 3: Isi seed dan demo**

Di `lib/db/seed.ts`, sebelum sepeda disisipkan, buat kategori "Sepeda"
(`satuan: "jam"`, `toleransiTelatMenit: 5`, `batasBerjalanSatuan: 12`) dan simpan
id-nya. Lakukan hal yang sama di `lib/db/demo.ts` jika ia menyentuh barang.

- [ ] **Step 4: Verifikasi dan commit**

```bash
npx vitest run --maxWorkers=2 && npm run cek:tipe && npm run lint && npm run build
git add -A
git commit -m "Turunkan setelan rental yang ada menjadi kategori Sepeda"
```

---

## Task 5: Barang menunjuk ke kategori

**Files:**
- Modify: `lib/db/schema.ts`, `lib/queries/bikes.ts`, `lib/actions/bikes.ts`,
  `components/sepeda/bike-form.tsx`
- Create: `lib/queries/kategori.ts`
- Test: `test/kategori.test.ts`

**Interfaces:**
- Consumes: `categories`
- Produces: `bikes.categoryId` (FK, NOT NULL); `daftarKategoriAktif(): Promise<Category[]>`
  di `lib/queries/kategori.ts`; kolom `jenis` **hilang**

- [ ] **Step 1: Tambah kolom nullable dulu**

Di skema, tambahkan `categoryId: integer("category_id").references(() => categories.id, { onDelete: "restrict" })`
**tanpa** `.notNull()`. Jalankan `npm run db:generate`, baca SQL-nya, pastikan hanya
`ADD COLUMN`.

- [ ] **Step 2: Migrasi tangan untuk mengisi**

Buat berkas SQL berikutnya, daftarkan di `_journal.json`:

```sql
UPDATE "bikes" SET "category_id" = (SELECT "id" FROM "categories" WHERE "nama" = 'Sepeda')
WHERE "category_id" IS NULL;--> statement-breakpoint
ALTER TABLE "bikes" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bikes" DROP COLUMN "jenis";
```

Isi-dulu-baru-kunci. Dibalik urutannya, migrasi gagal di tengah pada database yang sudah
berisi barang.

- [ ] **Step 3: Jadikan kolomnya wajib di skema dan buang `jenis`**

Tambahkan `.notNull()` pada `categoryId`, hapus baris `jenis` dari definisi `bikes`.
Jangan generate lagi — SQL-nya sudah ditulis tangan di Step 2; cukup jalankan
`npm run db:generate` sekali untuk menyegarkan snapshot dan **pastikan SQL yang
dihasilkan kosong**. Kalau ia menghasilkan pernyataan baru, berarti skema dan migrasi
tangan tidak sinkron — perbaiki dulu.

- [ ] **Step 4: Query kategori**

`lib/queries/kategori.ts`:
```ts
import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, type Category } from "@/lib/db/schema";

/** Kategori yang boleh dipilih saat mendaftarkan barang baru. */
export async function daftarKategoriAktif(): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(eq(categories.aktif, true))
    .orderBy(asc(categories.urutan), asc(categories.nama));
}

export async function semuaKategori(): Promise<Category[]> {
  return db.select().from(categories).orderBy(asc(categories.urutan), asc(categories.nama));
}
```

- [ ] **Step 5: Formulir memakai pemilih kategori**

Di `components/sepeda/bike-form.tsx`, ganti `<Input name="jenis" list="daftar-jenis">`
beserta `<datalist>`-nya dengan `<Select name="categoryId" required>` berisi opsi dari
`daftarKategoriAktif()` yang diterima sebagai prop. Sesuaikan skema Zod di
`lib/actions/bikes.ts`: `jenis: z.string()...` menjadi
`categoryId: z.coerce.number().int().positive()`.

- [ ] **Step 6: Sesuaikan query barang**

Di `lib/queries/bikes.ts`, ganti `jenis: bikes.jenis` menjadi join ke `categories` yang
mengambil `kategoriNama: categories.nama` dan `satuan: categories.satuan`. Sesuaikan
tipe `RingkasanSepeda` dan seluruh tempat yang menampilkan `jenis`.

- [ ] **Step 7: Verifikasi dan commit**

```bash
npx vitest run --maxWorkers=2 && npm run cek:tipe && npm run lint && npm run build
git add -A
git commit -m "Barang menunjuk ke kategori, kolom jenis teks bebas dibuang"
```

---

## Task 6: Toleransi dan ambang dibaca dari kategori

**Files:**
- Modify: `lib/db/schema.ts`, `lib/queries/pengaturan.ts`, `lib/actions/rental.ts`,
  `lib/queries/rentals.ts`, `components/pengaturan/form-pengaturan.tsx`
- Create: migrasi

**Interfaces:**
- Consumes: `categories.toleransiTelatMenit`, `categories.batasBerjalanSatuan`
- Produces: `settings` tanpa `batasJamRental` dan `toleransiTelatMenit`;
  `PENGATURAN_BAWAAN` menyusut mengikutinya

- [ ] **Step 1: Alihkan seluruh pembaca**

```bash
git grep -n "toleransiTelatMenit\|batasJamRental" -- lib components app
```

Setiap tempat yang membacanya dari `settings` diubah membacanya dari kategori barang
yang bersangkutan. `toleransiBookingMenit` **tidak ikut** — ia soal penyewa telat
menjemput, bukan barang telat kembali, dan tetap di `settings`.

- [ ] **Step 2: Buang dari skema dan formulir pengaturan**

Hapus kedua kolom dari `settings` di skema, dari `PENGATURAN_BAWAAN`, dan dari
`components/pengaturan/form-pengaturan.tsx`.

- [ ] **Step 3: Generate migrasi dan BACA SQL-nya**

```bash
npm run db:generate
```
Harapan: dua `ALTER TABLE "settings" DROP COLUMN`. Ini memang drop yang disengaja —
nilainya sudah diselamatkan ke kategori pada Task 4.

- [ ] **Step 4: Verifikasi dan commit**

```bash
npx vitest run --maxWorkers=2 && npm run cek:tipe && npm run lint && npm run build
git add -A
git commit -m "Pindahkan toleransi dan ambang rental dari pengaturan ke kategori"
```

---

## Task 7: Snapshot satuan pada transaksi

**Files:**
- Modify: `lib/db/schema.ts`, `lib/actions/rental.ts`, `lib/queries/rentals.ts`
- Create: migrasi
- Test: `test/satuan-hari.test.ts`

**Interfaces:**
- Consumes: `Satuan`, `satuanSewaEnum`
- Produces: `rentals.satuanSnapshot` (NOT NULL); `rentals.tarifSnapshot`;
  `rentals.durasiSatuanDitagih`

- [ ] **Step 1: Tulis tes yang gagal**

Buat `test/satuan-hari.test.ts`. Perhatikan: pada titik ini tabel masih bernama `bikes`
dan kolomnya masih `tarifPerJam` — keduanya baru berganti nama di Task 9.

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDbUji, type DbUji } from "./db-uji";
import { bikes, categories, owners, renters, rentals, users } from "@/lib/db/schema";

let uji: DbUji;
let idKategori: number;
let idBarang: number;
let idPemilik: number;
let idKasir: number;
let idPenyewa: number;

const TARIF_HARIAN = 200_000;
const PERSEN = 60;

beforeAll(async () => {
  uji = await buatDbUji();

  const [kategori] = await uji.db
    .insert(categories)
    .values({
      nama: "Mobil",
      satuan: "hari",
      toleransiTelatMenit: 60,
      batasBerjalanSatuan: 7,
    })
    .returning({ id: categories.id });
  idKategori = kategori.id;

  const [pemilik] = await uji.db
    .insert(owners)
    .values({ nama: "Andi", noHp: "081200000010", persentaseBagiHasil: PERSEN })
    .returning({ id: owners.id });
  idPemilik = pemilik.id;

  const [barang] = await uji.db
    .insert(bikes)
    .values({
      kode: "MBL-001",
      nama: "Toyota Avanza",
      categoryId: idKategori,
      tarifPerJam: TARIF_HARIAN,
      ownerId: idPemilik,
    })
    .returning({ id: bikes.id });
  idBarang = barang.id;

  const [kasir] = await uji.db
    .insert(users)
    .values({ username: "kasir-uji", passwordHash: "x", nama: "Rina", peran: "kasir" })
    .returning({ id: users.id });
  idKasir = kasir.id;

  const [penyewa] = await uji.db
    .insert(renters)
    .values({ nama: "Asep", noHp: "081200000011" })
    .returning({ id: renters.id });
  idPenyewa = penyewa.id;
});

afterAll(async () => {
  await uji.tutup();
});

describe("snapshot satuan", () => {
  it("tidak ikut berubah ketika satuan kategorinya diubah kemudian", async () => {
    const waktuMulai = new Date("2026-08-01T02:00:00.000Z");
    // 2 hari 3 jam = 3060 menit
    const waktuSelesai = new Date("2026-08-03T05:00:00.000Z");
    const total = 2 * TARIF_HARIAN;
    const pemilik = Math.floor((total * PERSEN) / 100);

    const [rental] = await uji.db
      .insert(rentals)
      .values({
        bikeId: idBarang,
        renterId: idPenyewa,
        kasirId: idKasir,
        diselesaikanOleh: idKasir,
        ownerIdSnapshot: idPemilik,
        tarifSnapshot: TARIF_HARIAN,
        satuanSnapshot: "hari",
        persentasePemilikSnapshot: PERSEN,
        waktuMulai,
        waktuSelesai,
        durasiMenit: 3060,
        durasiSatuanDitagih: 2,
        totalBiaya: total,
        bagianPemilik: pemilik,
        bagianRental: total - pemilik,
        status: "selesai",
      })
      .returning({ id: rentals.id });

    await uji.db
      .update(categories)
      .set({ satuan: "jam" })
      .where(eq(categories.id, idKategori));

    const [sesudah] = await uji.db
      .select({ satuanSnapshot: rentals.satuanSnapshot })
      .from(rentals)
      .where(eq(rentals.id, rental.id));

    expect(sesudah.satuanSnapshot).toBe("hari");

    // Dikembalikan supaya task berikutnya memakai kategori harian yang utuh.
    await uji.db
      .update(categories)
      .set({ satuan: "hari" })
      .where(eq(categories.id, idKategori));
  });
});
```

- [ ] **Step 2: Tambah kolom nullable, lalu isi, lalu kunci**

Skema: tambahkan `satuanSnapshot: satuanSewaEnum("satuan_snapshot")` tanpa `.notNull()`.
Generate, baca SQL, pastikan hanya `ADD COLUMN`.

Lalu migrasi tangan:
```sql
UPDATE "rentals" SET "satuan_snapshot" = 'jam' WHERE "satuan_snapshot" IS NULL;--> statement-breakpoint
ALTER TABLE "rentals" ALTER COLUMN "satuan_snapshot" SET NOT NULL;
```

Seluruh transaksi lama memang bersatuan jam — itu satu-satunya satuan yang pernah ada.

- [ ] **Step 3: Ganti nama dua kolom lama**

Skema: `tarifPerJamSnapshot` → `tarifSnapshot` (`tarif_per_jam_snapshot` →
`tarif_snapshot`), `durasiJamDitagih` → `durasiSatuanDitagih` (`durasi_jam_ditagih` →
`durasi_satuan_ditagih`).

```bash
npm run db:generate
```

**BACA SQL-nya.** Harus `ALTER TABLE "rentals" RENAME COLUMN`. Kalau muncul `DROP COLUMN`
plus `ADD COLUMN`, hapus berkas itu, tulis tangan RENAME-nya, dan jalankan generate lagi
sampai SQL yang dihasilkan kosong.

- [ ] **Step 4: Verifikasi dan commit**

```bash
npx vitest run --maxWorkers=2 && npm run cek:tipe && npm run lint && npm run build
git add -A
git commit -m "Simpan satuan sewa sebagai snapshot pada tiap transaksi"
```

---

## Task 8: Harga memakai satuan kategori

Menyambungkan Task 2 dengan Task 5. Setelah ini `"jam"` yang ditanam sementara hilang.

**Files:**
- Modify: `lib/actions/rental.ts`, `lib/queries/rentals.ts`,
  `components/rental/finish-panel.tsx`
- Test: `test/satuan-hari.test.ts`

**Interfaces:**
- Consumes: `categories.satuan`, `hitungBiaya`
- Produces: rental yang selesai menyimpan `satuanSnapshot` dari kategori barangnya

- [ ] **Step 1: Tulis tes yang membaca aturan dari kategori**

Tambahkan di `test/satuan-hari.test.ts`. Yang dibuktikan: satuan **dan** toleransi
diambil dari baris kategori, bukan dari `settings` maupun nilai tetap.

```ts
import { hitungBiaya } from "@/lib/rental/pricing";

describe("biaya memakai aturan kategori", () => {
  it("menghitung sewa 2 hari 3 jam sebagai 2 hari plus denda separuh hari", async () => {
    const [kategori] = await uji.db
      .select()
      .from(categories)
      .where(eq(categories.id, idKategori));

    const hasil = hitungBiaya({
      waktuMulai: new Date("2026-08-01T02:00:00.000Z"),
      waktuSelesai: new Date("2026-08-03T05:00:00.000Z"),
      tarif: TARIF_HARIAN,
      satuan: kategori.satuan,
      persentasePemilik: PERSEN,
      toleransiMenit: kategori.toleransiTelatMenit,
    });

    expect(hasil.durasiSatuanDitagih).toBe(2);
    expect(hasil.sisaMenit).toBe(180);
    expect(hasil.tambahanSaran).toBe(TARIF_HARIAN / 2);
    expect(hasil.totalBiaya).toBe(2 * TARIF_HARIAN + TARIF_HARIAN / 2);
  });

  it("tidak mendenda kelewatan yang masih dalam toleransi kategori", async () => {
    const [kategori] = await uji.db
      .select()
      .from(categories)
      .where(eq(categories.id, idKategori));

    // 1 hari lewat 30 menit; toleransi kategori 60 menit.
    const hasil = hitungBiaya({
      waktuMulai: new Date("2026-08-01T02:00:00.000Z"),
      waktuSelesai: new Date("2026-08-02T02:30:00.000Z"),
      tarif: TARIF_HARIAN,
      satuan: kategori.satuan,
      persentasePemilik: PERSEN,
      toleransiMenit: kategori.toleransiTelatMenit,
    });

    expect(hasil.durasiSatuanDitagih).toBe(1);
    expect(hasil.tambahanSaran).toBe(0);
    expect(hasil.totalBiaya).toBe(TARIF_HARIAN);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

```bash
npx vitest run test/satuan-hari.test.ts
```
Harapan: GAGAL. Kalau `lib/actions/rental.ts` masih menanam `satuan: "jam"`, alur
sungguhannya belum memakai kategori — dan tes ini menjadi penanda bahwa penyambungannya
di Step 3 memang dibutuhkan.

- [ ] **Step 3: Ambil satuan dari kategori**

Saat rental dimulai, salin `satuan` kategori barang ke `rentals.satuanSnapshot` bersama
`tarifSnapshot` dan `persentasePemilikSnapshot` yang sudah ada. Saat rental
diselesaikan, kirim `satuan: rental.satuanSnapshot` dan
`toleransiMenit: kategori.toleransiTelatMenit` ke `hitungBiaya` — bukan nilai dari
`settings`.

Satuan diambil dari **snapshot**, bukan dari kategori saat ini. Kategori bisa berubah
setelah rental berjalan, dan harga harus mengikuti kesepakatan saat sewa dimulai.

- [ ] **Step 4: Verifikasi dan commit**

```bash
npx vitest run --maxWorkers=2 && npm run cek:tipe && npm run lint && npm run build
git add -A
git commit -m "Hitung biaya memakai satuan dari kategori barangnya"
```

---

## Task 9: Ganti nama bikes menjadi items

Task terbesar dari sisi jumlah berkas, tapi paling mekanis. Dikerjakan **terakhir di
antara perubahan skema** supaya kalau ada yang rusak, penyebabnya jelas penggantian nama
dan bukan perubahan perilaku.

**Files:**
- Modify: `lib/db/schema.ts` dan seluruh keluaran
  `git grep -l "bikes\|bikeId\|sepeda\|Sepeda" -- lib components app test`
- Rename: `lib/queries/bikes.ts` → `items.ts`, `lib/actions/bikes.ts` → `items.ts`,
  `components/sepeda/` → `components/barang/`, `app/(app)/sepeda/` → `app/(app)/barang/`,
  `app/api/sepeda/` → `app/api/barang/`
- Create: migrasi

**Interfaces:**
- Consumes: semua di atas
- Produces: tabel `items`, kolom `items.tarif`, `rentals.itemId`, enum
  `status_barang`; rute `/barang`

- [ ] **Step 1: Ganti nama di skema**

`bikes` → `items` (nama tabel `"items"`), `tarifPerJam` → `tarif` (`tarif` di SQL),
`bikeId` → `itemId` (`item_id`), `statusSepedaEnum` → `statusBarangEnum`
(`status_barang`), indeks `bikes_owner_idx` → `items_owner_idx`, `bikes_status_idx` →
`items_status_idx`. Ekspor tipe `Bike` menjadi `Item`.

- [ ] **Step 2: Generate migrasi dan BACA SQL-nya dengan teliti**

```bash
npm run db:generate
```

Ini titik paling berbahaya di seluruh rencana. Yang **harus** muncul:

```sql
ALTER TABLE "bikes" RENAME TO "items";
ALTER TABLE "items" RENAME COLUMN "tarif_per_jam" TO "tarif";
ALTER TABLE "rentals" RENAME COLUMN "bike_id" TO "item_id";
ALTER TYPE "status_sepeda" RENAME TO "status_barang";
```

Kalau muncul `DROP TABLE "bikes"` atau `CREATE TABLE "items"`, **hapus berkas migrasi
itu** dan tulis tangan SQL di atas. Menjalankan DROP berarti seluruh barang, foto, dan
kaitannya ke transaksi hilang.

- [ ] **Step 3: Ganti nama berkas dengan git mv**

```bash
git mv lib/queries/bikes.ts lib/queries/items.ts
git mv lib/actions/bikes.ts lib/actions/items.ts
git mv components/sepeda components/barang
git mv "app/(app)/sepeda" "app/(app)/barang"
git mv app/api/sepeda app/api/barang
```

`git mv`, bukan hapus-lalu-buat, supaya riwayat berkasnya tersambung.

- [ ] **Step 4: Ganti seluruh acuan**

Telusuri `git grep -l "bikes\|bikeId\|/sepeda\|Sepeda"` dan ganti. Termasuk: rute
`/sepeda` → `/barang` di `components/nav/menu.ts`, label menu "Data Sepeda" → "Data
Barang", teks pada stiker QR, dan nama berkas uji.

Sisakan kata "sepeda" hanya di tempat yang memang membicarakan sepeda sungguhan — data
contoh di `seed.ts` dan nama kategori "Sepeda".

- [ ] **Step 5: Verifikasi dan commit**

```bash
npx vitest run --maxWorkers=2 && npm run cek:tipe && npm run lint && npm run build
git add -A
git commit -m "Ganti nama bikes menjadi items, aplikasi tidak lagi khusus sepeda"
```

---

## Task 10: Menu Kategori di Pengaturan

**Files:**
- Create: `app/(app)/pengaturan/kategori/page.tsx`,
  `components/pengaturan/form-kategori.tsx`, `lib/actions/kategori.ts`
- Modify: `components/pengaturan/nav-pengaturan.tsx`
- Test: `test/kategori.test.ts`

**Interfaces:**
- Consumes: `daftarKategoriAktif`, `semuaKategori`
- Produces: `simpanKategori(_sebelumnya: StatusAksi, formData: FormData): Promise<StatusAksi>`,
  `ubahAktifKategori(formData: FormData): Promise<void>`

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di `test/kategori.test.ts`. Pada titik ini tabelnya sudah bernama `items`
(Task 9 sudah lewat).

```ts
import { eq } from "drizzle-orm";
import { categories, items, owners } from "@/lib/db/schema";

describe("kategori yang sedang dipakai", () => {
  it("tidak bisa dihapus selama masih ada barang di dalamnya", async () => {
    const [kategori] = await uji.db
      .insert(categories)
      .values({
        nama: "Motor",
        satuan: "hari",
        toleransiTelatMenit: 60,
        batasBerjalanSatuan: 7,
      })
      .returning({ id: categories.id });

    const [pemilik] = await uji.db
      .insert(owners)
      .values({ nama: "Dedi", noHp: "081200000020", persentaseBagiHasil: 50 })
      .returning({ id: owners.id });

    await uji.db.insert(items).values({
      kode: "MTR-001",
      nama: "Honda Beat",
      categoryId: kategori.id,
      tarif: 100_000,
      ownerId: pemilik.id,
    });

    // ON DELETE RESTRICT pada items.category_id yang menahannya, bukan pemeriksaan
    // di aplikasi — jadi jalur mana pun yang mencoba menghapus akan tertahan.
    await expect(
      uji.db.delete(categories).where(eq(categories.id, kategori.id)),
    ).rejects.toThrow();

    const [masihAda] = await uji.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, kategori.id));

    expect(masihAda).toBeDefined();
  });

  it("bisa dinonaktifkan sehingga hilang dari pilihan barang baru", async () => {
    const [kategori] = await uji.db
      .insert(categories)
      .values({
        nama: "HP",
        satuan: "hari",
        toleransiTelatMenit: 60,
        batasBerjalanSatuan: 30,
        aktif: false,
      })
      .returning({ id: categories.id });

    const { daftarKategoriAktif } = await import("@/lib/queries/kategori");
    const aktif = await daftarKategoriAktif();

    expect(aktif.some((k) => k.id === kategori.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Action kategori**

`lib/actions/kategori.ts` mengikuti pola `lib/actions/owners.ts` — baca berkas itu lebih
dulu. Wajib memanggil `wajibPengguna()` dan menolak peran kasir seperti action data
induk lainnya:

```ts
const pengguna = await wajibPengguna();
if (pengguna.peran === "kasir") {
  return { galat: "Hanya admin atau owner yang boleh mengubah kategori." };
}
```

Penghapusan mengikuti pola `hapusPemilik`: kategori yang masih punya barang
dinonaktifkan, bukan dihapus, supaya laporan lama tetap terbaca.

- [ ] **Step 3: Halaman dan formulir**

Meniru `app/(app)/pengaturan/tim/page.tsx` dan `components/pengaturan/form-tim.tsx`.
Formulir berisi nama, pemilih satuan (jam/hari), toleransi menit, dan ambang berjalan.
Tambahkan tautannya di `components/pengaturan/nav-pengaturan.tsx`.

- [ ] **Step 4: Verifikasi dan commit**

```bash
npx vitest run --maxWorkers=2 && npm run cek:tipe && npm run lint && npm run build
git add -A
git commit -m "Tambah menu kelola kategori barang di Pengaturan"
```

---

## Setelah semua task

- [ ] Jalankan `npm run db:migrate` ke database produksi **setelah mencadangkannya**.
- [ ] Buka aplikasi, buat kategori "Motor" bersatuan hari, daftarkan satu barang di
      dalamnya, jalankan satu rental sampai selesai, dan periksa angkanya di Laporan
      Harian.
- [ ] Landing page (sub-proyek 3) menunggu rencananya sendiri, dan menunggu nomor
      WhatsApp serta daftar harga dari pemiliknya.
