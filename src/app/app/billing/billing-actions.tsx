"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function PlanButton({ planId, current, highlighted, live }: { planId: string; current: boolean; highlighted?: boolean; live: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await fetch(live ? "/api/billing/checkout" : "/api/billing/dev-grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong");
    if (data.url) window.location.href = data.url;
    else router.refresh();
  }

  return (
    <div className="mt-7">
      <Button className="w-full" variant={highlighted ? "brand" : "secondary"} loading={busy} disabled={current && live} onClick={go}>
        {current ? (live ? "Current plan" : "Current plan · add credits (dev)") : `Choose ${planId[0].toUpperCase()}${planId.slice(1)}`}
      </Button>
      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
    </div>
  );
}

export function PortalButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/billing/portal", { method: "POST" });
        const data = await res.json();
        setBusy(false);
        if (data.url) window.location.href = data.url;
      }}
    >
      Manage subscription
    </Button>
  );
}
