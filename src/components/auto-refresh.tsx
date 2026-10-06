"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-render the server component every `ms` while mounted (used while background work finishes). */
export function AutoRefresh({ ms = 3000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/generations?active=1").catch(() => {}); // make sure the dev worker is awake
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [ms, router]);
  return null;
}
