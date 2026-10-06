import { z } from "zod/v4";
import { db } from "@/lib/db";
import { toJson } from "@/lib/json";
import { apiHandler } from "@/server/auth";
import { renderAvatarSvg } from "@/server/render/svg";
import { storage } from "@/server/storage";
import { assertOwnFile } from "@/server/validation";

export const GET = apiHandler(async (ctx) => {
  const creators = await db.creator.findMany({
    where: { OR: [{ workspaceId: null }, { workspaceId: ctx.workspace.id }] },
    orderBy: [{ isBrandCreator: "desc" }, { createdAt: "asc" }],
  });
  return { creators };
});

const Body = z.object({
  name: z.string().trim().min(1).max(40),
  gender: z.enum(["female", "male", "nonbinary"]),
  age: z.number().int().min(18).max(80),
  appearance: z.string().trim().min(1).max(200),
  bodyType: z.string().trim().max(40).default("average"),
  hair: z.string().trim().max(60).default("medium brown"),
  style: z.string().trim().max(40).default("casual"),
  location: z.string().trim().max(60).default(""),
  categories: z.array(z.string()).max(6).default([]),
  bio: z.string().max(300).default(""),
  referenceImageUrl: z.string().optional().nullable(),
});

const HAIR_COLORS = ["black", "brown", "blonde", "red", "grey", "auburn"] as const;

/** Create a reusable brand creator with a locked identity (prompt + seed + optional reference photo). */
export const POST = apiHandler(async (ctx, req: Request) => {
  const b = Body.parse(await req.json());
  assertOwnFile(b.referenceImageUrl, ctx.workspace.id);
  const seed = Math.floor(Math.random() * 1_000_000);
  const hairColor = HAIR_COLORS.find((c) => b.hair.toLowerCase().includes(c)) ?? "brown";
  const hairLength = /curl/i.test(b.hair) ? "curly" : /long/i.test(b.hair) ? "long" : /buzz|fade|shaved/i.test(b.hair) ? "buzz" : /short/i.test(b.hair) ? "short" : "medium";
  const skinIndex = /deep|dark/i.test(b.appearance) ? 5 : /brown/i.test(b.appearance) ? 3 : /tan|olive/i.test(b.appearance) ? 2 : 0;
  const avatarUrl =
    b.referenceImageUrl ||
    (
      await storage().put({
        folder: `ws/${ctx.workspace.id}/creators`,
        data: Buffer.from(renderAvatarSvg({ name: b.name, skinIndex, hairColor, hairLength, bg: ["#EFEDF7", "#DAD5F0"], outfit: "#2E2E38" })),
        mimeType: "image/svg+xml",
      })
    ).url;
  const creator = await db.creator.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: b.name,
      gender: b.gender,
      age: b.age,
      appearance: b.appearance,
      bodyType: b.bodyType,
      hair: b.hair,
      style: b.style,
      location: b.location,
      categories: toJson(b.categories),
      bio: b.bio,
      identityPrompt: `${b.name}: ${b.gender === "female" ? "a woman" : b.gender === "male" ? "a man" : "a person"}, ${b.appearance}, ${b.hair} hair, ${b.bodyType} build`,
      seed,
      avatarUrl,
      referenceImages: toJson(b.referenceImageUrl ? [b.referenceImageUrl] : []),
      isBrandCreator: true,
    },
  });
  return { creator };
});
