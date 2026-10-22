import { namaAkunDemo } from "@/lib/auth/demo";
import { ButtonLink } from "@/components/ui/button";
import { Ikon, type NamaIkon } from "@/components/ui/icons";
import { Merek } from "@/components/ui/merek";
import { DemoButton } from "@/components/auth/demo-button";
import { NavDepan } from "@/components/landing/nav-depan";
import { MockupDashboard } from "@/components/landing/mockup-dashboard";

/**
 * Halaman publik di `/`. Aplikasinya sendiri tetap berada di belakang login.
 *
 * Sengaja tidak menyentuh database sama sekali. Ini halaman pertama yang dilihat
 * orang, dan koneksi database bisa putus karena internet mati di lokasi rental —
 * kalau isinya bergantung pada query, kejadian itu menyulap halaman jualan menjadi
 * layar galat. `namaAkunDemo()` hanya membaca variabel lingkungan, jadi satu-satunya
 * cara halaman ini gagal adalah kalau servernya sendiri mati.
 *
 * Keadaan "belum ada akun sama sekali" tidak diurus di sini. Itu perlu query, dan
 * /login sudah menanganinya dengan benar; orang yang menekan Masuk akan sampai ke
 * sana dan langsung ditawari membuat akun pertama.
 *
 * Isinya tidak menyebut paket, harga, maupun langganan. Bukan karena belum sempat:
 * aplikasi ini satu tenant dan tidak punya kode langganan sama sekali, jadi halaman
 * yang memajangnya akan menjanjikan sesuatu yang tidak ada. Setiap kemampuan yang
 * disebut di bawah ini punya menunya sendiri di dalam aplikasi.
 */

const FITUR = [
  {
    ikon: "scan",
    judul: "Scan QR, rental langsung jalan",
    teks: "Tiap barang punya stiker QR. Petugas mengarahkan kamera HP, menekan mulai, dan waktunya tercatat — tanpa mengetik nama barang.",
  },
  {
    ikon: "jam",
    judul: "Per jam atau per hari",
    teks: "Satuan sewa melekat pada kategori barangnya. Sepeda dihitung per jam, mobil per hari, dan denda keterlambatan mengikuti satuan yang sama.",
  },
  {
    ikon: "uang",
    judul: "Bagi hasil pemilik dihitung sendiri",
    teks: "Barang titipan pemilik lain punya porsi bagi hasilnya masing-masing. Setiap transaksi selesai langsung menambah jatah pemiliknya.",
  },
  {
    ikon: "booking",
    judul: "Booking dengan slot waktu",
    teks: "Penyewa bisa memesan lebih dulu. Slot yang bentrok ditolak sejak formulirnya, jadi satu barang tidak pernah dijanjikan ke dua orang.",
  },
  {
    ikon: "laporan",
    judul: "Laporan harian sampai bulanan",
    teks: "Omzet, jumlah transaksi, barang paling laku, dan jatah tiap pemilik. Semuanya sudah terhitung, tinggal dibuka dan dicetak.",
  },
  {
    ikon: "servis",
    judul: "Maintenance dan tutup toko",
    teks: "Barang yang masuk servis otomatis tidak bisa disewakan. Di akhir hari, setoran dan pengeluaran dirangkum jadi satu catatan kas.",
  },
] as const satisfies readonly { ikon: NamaIkon; judul: string; teks: string }[];

const LANGKAH = [
  {
    judul: "Scan waktu barang keluar",
    teks: "Petugas membuka menu Scan, mengarahkan kamera ke stiker QR, lalu menekan START RENTAL. Jam mulainya tercatat saat itu juga.",
  },
  {
    judul: "Scan lagi waktu barang kembali",
    teks: "Durasi, tarif, dan denda keterlambatan dihitung otomatis menurut satuan kategorinya. Petugas tidak menghitung apa pun di kepala.",
  },
  {
    judul: "Tutup toko di akhir hari",
    teks: "Setoran, pengeluaran, dan jatah bagi hasil pemilik dirangkum jadi laporan harian yang siap dicocokkan dengan uang di laci.",
  },
];

const KEUNGGULAN = ["Per jam atau per hari", "Bagi hasil otomatis", "Dipakai dari HP"];

/**
 * Judul bagian. Rata kiri dan tanpa pil di atasnya: setiap bagian sudah
 * dipisahkan garis tipis, jadi label kecil berwarna di atas judul hanya
 * mengulang hal yang sama dengan suara lebih keras.
 */
