"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { CreatorForm, type CreatorFormValues } from "@/components/creator-form";

export function NewCreatorForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(values: CreatorFormValues) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/creators", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      return setError(data.error === "Invalid request" ? "Please fill in name, appearance and hair." : (data.error ?? "Could not save creator"));
    }
    // Go straight to the identity studio and start generating candidates.
    router.push(`/app/creators/${data.creator.id}?generate=1`);
  }

  return (
    <Card className="p-6 sm:p-8">
      <CreatorForm submitLabel="Continue → Generate Creator" onSubmit={submit} busy={busy} error={error} />
    </Card>
  );
}
