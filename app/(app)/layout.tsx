import { wajibPengguna } from "@/lib/auth/dal";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { Topbar } from "@/components/nav/topbar";
import { PusatNotifikasi } from "@/components/notifikasi/pusat-notifikasi";

export default async function LayoutAplikasi({
  children,
}: {
  children: React.ReactNode;
}) {
  // Penjagaan sesungguhnya. proxy.ts hanya mengalihkan secara optimistik;
  // pemeriksaan ini yang benar-benar memuat pengguna dari database.
  const pengguna = await wajibPengguna();

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar peran={pengguna.peran} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar pengguna={pengguna} />

        {/* pb-24 di layar kecil menghindari bilah navigasi bawah menutupi isi. */}
        <main className="flex-1 px-4 pb-24 pt-5 lg:pb-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      <BottomNav />

      {/* Ditaruh di layout, bukan di tiap halaman: layar konter bisa sedang
          terbuka di mana saja, dan sepeda yang telat tidak menunggu petugas
          kebetulan membuka dashboard. */}
      <PusatNotifikasi />
    </div>
  );
}
