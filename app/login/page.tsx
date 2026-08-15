import type { Metadata } from "next";
import { Bike } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

export default async function HalamanLogin(props: PageProps<"/login">) {
  const { lanjut } = await props.searchParams;
  const tujuan = typeof lanjut === "string" && lanjut.startsWith("/") ? lanjut : undefined;

  return (
    <main className="flex min-h-dvh flex-col justify-center bg-bg px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <span
            className="mx-auto mb-4 flex size-14 items-center justify-center rounded-panel bg-brand text-brand-ink"
            aria-hidden="true"
          >
            <Bike className="size-7" strokeWidth={1.9} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Rental Sepeda Garut
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Masuk untuk mulai mencatat rental hari ini
          </p>
        </div>

        <div className="rounded-card border border-line bg-surface p-5">
          <LoginForm lanjut={tujuan} />
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Lupa kata sandi? Hubungi admin rental.
        </p>
      </div>
    </main>
  );
}
