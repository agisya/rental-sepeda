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

  // Driver Neon bicara lewat WebSocket ke proksi milik Neon dan tidak bisa
  // menyambung ke Postgres biasa. Salah memilih driver membuat deploy gagal saat
  // runtime, bukan saat build — jadi pengenalannya diuji ketat.
  it("memakai driver Neon hanya untuk host Neon", () => {
    for (const url of [
      "postgresql://user:sandi@ep-abc.ap-southeast-1.aws.neon.tech/neondb",
      "postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/db?sslmode=require",
      "postgres://u:p@ep-y.neon.build/db",
    ]) {
      expect(tentukanModeDb(url)).toEqual({ jenis: "neon", connectionString: url });
    }
  });

  it("memakai driver Postgres biasa untuk host lain", () => {
    for (const url of [
      "postgresql://user:sandi@postgres:5432/rental", // layanan Postgres di Dokploy
      "postgres://u:p@10.0.0.5:5432/rental",
      "postgresql://u:p@db.contoh.co.id/rental?sslmode=require",
      "postgresql://u:p@localhost:5432/rental",
    ]) {
      expect(tentukanModeDb(url)).toEqual({ jenis: "postgres", connectionString: url });
    }
  });

  // Nama host yang sekadar memuat kata "neon" bukan berarti layanan Neon.
  it("tidak tertipu host yang hanya menyerupai Neon", () => {
    expect(tentukanModeDb("postgresql://u:p@neon.tech.contoh.com/db").jenis).toBe(
      "postgres",
    );
    expect(tentukanModeDb("postgresql://u:p@myneon.tech.id/db").jenis).toBe("postgres");
  });

  it("membuang spasi berlebih di sekitar connection string", () => {
    const mode = tentukanModeDb("  postgresql://a:b@host/db  ");
    expect(mode).toEqual({ jenis: "postgres", connectionString: "postgresql://a:b@host/db" });
  });

  // Salah tempel adalah kesalahan yang paling mungkin terjadi. Lebih baik gagal
  // dengan pesan jelas daripada diam-diam membuat database lokal kosong.
  it("menolak nilai yang tidak dikenali dengan pesan yang menjelaskan", () => {
    expect(() => tentukanModeDb("mysql://a:b@host/db")).toThrow(/tidak dikenali/i);
    expect(() => tentukanModeDb("ep-abc.aws.neon.tech")).toThrow(/postgresql:\/\//);
  });
});
