import { apiHandler, HttpError } from "@/server/auth";
import { storage } from "@/server/storage";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 15 * 1024 * 1024;

export const POST = apiHandler(async (ctx, req: Request) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file uploaded");
  if (!ALLOWED.includes(file.type)) throw new HttpError(400, "Please upload a PNG, JPG or WebP image");
  if (file.size > MAX_BYTES) throw new HttpError(400, "Image must be under 15 MB");
  const { url } = await storage().put({
    folder: `ws/${ctx.workspace.id}/uploads`,
    data: Buffer.from(await file.arrayBuffer()),
    mimeType: file.type,
  });
  return { url };
});
