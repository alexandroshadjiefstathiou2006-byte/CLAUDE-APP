"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid, Package, Users, Sparkles, Images, Palette, BarChart3, Settings, CreditCard, LogOut, Plus, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/app/products", label: "Products", icon: Package },
  { href: "/app/creators", label: "AI Creators", icon: Users },
  { href: "/app/create", label: "Create", icon: Sparkles },
  { href: "/app/library", label: "Creative Library", icon: Images },
  { href: "/app/brand", label: "Brand Kit", icon: Palette },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
];

export function Sidebar({ workspaceName, credits, plan, userName }: { workspaceName: string; credits: number; plan: string; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const content = (
    <div className="flex h-full flex-col">
      <Link href="/app" className="flex items-center gap-2.5 px-2 pb-6 pt-1" onClick={() => setOpen(false)}>
        <Logo />
        <span className="font-display text-[17px] font-bold tracking-tight">Studio</span>
      </Link>

      <Link
        href="/app/create"
        onClick={() => setOpen(false)}
        className="mb-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-semibold text-white shadow-sm transition hover:bg-ink-2"
      >
        <Plus className="h-4 w-4" /> Create Content
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition",
                active ? "bg-black/[.05] text-ink" : "text-ink-3 hover:bg-black/[.03] hover:text-ink",
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand" : "")} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 pt-6">
        <Link href="/app/billing" onClick={() => setOpen(false)} className="block rounded-xl border border-line bg-white p-3.5 transition hover:border-ink-4">
          <div className="flex items-center justify-between text-[12px] font-medium text-ink-3">
            <span>Credits</span>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 capitalize text-brand-700">{plan}</span>
          </div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums">{credits.toLocaleString()}</div>
        </Link>
        <div className="flex items-center justify-between rounded-xl px-2 py-1">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{workspaceName}</div>
            <div className="truncate text-[12px] text-ink-4">{userName}</div>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-ink-4 hover:bg-black/[.04] hover:text-ink" title="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/app" className="flex items-center gap-2"><Logo /><span className="font-display font-bold">Studio</span></Link>
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-black/[.04]" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      </div>
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-line bg-canvas px-4 py-5 lg:block">{content}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[272px] bg-canvas px-4 py-5 shadow-lift animate-fadein">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 hover:bg-black/[.04]" aria-label="Close menu"><X className="h-5 w-5" /></button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center justify-center rounded-[9px] bg-gradient-to-br from-brand to-fuchsia-500 text-white shadow-sm" style={{ width: size, height: size }}>
      <Sparkles className="h-[55%] w-[55%]" strokeWidth={2.2} />
    </span>
  );
}
