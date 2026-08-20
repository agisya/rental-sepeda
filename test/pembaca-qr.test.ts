import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  QRCodeReader,
  ReaderException,
  RGBLuminanceSource,
} from "@zxing/library";

/**
 * Kenapa pemindai kamera memakai pembaca QR langsung, bukan pembaca
 * multi-format.
 *
 * Hampir semua bingkai kamera tidak berisi QR — itu keadaan normal, bukan
 * galat. Pembaca melempar NotFoundException untuk menyatakannya, dan
 * MultiFormatReader seharusnya menelan lemparan itu diam-diam. Ia tidak:
 * pemeriksaannya memakai `ex instanceof ReaderException`, sedangkan di pustaka
 * versi ini NotFoundException tidak mewarisi ReaderException sama sekali.
 * Akibatnya setiap bingkai kosong dicatat lewat console.warn — sekitar tujuh
 * kali sedetik selama kamera terbuka, membanjiri konsol sampai galat yang
 * sungguhan tidak terlihat lagi.
 *
 * Uji ini memakukan sebabnya, bukan hanya gejalanya. Kalau suatu saat pustaka
 * diperbarui dan sifatnya berubah, uji ini gagal dan pilihan pembaca layak
 * ditinjau ulang.
 */

const PUTIH = 0xff;

/** Bingkai putih polos: kamera yang menyorot dinding, bukan stiker. */
function bingkaiKosong(): BinaryBitmap {
  const sisi = 200;
  const data = new Uint8ClampedArray(sisi * sisi).fill(PUTIH);

  return new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(data, sisi, sisi)));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sebab kebisingan konsol", () => {
  it("NotFoundException tidak mewarisi ReaderException di pustaka ini", () => {
    // Inilah salah paham yang membuat MultiFormatReader menganggap keadaan
    // normal sebagai galat tak terduga.
    expect(new NotFoundException() instanceof ReaderException).toBe(false);
  });

  it("pembaca multi-format mencatat peringatan untuk bingkai tanpa QR", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const alat = new MultiFormatReader();
    alat.setHints(
      new Map<DecodeHintType, unknown>([
        [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]],
        [DecodeHintType.TRY_HARDER, true],
      ]),
    );

    expect(() => alat.decodeWithState(bingkaiKosong())).toThrow(NotFoundException);
    expect(warn).toHaveBeenCalled();
  });
});

describe("pembaca yang dipakai pemindai kamera", () => {
  /*
    QRCodeReader adalah yang dibungkus BrowserQRCodeReader di camera-scanner.
    Pembungkus versi peramban tidak bisa diuji di sini karena menuntut kanvas
    DOM, tapi jalur lemparannya sama persis: BrowserCodeReader.decodeBitmap
    memanggil reader.decode() langsung, tanpa perantara MultiFormatReader.
  */
  it("melempar NotFoundException tanpa mencatat apa pun", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const petunjuk = new Map<DecodeHintType, unknown>([[DecodeHintType.TRY_HARDER, true]]);

    expect(() => new QRCodeReader().decode(bingkaiKosong(), petunjuk)).toThrow(
      NotFoundException,
    );
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
