import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDbUji, type DbUji } from "./db-uji";
import { users } from "@/lib/db/schema";
import { cocokkanKataSandi } from "@/lib/auth/password";
import {
  AdminTerakhir,
  PenggunaTidakAda,
  SistemSudahTerisi,
  UsernameDipakai,
  buatAdminPertama,
  daftarPengguna,
  setAktifPengguna,
  setelUlangSandi,
  sistemKosong,
  tambahPengguna,
} from "@/lib/pengguna/kelola";

/**
 * Uji pengelolaan akun.
 *
 * Yang diuji di sini adalah lapisan database-nya, bukan Server Action-nya. Action
 * memanggil wajibPeran() yang membaca cookie, dan cookie tidak ada di luar Next.
 * Karena itu aturan yang benar-benar berbahaya kalau salah — akun pertama hanya
 * sekali, username tidak boleh ganda, dan admin aktif terakhir tidak boleh
 * dinonaktifkan — sengaja ditaruh di modul yang bisa dijalankan apa adanya.
 */

let uji: DbUji;

beforeAll(async () => {
  uji = await buatDbUji();
});

afterAll(async () => {
  await uji.tutup();
});

beforeEach(async () => {
  await uji.db.delete(users);
});

describe("akun pertama", () => {
  it("menganggap sistem kosong selama belum ada pengguna", async () => {
    expect(await sistemKosong()).toBe(true);

    await buatAdminPertama({ username: "budi", nama: "Budi", kataSandi: "sandi-yang-kuat" });

    expect(await sistemKosong()).toBe(false);
  });

  it("memberi peran admin pada akun pertama", async () => {
    await buatAdminPertama({ username: "budi", nama: "Budi", kataSandi: "sandi-yang-kuat" });

    const [akun] = await uji.db.select().from(users).where(eq(users.username, "budi"));

    expect(akun.peran).toBe("admin");
    expect(akun.aktif).toBe(true);
  });

  it("menyimpan kata sandi sebagai hash, bukan teks asli", async () => {
    await buatAdminPertama({ username: "budi", nama: "Budi", kataSandi: "sandi-yang-kuat" });

    const [akun] = await uji.db.select().from(users).where(eq(users.username, "budi"));

    expect(akun.passwordHash).not.toBe("sandi-yang-kuat");
    expect(await cocokkanKataSandi("sandi-yang-kuat", akun.passwordHash)).toBe(true);
  });

  it("menormalkan username jadi huruf kecil", async () => {
    // Login mencari dengan username yang sudah dikecilkan. Kalau baris tersimpan
    // dengan huruf besar, akunnya tidak akan pernah bisa dipakai masuk dan
    // galatnya terbaca sebagai "kata sandi salah" — menyesatkan sekali.
    await buatAdminPertama({ username: "  BuDi  ", nama: "Budi", kataSandi: "sandi-yang-kuat" });

    const [akun] = await uji.db.select().from(users).where(eq(users.username, "budi"));

    expect(akun).toBeDefined();
  });

  it("menolak dipakai lagi begitu sudah ada satu pengguna", async () => {
    await buatAdminPertama({ username: "budi", nama: "Budi", kataSandi: "sandi-yang-kuat" });

    await expect(
      buatAdminPertama({ username: "penyusup", nama: "Penyusup", kataSandi: "sandi-yang-kuat" }),
    ).rejects.toThrow(SistemSudahTerisi);

    expect(await uji.db.select().from(users)).toHaveLength(1);
  });

  it("tetap menolak walaupun pengguna yang ada bukan admin", async () => {
    await tambahPengguna({
      username: "rina",
      nama: "Rina",
      peran: "kasir",
      kataSandi: "sandi-yang-kuat",
    });

    await expect(
      buatAdminPertama({ username: "penyusup", nama: "Penyusup", kataSandi: "sandi-yang-kuat" }),
    ).rejects.toThrow(SistemSudahTerisi);
  });
});

describe("menambah anggota tim", () => {
  beforeEach(async () => {
    await buatAdminPertama({ username: "budi", nama: "Budi", kataSandi: "sandi-yang-kuat" });
  });

  it("membuat akun dengan peran yang diminta", async () => {
    await tambahPengguna({
      username: "rina",
      nama: "Rina Kasir",
      peran: "kasir",
      kataSandi: "sandi-yang-kuat",
    });

    const [akun] = await uji.db.select().from(users).where(eq(users.username, "rina"));

    expect(akun.peran).toBe("kasir");
    expect(akun.nama).toBe("Rina Kasir");
    expect(await cocokkanKataSandi("sandi-yang-kuat", akun.passwordHash)).toBe(true);
  });

  it("menolak username yang sudah dipakai", async () => {
    await expect(
      tambahPengguna({
        username: "budi",
        nama: "Budi Lain",
        peran: "kasir",
        kataSandi: "sandi-yang-kuat",
      }),
    ).rejects.toThrow(UsernameDipakai);
  });

  it("menolak username yang sama walau ditulis dengan huruf besar", async () => {
    await expect(
      tambahPengguna({
        username: "BUDI",
        nama: "Budi Lain",
        peran: "kasir",
        kataSandi: "sandi-yang-kuat",
      }),
    ).rejects.toThrow(UsernameDipakai);
  });
});

