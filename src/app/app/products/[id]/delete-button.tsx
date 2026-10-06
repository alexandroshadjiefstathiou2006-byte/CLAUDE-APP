"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";

export function DeleteProductButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="lg"
      loading={busy}
      onClick={async () => {
        if (!confirm("Delete this product? Its creatives stay in your library.")) return;
        setBusy(true);
        await fetch(`/api/products/${id}`, { method: "DELETE" });
        router.push("/app/products");
        router.refresh();
      }}
    >
      <Trash2 className="h-4 w-4" /> Delete
    </Button>
  );
}
