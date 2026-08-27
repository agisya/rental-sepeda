import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buatDbUji, type DbUji } from "./db-uji";
import { users } from "@/lib/db/schema";
import { hashKataSandi } from "@/lib/auth/password";
import { adalahAkunDemo, cariAkunDemo, namaAkunDemo } from "@/lib/auth/demo";

/**
 * Akun demo untuk portofolio.
 *
 * Tombol "Coba demo" memasukkan pengunjung tanpa mengetik apa pun, jadi akun yang
 * dituju harus dipastikan aman sebelum sesinya dibuat. Aturannya ada di modul ini,
 * bukan di Server Action, karena action memanggil buatCookieSesi() yang membaca
 * next/headers dan tidak bisa dijalankan di luar Next — pola yang sama dengan
 * lib/pengguna/kelola.ts.
 *
 * Yang dijaga: pintu ini hanya terbuka kalau AKUN_DEMO sengaja disetel, dan hanya
 * untuk akun kasir yang aktif. Peran kasir sudah diblokir dari setiap aksi merusak
 * di lib/actions, jadi peranlah yang menjadi batas sesungguhnya — kalau pemeriksaan
 * ini longgar, tombol publik itu berubah menjadi pintu masuk admin.
 */

let uji: DbUji;

beforeAll(async () => {
  uji = await buatDbUji();
});

afterAll(async () => {
  await uji.tutup();
});

let akunDemoAsli: string | undefined;

beforeEach(async () => {
  akunDemoAsli = process.env.AKUN_DEMO;
  delete process.env.AKUN_DEMO;
  await uji.db.delete(users);
});

afterEach(() => {
  if (akunDemoAsli === undefined) delete process.env.AKUN_DEMO;
  else process.env.AKUN_DEMO = akunDemoAsli;
});

async function buatPengguna(opsi: {
  username: string;
  peran: "admin" | "kasir" | "owner";
  aktif?: boolean;
}) {
  await uji.db.insert(users).values({
    username: opsi.username,
    passwordHash: await hashKataSandi("sandi-uji-yang-panjang"),
    nama: "Pengguna Uji",
    peran: opsi.peran,
    aktif: opsi.aktif ?? true,
  });
}

describe("nama akun demo", () => {
  it("tidak ada selama AKUN_DEMO tidak disetel", () => {
    expect(namaAkunDemo()).toBeNull();
  });

  // Variabel yang ada tapi berisi spasi sama saja dengan tidak disetel. Tanpa ini,
  // salah tempel di dashboard menyalakan tombol demo yang menunjuk ke akun kosong.
  it("menganggap isian kosong atau spasi sebagai tidak disetel", () => {
    for (const nilai of ["", "   "]) {
      process.env.AKUN_DEMO = nilai;
      expect(namaAkunDemo()).toBeNull();
    }
  });

  it("mengecilkan huruf dan membuang spasi di tepi", () => {
    process.env.AKUN_DEMO = "  Demo  ";
    expect(namaAkunDemo()).toBe("demo");
  });
});

describe("pengenalan akun demo", () => {
  it("tidak mengenali siapa pun selama AKUN_DEMO tidak disetel", () => {
    expect(adalahAkunDemo("demo")).toBe(false);
  });

  it("mengenali akun yang disebut AKUN_DEMO tanpa peduli besar kecil huruf", () => {
    process.env.AKUN_DEMO = "demo";
    expect(adalahAkunDemo("demo")).toBe(true);
    expect(adalahAkunDemo("DEMO")).toBe(true);
  });

  it("tidak mengenali akun lain", () => {
    process.env.AKUN_DEMO = "demo";
    expect(adalahAkunDemo("kasir")).toBe(false);
    expect(adalahAkunDemo("demo2")).toBe(false);
  });
});

describe("pencarian akun demo", () => {
  // Ini yang membuat fitur demo tidak ada sama sekali di Dokploy dan di komputer
  // sendiri: tidak ada variabel, tidak ada tombol, tidak ada jalan masuk.
  it("menolak selama AKUN_DEMO tidak disetel", async () => {
    await buatPengguna({ username: "demo", peran: "kasir" });
    await expect(cariAkunDemo()).resolves.toEqual({ ada: false, alasan: "tidak-disetel" });
  });

  it("menolak kalau akun yang disebut tidak ada", async () => {
    process.env.AKUN_DEMO = "demo";
    await expect(cariAkunDemo()).resolves.toEqual({ ada: false, alasan: "tidak-ada" });
  });

  // Menonaktifkan akun demo harus benar-benar menutup pintunya. Kalau tidak,
  // satu-satunya cara mematikan demo adalah menghapus variabel environment.
  it("menolak akun yang sudah dinonaktifkan", async () => {
    process.env.AKUN_DEMO = "demo";
    await buatPengguna({ username: "demo", peran: "kasir", aktif: false });
    await expect(cariAkunDemo()).resolves.toEqual({ ada: false, alasan: "nonaktif" });
  });

  // Yang paling berbahaya. Peran kasir adalah satu-satunya hal yang menghalangi
  // pengunjung menghapus sepeda, mengubah pengaturan, dan membuka menu keuangan.
  // Salah setel AKUN_DEMO ke akun admin akan membagikan kendali penuh lewat tombol
  // publik, jadi peran diperiksa di sini dan bukan sekadar diasumsikan.
  it("menolak akun yang bukan kasir", async () => {
    for (const peran of ["admin", "owner"] as const) {
      await uji.db.delete(users);
      process.env.AKUN_DEMO = "demo";
      await buatPengguna({ username: "demo", peran });
      await expect(cariAkunDemo()).resolves.toEqual({ ada: false, alasan: "bukan-kasir" });
    }
  });

  it("menerima kasir aktif yang disebut AKUN_DEMO", async () => {
    process.env.AKUN_DEMO = "demo";
    await buatPengguna({ username: "demo", peran: "kasir" });

    const hasil = await cariAkunDemo();

    expect(hasil.ada).toBe(true);
    if (!hasil.ada) return;
    expect(hasil.pengguna).toMatchObject({
      username: "demo",
      nama: "Pengguna Uji",
      peran: "kasir",
    });
    expect(hasil.pengguna.id).toBeGreaterThan(0);
  });
});
