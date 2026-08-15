import { describe, expect, it } from "vitest";
import { DIREKTORI_LOKAL_BAWAAN, tentukanModeDb } from "./mode";

describe("pemilihan mode database", () => {
  it("memakai database lokal kalau DATABASE_URL kosong atau tidak diisi", () => {
    for (const nilai of [undefined, "", "   "]) {
      expect(tentukanModeDb(nilai)).toEqual({
        jenis: "lokal",
        direktori: DIREKTORI_LOKAL_BAWAAN,
      });
    }
  });

  it("menerima lokasi berkas lokal yang ditentukan sendiri", () => {
    expect(tentukanModeDb("file:./data/uji")).toEqual({
      jenis: "lokal",
      direktori: "./data/uji",
    });
    expect(tentukanModeDb("file://./data/uji")).toEqual({
      jenis: "lokal",
      direktori: "./data/uji",
    });
  });

  it("memakai Neon untuk connection string Postgres", () => {
    const url = "postgresql://user:sandi@ep-abc.ap-southeast-1.aws.neon.tech/neondb";
    expect(tentukanModeDb(url)).toEqual({ jenis: "neon", connectionString: url });
    expect(tentukanModeDb("postgres://a:b@host/db").jenis).toBe("neon");
  });

  it("membuang spasi berlebih di sekitar connection string", () => {
    const mode = tentukanModeDb("  postgresql://a:b@host/db  ");
    expect(mode).toEqual({ jenis: "neon", connectionString: "postgresql://a:b@host/db" });
  });

  // Salah tempel adalah kesalahan yang paling mungkin terjadi. Lebih baik gagal
  // dengan pesan jelas daripada diam-diam membuat database lokal kosong.
  it("menolak nilai yang tidak dikenali dengan pesan yang menjelaskan", () => {
    expect(() => tentukanModeDb("mysql://a:b@host/db")).toThrow(/tidak dikenali/i);
    expect(() => tentukanModeDb("ep-abc.aws.neon.tech")).toThrow(/postgresql:\/\//);
  });
});
