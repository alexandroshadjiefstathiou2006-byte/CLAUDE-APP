import { z } from "zod/v4";
import { db } from "@/lib/db";
import { toJson } from "@/lib/json";
import { apiHandler } from "@/server/auth";
import { assertOwnFile, HEX } from "@/server/validation";

const Body = z.object({
  brandName: z.string().trim().max(80),
  logoUrl: z.string().nullable().optional(),
  colors: z.array(z.string().regex(HEX)).max(8),
  fonts: z.string().trim().max(120),
  toneOfVoice: z.string().trim().max(500),
  targetCustomer: z.string().trim().max(500),
  categories: z.array(z.string().trim().max(40)).max(12),
  preferredStyles: z.array(z.string()).max(20),
  preferredCreatorIds: z.array(z.string()).max(20),
});

export const GET = apiHandler(async (ctx) => ({ brandKit: await db.brandKit.findUnique({ where: { workspaceId: ctx.workspace.id } }) }));

export const PUT = apiHandler(async (ctx, req: Request) => {
  const b = Body.parse(await req.json());
  assertOwnFile(b.logoUrl, ctx.workspace.id);
  const data = {
    brandName: b.brandName,
    logoUrl: b.logoUrl ?? null,
    colors: toJson(b.colors),
    fonts: b.fonts,
    toneOfVoice: b.toneOfVoice,
    targetCustomer: b.targetCustomer,
    categories: toJson(b.categories),
    preferredStyles: toJson(b.preferredStyles),
    preferredCreatorIds: toJson(b.preferredCreatorIds),
  };
  const brandKit = await db.brandKit.upsert({ where: { workspaceId: ctx.workspace.id }, create: { workspaceId: ctx.workspace.id, ...data }, update: data });
  if (b.brandName) await db.workspace.update({ where: { id: ctx.workspace.id }, data: { name: b.brandName } });
  return { brandKit };
});
