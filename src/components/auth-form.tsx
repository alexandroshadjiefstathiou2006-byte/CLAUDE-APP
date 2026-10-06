"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ name: "", brandName: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error === "Invalid request" ? "Please check your details (password must be 8+ characters)." : data.error ?? "Something went wrong");
    }
    const next = params.get("next");
    router.push(next?.startsWith("/app") ? next : mode === "signup" ? "/app/products/new" : "/app");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{mode === "login" ? "Welcome back" : "Create your studio"}</h1>
        <p className="mt-2 text-ink-3">{mode === "login" ? "Log in to keep creating." : "Start with 20 free credits. No card required."}</p>
      </div>
      {mode === "signup" && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Your name</label><input className="input" required value={form.name} onChange={set("name")} /></div>
          <div><label className="label">Brand name</label><input className="input" required value={form.brandName} onChange={set("brandName")} /></div>
        </div>
      )}
      <div><label className="label">Email</label><input className="input" type="email" required autoComplete="email" value={form.email} onChange={set("email")} /></div>
      <div><label className="label">Password</label><input className="input" type="password" required minLength={mode === "signup" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={set("password")} /></div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" variant="brand" size="lg" className="w-full" loading={busy}>{mode === "login" ? "Log in" : "Create account"}</Button>
      <p className="text-center text-sm text-ink-3">
        {mode === "login" ? <>New to Studio? <Link href="/signup" className="font-semibold text-ink hover:underline">Create an account</Link></> : <>Already have an account? <Link href="/login" className="font-semibold text-ink hover:underline">Log in</Link></>}
      </p>
      {mode === "login" && process.env.NODE_ENV !== "production" && (
        <p className="rounded-lg bg-canvas px-3 py-2 text-center text-[13px] text-ink-4">Demo: demo@studio.dev / demo1234</p>
      )}
    </form>
  );
}
