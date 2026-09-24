"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";

// Print toolbar for the packing slip. With ?auto=1 the print dialog opens by itself.
export default function PrintButton({ auto = false, backHref }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [auto]);

  return (
    <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
      <Button variant="secondary" href={backHref}>← Back to order</Button>
      <Button onClick={() => window.print()}>Print</Button>
    </div>
  );
}