describe("mengaktifkan dan menonaktifkan", () => {
  it("menolak menonaktifkan admin aktif yang terakhir", async () => {
    // Tanpa penjaga ini satu klik bisa mengunci aplikasi dari semua orang, dan
    // pemulihannya harus lewat SQL langsung ke database produksi.
    const admin = await buatAdminPertama({
      username: "budi",
      nama: "Budi",
      kataSandi: "sandi-yang-kuat",
    });

    await tambahPengguna({
      username: "rina",
      nama: "Rina",
      peran: "kasir",
      kataSandi: "sandi-yang-kuat",
    });

    await expect(setAktifPengguna(admin.id, false)).rejects.toThrow(AdminTerakhir);

    const [masih] = await uji.db.select().from(users).where(eq(users.id, admin.id));
    expect(masih.aktif).toBe(true);
  });

  it("mengizinkan menonaktifkan admin kalau masih ada admin aktif lain", async () => {
    const pertama = await buatAdminPertama({
      username: "budi",
      nama: "Budi",
      kataSandi: "sandi-yang-kuat",
    });

    await tambahPengguna({
      username: "sari",
      nama: "Sari",
      peran: "admin",
      kataSandi: "sandi-yang-kuat",
    });

    await setAktifPengguna(pertama.id, false);

    const [akun] = await uji.db.select().from(users).where(eq(users.id, pertama.id));
    expect(akun.aktif).toBe(false);
  });

  it("tidak menghitung admin yang sudah nonaktif sebagai penjaga", async () => {
    const pertama = await buatAdminPertama({
      username: "budi",
      nama: "Budi",
      kataSandi: "sandi-yang-kuat",
    });

    const kedua = await tambahPengguna({
      username: "sari",
      nama: "Sari",
      peran: "admin",
      kataSandi: "sandi-yang-kuat",
    });

    await setAktifPengguna(kedua.id, false);

    // Tinggal satu admin yang aktif, jadi yang ini tidak boleh ikut nonaktif.
    await expect(setAktifPengguna(pertama.id, false)).rejects.toThrow(AdminTerakhir);
  });

  it("membebaskan menonaktifkan peran selain admin", async () => {
    await buatAdminPertama({ username: "budi", nama: "Budi", kataSandi: "sandi-yang-kuat" });

    const kasir = await tambahPengguna({
      username: "rina",
      nama: "Rina",
      peran: "kasir",
      kataSandi: "sandi-yang-kuat",
    });

    await setAktifPengguna(kasir.id, false);

    const [akun] = await uji.db.select().from(users).where(eq(users.id, kasir.id));
    expect(akun.aktif).toBe(false);
  });

  it("bisa mengaktifkan kembali akun yang nonaktif", async () => {
    await buatAdminPertama({ username: "budi", nama: "Budi", kataSandi: "sandi-yang-kuat" });

    const kasir = await tambahPengguna({
      username: "rina",
      nama: "Rina",
      peran: "kasir",
      kataSandi: "sandi-yang-kuat",
    });

    await setAktifPengguna(kasir.id, false);
    await setAktifPengguna(kasir.id, true);

    const [akun] = await uji.db.select().from(users).where(eq(users.id, kasir.id));
    expect(akun.aktif).toBe(true);
  });
});

describe("id yang tidak ada", () => {
  it("ditolak saat mengubah status, bukan diam-diam tidak melakukan apa pun", async () => {
    await expect(setAktifPengguna(9999, false)).rejects.toThrow(PenggunaTidakAda);
  });

  it("ditolak saat menyetel ulang kata sandi", async () => {
    await expect(setelUlangSandi(9999, "sandi-yang-kuat")).rejects.toThrow(PenggunaTidakAda);
  });
});

describe("menyetel ulang kata sandi", () => {
  it("mengganti hash sehingga sandi lama tidak lagi berlaku", async () => {
    // Tanpa email tidak ada jalur "lupa sandi", jadi ini satu-satunya cara
    // petugas yang lupa bisa masuk lagi tanpa menyentuh database.
    const akun = await buatAdminPertama({
      username: "budi",
      nama: "Budi",
      kataSandi: "sandi-yang-lama",
    });

    await setelUlangSandi(akun.id, "sandi-yang-baru");

    const [baris] = await uji.db.select().from(users).where(eq(users.id, akun.id));

    expect(await cocokkanKataSandi("sandi-yang-baru", baris.passwordHash)).toBe(true);
    expect(await cocokkanKataSandi("sandi-yang-lama", baris.passwordHash)).toBe(false);
  });
});

describe("daftar pengguna", () => {
  it("tidak pernah membawa hash kata sandi keluar", async () => {
    await buatAdminPertama({ username: "budi", nama: "Budi", kataSandi: "sandi-yang-kuat" });

    const daftar = await daftarPengguna();

    expect(daftar).toHaveLength(1);
    expect(Object.keys(daftar[0])).not.toContain("passwordHash");
  });

  it("mengurutkan berdasarkan username supaya tampilannya tidak berpindah-pindah", async () => {
    await buatAdminPertama({ username: "budi", nama: "Budi", kataSandi: "sandi-yang-kuat" });
    await tambahPengguna({
      username: "ani",
      nama: "Ani",
      peran: "kasir",
      kataSandi: "sandi-yang-kuat",
    });
    await tambahPengguna({
      username: "sari",
      nama: "Sari",
      peran: "owner",
      kataSandi: "sandi-yang-kuat",
    });

    const daftar = await daftarPengguna();

    expect(daftar.map((p) => p.username)).toEqual(["ani", "budi", "sari"]);
  });
});
