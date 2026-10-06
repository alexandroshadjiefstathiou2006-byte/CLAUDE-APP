import { z } from "zod/v4";
import { HEX } from "@/server/validation";

export const ProductBody = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).default(""),
  category: z.string().trim().max(60).default("apparel"),
  productUrl: z.union([z.url(), z.literal("")]).optional(),
  imageUrl: z.string().min(1),
  logoUrl: z.string().optional().nullable(),
  colors: z.array(z.string().regex(HEX)).max(8).default([]),
});
