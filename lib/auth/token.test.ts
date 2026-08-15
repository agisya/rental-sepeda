import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dekripsiSesi, enkripsiSesi } from "./token";

const RAHASIA = "rahasia-uji-yang-panjangnya-lebih-dari-32-karakter";
const RAHASIA_LAIN = "rahasia-lain-yang-juga-panjangnya-lebih-dari-32-kar";

const SESI = {
  userId: 7,
  username: "kasir",
  nama: "Rina Kasir",
  peran: "kasir" as const,
};

let asli: string | undefined;

beforeEach(() => {
  asli = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = RAHASIA;
});

afterEach(() => {
  process.env.SESSION_SECRET = asli;
});

describe("token sesi", () => {
  it("mengembalikan isi yang sama setelah dienkripsi lalu dibaca", async () => {
    const token = await enkripsiSesi(SESI);
    await expect(dekripsiSesi(token)).resolves.toEqual(SESI);
  });

  it("menolak token yang ditandatangani kunci lain", async () => {
    const token = await enkripsiSesi(SESI);

    process.env.SESSION_SECRET = RAHASIA_LAIN;
    await expect(dekripsiSesi(token)).resolves.toBeNull();
  });

  // Cookie yang diubah isinya tidak boleh membuat orang berganti peran menjadi
  // admin, dan tidak boleh membuat halaman error — cukup dianggap belum login.
  it("menolak token yang diubah isinya", async () => {
    const token = await enkripsiSesi(SESI);
    const bagian = token.split(".");
    const payloadPalsu = Buffer.from(
      JSON.stringify({ ...SESI, peran: "admin" }),
    ).toString("base64url");

    const dipalsukan = `${bagian[0]}.${payloadPalsu}.${bagian[2]}`;
    await expect(dekripsiSesi(dipalsukan)).resolves.toBeNull();
  });

  it("mengembalikan null untuk cookie kosong atau bukan token", async () => {
    await expect(dekripsiSesi(undefined)).resolves.toBeNull();
    await expect(dekripsiSesi("")).resolves.toBeNull();
    await expect(dekripsiSesi("bukan-token")).resolves.toBeNull();
  });

  it("menolak bekerja kalau SESSION_SECRET kurang dari 32 karakter", async () => {
    process.env.SESSION_SECRET = "pendek";
    await expect(enkripsiSesi(SESI)).rejects.toThrow(/32 karakter/);
  });
});