function JudulBagian({ judul, teks }: { judul: string; teks?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
        {judul}
      </h2>
      {teks && <p className="mt-3 text-base leading-relaxed text-ink-muted">{teks}</p>}
    </div>
  );
}

export default function HalamanDepan() {
  const adaAkunDemo = namaAkunDemo() !== null;

  return (
    <div className="min-h-dvh bg-bg">
      <NavDepan adaAkunDemo={adaAkunDemo} />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
                Rental tercatat rapi,
                <br />
                <span className="text-brand">uangnya ketahuan.</span>
              </h1>

              <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-muted sm:text-lg">
                Scan QR saat barang keluar, scan lagi saat kembali. Durasi, denda
                keterlambatan, dan bagi hasil pemilik dihitung sendiri — laporan
                hariannya sudah siap waktu tutup toko.
              </p>

              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2.5">
                {KEUNGGULAN.map((k) => (
                  <li key={k} className="flex items-center gap-2 text-sm text-ink-muted">
                    <Ikon.selesai
                      className="size-4 shrink-0 text-brand"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    {k}
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-start">
                {adaAkunDemo ? (
                  <>
                    <DemoButton ukuran="lg" penuh={false} variasi="utama" />
                    <ButtonLink href="/login" variasi="kedua" ukuran="lg">
                      Masuk
                    </ButtonLink>
                  </>
                ) : (
                  <ButtonLink href="/login" ukuran="lg">
                    Masuk
                  </ButtonLink>
                )}
              </div>

              {adaAkunDemo && (
                <p className="mt-4 max-w-md text-xs leading-relaxed text-ink-faint">
                  Demo masuk sebagai kasir dengan data contoh, tanpa mendaftar. Bisa
                  mencatat rental dan membuka laporan; menghapus data dan menu keuangan
                  tertutup.
                </p>
              )}
            </div>

            <MockupDashboard />
          </div>
        </section>

        {/* Fitur */}
        <section id="fitur" className="scroll-mt-20 border-t border-line py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <JudulBagian
              judul="Semua yang dibutuhkan satu hari kerja rental"
              teks="Bukan daftar keinginan. Tiap butir di bawah ini punya menunya sendiri di dalam aplikasi dan sudah dipakai mencatat transaksi sungguhan."
            />

            {/* Tanpa kartu: garis tipis di atas tiap butir sudah cukup
                memisahkan, dan enam kotak berbingkai berjajar terbaca sebagai
                templat, bukan sebagai isi. */}
            <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FITUR.map((f) => {
                const IkonFitur = Ikon[f.ikon];
                return (
                  <li key={f.judul} className="border-t border-line pt-6">
                    <IkonFitur
                      className="size-5 text-brand"
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                    <h3 className="mt-4 text-base font-semibold tracking-tight text-ink">
                      {f.judul}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.teks}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Cara kerja */}
        <section id="cara-kerja" className="scroll-mt-20 border-t border-line py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <JudulBagian judul="Tiga langkah, selesai" />

            <ol className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-3">
              {LANGKAH.map((l, i) => (
                <li key={l.judul} className="border-t border-line pt-6">
                  <span className="font-mono text-sm text-ink-faint" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-base font-semibold tracking-tight text-ink">
                    {l.judul}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{l.teks}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Penutup */}
        <section className="border-t border-line py-16 sm:py-24">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
              Lihat sendiri isinya
            </h2>
            <p className="mt-3 text-base leading-relaxed text-ink-muted">
              {adaAkunDemo
                ? "Masuk ke demo dengan data contoh beberapa minggu terakhir — seluruh laporannya sudah berisi angka."
                : "Masuk dengan akun yang diberikan admin rental."}
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:items-start">
              {adaAkunDemo ? (
                <>
                  <DemoButton ukuran="lg" penuh={false} variasi="utama" />
                  <ButtonLink href="/login" variasi="kedua" ukuran="lg">
                    Masuk
                  </ButtonLink>
                </>
              ) : (
                <ButtonLink href="/login" ukuran="lg">
                  Masuk
                </ButtonLink>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Merek />
          <p className="text-xs text-ink-faint">
            Pencatatan rental per jam atau per hari, bagi hasil pemilik, dan laporan
            harian.
          </p>
        </div>
      </footer>
    </div>
  );
}
