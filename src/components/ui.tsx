import Link from "next/link";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "brand" | "danger";
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-ink-2 shadow-sm",
  brand: "bg-brand text-white hover:bg-brand-600 shadow-sm shadow-brand/20",
  secondary: "bg-white text-ink border border-line hover:border-ink-4",
  ghost: "text-ink-2 hover:bg-black/[.04]",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
};
const SIZES = { sm: "h-8 px-3 text-[13px] rounded-lg gap-1.5", md: "h-10 px-4 text-sm rounded-xl gap-2", lg: "h-12 px-6 text-[15px] rounded-xl gap-2" };

export function buttonClass(variant: ButtonVariant = "primary", size: keyof typeof SIZES = "md", className?: string) {
  return cn("inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap", VARIANTS[variant], SIZES[size], className);
}

export function Button({
  variant = "primary", size = "md", loading, className, children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: keyof typeof SIZES; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = "primary", size = "md", className, children }: { href: string; variant?: ButtonVariant; size?: keyof typeof SIZES; className?: string; children: React.ReactNode }) {
  return <Link href={href} className={buttonClass(variant, size, className)}>{children}</Link>;
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-2xl border border-line bg-white shadow-card", className)}>{children}</div>;
}

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "brand" | "green" | "amber" | "red"; className?: string }) {
  const tones = {
    neutral: "bg-black/[.05] text-ink-2",
    brand: "bg-brand-50 text-brand-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium", tones[tone], className)}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand">{icon}</div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-3">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Renders a creative's media: <video> for mp4, <img> for images & animated SVG previews. */
export function Media({ url, mimeType, alt, className, controls }: { url: string; mimeType: string; alt: string; className?: string; controls?: boolean }) {
  if (mimeType.startsWith("video/")) {
    return <video src={url} className={className} muted loop playsInline autoPlay controls={controls} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
