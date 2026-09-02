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
