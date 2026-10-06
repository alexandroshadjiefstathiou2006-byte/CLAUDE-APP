/** Load DB rows into the provider-facing context objects. */
import type { BrandKit, Creator, Product } from "@prisma/client";
import { parseJson } from "@/lib/json";
import type { BrandContext, CreatorContext, ProductAnalysis, ProductContext } from "@/server/ai/types";

export function toProductContext(p: Product): ProductContext {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    imageUrl: p.imageUrl,
    logoUrl: p.logoUrl,
    colors: parseJson<string[]>(p.colors, []),
    analysis: parseJson<ProductAnalysis | null>(p.analysis, null),
  };
}

export function toCreatorContext(c: Creator): CreatorContext {
  return {
    id: c.id,
    name: c.name,
    gender: c.gender,
    age: c.age,
    appearance: c.appearance,
    bodyType: c.bodyType,
    hair: c.hair,
    style: c.style,
    location: c.location,
    identityPrompt: c.identityPrompt,
    seed: c.seed,
    avatarUrl: c.avatarUrl,
    referenceImages: parseJson<string[]>(c.referenceImages, []),
    voiceId: c.voiceId,
  };
}

export function toBrandContext(b: BrandKit | null): BrandContext | null {
  if (!b) return null;
  return {
    brandName: b.brandName,
    colors: parseJson<string[]>(b.colors, []),
    fonts: b.fonts,
    toneOfVoice: b.toneOfVoice,
    targetCustomer: b.targetCustomer,
    logoUrl: b.logoUrl,
  };
}
