"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Store } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { ColorInput, ImageDrop } from "@/components/uploader";

const CATEGORIES = ["apparel", "outerwear", "footwear", "accessories", "activewear", "swimwear", "bags", "jewelry"];

export function ProductForm() {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [category, setCategory] = useState("apparel");
  const [colors, setColors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent, thenCreate: boolean) {
    e.preventDefault();
    if (!imageUrl) return setError("Upload a product photo first");
    setSaving(true);
    setError(null);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, productUrl, category, imageUrl, logoUrl, colors }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Could not save product");
    router.push(thenCreate ? `/app/create?product=${data.product.id}` : `/app/products/${data.product.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={(e) => submit(e, true)} className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div>
        <ImageDrop value={imageUrl} onChange={setImageUrl} label="Drop your product photo" hint="PNG, JPG or WebP · flat lay, ghost mannequin or packshot works best" />
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-[13px] text-emerald-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Product accuracy first: we extract exact colors, logos, prints and materials and lock them into every generation.</p>
        </div>
      </div>

      <Card className="space-y-6 p-6 sm:p-8">
        <div>
          <label className="label" htmlFor="name">Product name</label>
          <input id="name" className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Black Logo Hoodie" />
        </div>
        <div>
          <label className="label" htmlFor="desc">Description</label>
          <textarea id="desc" className="input min-h-[110px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Material, fit, key features, who it's for…" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cat">Category</label>
            <select id="cat" className="input capitalize" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="url">Product URL <span className="text-ink-4">(optional)</span></label>
            <input id="url" type="url" className="input" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="https://yourstore.com/products/…" />
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <span className="label">Brand logo <span className="text-ink-4">(optional)</span></span>
            <ImageDrop compact value={logoUrl} onChange={setLogoUrl} label="Upload logo" />
          </div>
          <div>
            <span className="label">Brand colors <span className="text-ink-4">(optional)</span></span>
            <ColorInput colors={colors} onChange={setColors} />
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <span className="inline-flex items-center gap-2 text-[13px] text-ink-4"><Store className="h-4 w-4" /> Import from Shopify <Badge>Soon</Badge></span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" loading={saving} onClick={(e) => submit(e as unknown as React.FormEvent, false)}>Save product</Button>
            <Button type="submit" variant="brand" loading={saving}>Save & create content</Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
