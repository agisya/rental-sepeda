"use client";

import { Button } from "@/components/ui/button";
import { Ikon } from "@/components/ui/icons";

export function TombolCetak() {
  return (
    <Button onClick={() => window.print()} className="flex-1" ikon={Ikon.cetak}>
      Cetak
    </Button>
  );
}
