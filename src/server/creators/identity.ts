/**
 * Creator identity system.
 *
 * A creator is a FICTIONAL AI-generated person with:
 *  - a persistent identity id (`identityId`, e.g. "idn_8f3k…") that never changes
 *  - a master identity reference (the portrait the brand selected)
 *  - an identity pack: front / three_quarter / side / smiling / neutral
 *
 * Every later generation featuring the creator passes these references to the image provider
 * (see loadIdentityReferences) so the same face/body appears across products, poses and places.
 */
import crypto from "crypto";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { IDENTITY_PACK_KINDS, type IdentityReference, type IdentityReferenceKind } from "@/server/ai/types";
import { isRaster, toProviderImage } from "@/server/ai/media";
import { renderAvatarSvg, type HairColor, type HairLength } from "@/server/render/svg";
import { storage } from "@/server/storage";

export const CANDIDATE_COUNT = 4;
export { IDENTITY_PACK_KINDS };

export const PACK_LABELS: Record<string, string> = {
  master: "Master",
  front: "Front",
  three_quarter: "3/4 angle",
  side: "Side",
  smiling: "Smiling",
  neutral: "Neutral",
};

/** Order in which identity references are sent to providers (most informative first). */
const REFERENCE_PRIORITY: IdentityReferenceKind[] = ["master", "front", "three_quarter", "smiling", "neutral", "side"];

export function newIdentityId() {
  return `idn_${crypto.randomBytes(9).toString("base64url").toLowerCase()}`;
}

/* ── Fictional-only guard ──────────────────────────────────────── */

const LOOKALIKE = /\b(look(s|ing)?\s*like|lookalike|look-alike|resembl\w*|celebrity|famous|twin of|doppelg[aä]nger|deepfake|clone of)\b/i;

/**
 * Creators must be fictional. We reject descriptions that ask to imitate a real/known person.
 * (Prompts also instruct providers that the person is fictional.)
 */
export function fictionalViolation(fields: Record<string, string | undefined>): string | null {
  for (const [key, value] of Object.entries(fields)) {
    if (value && LOOKALIKE.test(value)) {
      return `AI creators must be fictional — please describe the person's features instead of comparing them to a real person (field: ${key}).`;
    }
  }
  return null;
}

/* ── Identity text ─────────────────────────────────────────────── */

export function buildIdentityText(c: { name: string; gender: string; appearance: string; hair: string; eyes?: string; bodyType: string }) {
  const who = c.gender === "female" ? "a woman" : c.gender === "male" ? "a man" : "a person";
  return `${c.name}: ${who}, ${c.appearance}, ${c.hair} hair${c.eyes ? `, ${c.eyes} eyes` : ""}, ${c.bodyType} build`;
}

/* ── Mock portraits (used when no image API is configured) ─────── */

const BG_PAIRS: [string, string][] = [
  ["#F4E9E1", "#E6CFC0"],
  ["#EDE7F8", "#D3C6F2"],
  ["#EEF1F4", "#D5DCE4"],
  ["#EAF4EE", "#CFE6D6"],
  ["#FBEFF3", "#F2D3DE"],
  ["#F5EFE3", "#E6D6B6"],
];

function mockTraits(c: { appearance: string; hair: string }, variant: number) {
  const a = c.appearance.toLowerCase();
  const baseSkin = /deep|dark/.test(a) ? 5 : /brown/.test(a) ? 3 : /tan|olive|latin/.test(a) ? 2 : /light|fair|pale/.test(a) ? 0 : 1;
  const colors: HairColor[] = ["black", "brown", "blonde", "red", "grey", "auburn"];
  const hairColor = colors.find((h) => c.hair.toLowerCase().includes(h)) ?? (["brown", "black", "auburn", "blonde"][variant % 4] as HairColor);
  const hairLength: HairLength = /curl/i.test(c.hair) ? "curly" : /long/i.test(c.hair) ? "long" : /buzz|fade|shaved/i.test(c.hair) ? "buzz" : /short/i.test(c.hair) ? "short" : (["medium", "long", "short", "medium"][variant % 4] as HairLength);
  // candidates differ slightly so the brand has a real choice
  const skinIndex = Math.max(0, Math.min(5, baseSkin + [0, 1, 0, -1][variant % 4]));
  return { skinIndex, hairColor, hairLength };
}

const PACK_POSE: Record<string, { turn: number; expression: "smile" | "neutral" | "soft" }> = {
  master: { turn: 0, expression: "soft" },
  front: { turn: 0, expression: "soft" },
  three_quarter: { turn: -0.55, expression: "soft" },
  side: { turn: -1, expression: "neutral" },
  smiling: { turn: 0, expression: "smile" },
  neutral: { turn: 0, expression: "neutral" },
};

/** Illustrated preview portrait — clearly not a photo; replaced by real portraits once an image API is set. */
export function renderMockPortrait(
  c: { name: string; appearance: string; hair: string; eyes?: string },
  opts: { kind: string; variant: number },
) {
  const t = mockTraits(c, opts.variant);
  const pose = PACK_POSE[opts.kind] ?? { turn: 0, expression: "soft" as const };
  return renderAvatarSvg({
    name: c.name,
    ...t,
    eyeColor: c.eyes,
    bg: BG_PAIRS[opts.variant % BG_PAIRS.length],
    outfit: "#2E2E38",
    turn: pose.turn,
    expression: pose.expression,
    label: opts.kind === "candidate" ? `Option ${opts.variant + 1} · preview` : `${PACK_LABELS[opts.kind] ?? opts.kind} · preview`,
  });
}

/* ── Loading references for generation ─────────────────────────── */

/**
 * Identity references to send with a generation, most informative first.
 * Only raster images are returned (illustrated SVG previews are not useful to AI models).
 */
export async function loadIdentityReferences(creatorId: string, max = 3): Promise<IdentityReference[]> {
  const rows = await db.creatorReference.findMany({
    where: { creatorId, active: true, kind: { in: REFERENCE_PRIORITY } },
    orderBy: { createdAt: "desc" },
  });
  rows.sort((a, b) => REFERENCE_PRIORITY.indexOf(a.kind as IdentityReferenceKind) - REFERENCE_PRIORITY.indexOf(b.kind as IdentityReferenceKind));
  const out: IdentityReference[] = [];
  for (const row of rows) {
    if (out.length >= max) break;
    if (!isRaster(row.mimeType) || out.some((r) => r.kind === row.kind)) continue;
    try {
      const img = await toProviderImage(await storage().read(row.url), 1024);
      out.push({ kind: row.kind as IdentityReferenceKind, ...img });
    } catch {
      /* missing file — skip */
    }
  }
  if (out.length) return out;

  // legacy: stock creators store reference URLs in Creator.referenceImages
  const creator = await db.creator.findUnique({ where: { id: creatorId }, select: { referenceImages: true } });
  for (const url of parseJson<string[]>(creator?.referenceImages, [])) {
    try {
      const img = await storage().read(url);
      if (isRaster(img.mimeType)) return [{ kind: "master", ...(await toProviderImage(img, 1024)) }];
    } catch {
      /* skip */
    }
  }
  return [];
}

/** The master reference image (any format) — used to condition identity-pack generation. */
export async function masterReference(creatorId: string) {
  return db.creatorReference.findFirst({ where: { creatorId, kind: "master", active: true }, orderBy: { createdAt: "desc" } });
}

export function storageFolder(creator: { workspaceId: string | null; identityId: string | null; id: string }) {
  const idn = creator.identityId ?? creator.id;
  return creator.workspaceId ? `ws/${creator.workspaceId}/creators/${idn}` : `creators/${idn}`;
}
