import { Ikon } from "@/components/ui/icons";
import { LambangMerek } from "@/components/ui/merek";

/**
 * Tiruan layar dashboard untuk hero landing page.
 *
 * Digambar dari div memakai token warna yang sama dengan aplikasinya, bukan
 * tangkapan layar. Tiga alasannya: tetap tajam di layar HP mana pun, ikut berubah
 * saat tema gelap dinyalakan, dan tidak diam-diam basi ketika tampilan aplikasi
 * berubah — yang berubah paling banter jarak antar kotak, bukan isi yang keliru.
 *
 * Seluruhnya aria-hidden. Angkanya karangan, dan pembaca layar yang membacakan
 * "Rp 840.000" seolah data sungguhan justru menyesatkan. Keterangan di bawahnya
 * yang bisa dibaca, dan itu memang menyebut dirinya ilustrasi.
 */

const STATISTIK = [
  { label: "Tersedia", nilai: "12" },
  { label: "Disewa", nilai: "3" },
  { label: "Omzet hari ini", nilai: "Rp 840rb" },
];

const BERJALAN = [
  { kode: "SPD-004", penyewa: "Budi Santoso", durasi: "1j 20m" },
  { kode: "SPD-011", penyewa: "Rina Amelia", durasi: "45m" },
  { kode: "SPD-002", penyewa: "Dedi Kurnia", durasi: "2j 05m" },
];

export function MockupDashboard() {
  return (
    <figure className="m-0">
      {/* Tanpa bayangan: bingkai tipis sudah memisahkannya dari halaman, dan
          bayangan hanya dipakai untuk yang sungguh melayang di atas isi. */}
      <div
        className="overflow-hidden rounded-panel border border-line bg-surface"
        aria-hidden="true"
      >
        {/* Kepala aplikasi */}
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <LambangMerek ukuran="sm" />
          <span className="text-sm font-semibold tracking-tight text-ink">Dashboard</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-control bg-brand px-2 py-1 text-[0.6875rem] font-medium text-brand-ink">
            <Ikon.scan className="size-3.5" strokeWidth={2} />
            Scan QR
          </span>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-3 gap-2.5">
            {STATISTIK.map((s) => (
              <div key={s.label} className="rounded-control bg-surface-2 px-3 py-2.5">
                <p className="text-[0.6875rem] leading-tight text-ink-muted">{s.label}</p>
                <p className="mt-1 font-display text-base font-semibold tracking-tight tabular-nums text-ink">
                  {s.nilai}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-card border border-line">
            <p className="border-b border-line px-3 py-2 text-xs font-semibold text-ink">
              Rental berjalan
            </p>
            <ul className="divide-y divide-line">
              {BERJALAN.map((r) => (
                <li key={r.kode} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="rounded-control bg-surface-2 px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-muted">
                    {r.kode}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">
                    {r.penyewa}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[0.6875rem] tabular-nums text-ink-muted">
                    <Ikon.jam className="size-3" strokeWidth={2} />
                    {r.durasi}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 text-center text-xs text-ink-faint">
        Ilustrasi tampilan aplikasi. Nama dan angkanya contoh.
      </figcaption>
    </figure>
  );
}
