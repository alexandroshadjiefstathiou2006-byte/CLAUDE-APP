import Link from "next/link";
import { Film, ImageIcon } from "lucide-react";
import { getPreset } from "@/lib/catalog";
import { Media } from "./ui";

export function ProductCard({ product, href }: { product: { id: string; name: string; imageUrl: string; analysisStatus: string; _count?: { creatives: number } }; href?: string }) {
  return (
    <Link href={href ?? `/app/products/${product.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-white shadow-card transition group-hover:shadow-lift">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-6 transition duration-500 group-hover:scale-[1.04]" />
        {product.analysisStatus === "pending" && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-ink-3 shadow-sm">Analyzing…</span>
        )}
      </div>
      <div className="mt-3 px-1">
        <div className="truncate text-[14px] font-semibold">{product.name}</div>
        {product._count && <div className="text-[13px] text-ink-4">{product._count.creatives} creatives</div>}
      </div>
    </Link>
  );
}

export function CreativeThumb({ creative }: { creative: { id: string; title: string; kind: string; preset: string; mediaUrl: string; thumbnailUrl: string | null; mimeType: string; durationSec?: number | null } }) {
  const preset = getPreset(creative.preset);
  return (
    <Link href={`/app/library?open=${creative.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-zinc-100 shadow-card transition group-hover:shadow-lift">
        <Media url={creative.mediaUrl} mimeType={creative.mimeType} poster={creative.thumbnailUrl} alt={creative.title} className="h-full w-full object-cover" />
        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
          {creative.kind === "video" ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
          {preset?.label ?? creative.kind}
          {creative.durationSec ? ` · ${creative.durationSec}s` : ""}
        </span>
      </div>
      <div className="mt-2.5 line-clamp-1 px-1 text-[13px] font-medium text-ink-2">{creative.title}</div>
    </Link>
  );
}
