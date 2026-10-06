import Link from "next/link";
import { Logo } from "@/components/sidebar";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="flex items-center gap-2"><Logo /><span className="font-display text-lg font-bold">Studio</span></Link>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-brand/60 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fuchsia-500/40 blur-3xl" />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <p className="font-display text-4xl font-bold leading-tight tracking-tight">“We replaced a $4k monthly UGC budget with one afternoon in Studio.”</p>
          <p className="mt-4 text-white/60">— the kind of quote we want you to write us</p>
        </div>
      </div>
    </div>
  );
}
