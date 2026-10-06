/**
 * Storage abstraction. Local disk for development; implement `S3Storage` (S3 / Cloudflare R2)
 * with the same interface for production and select it with STORAGE_DRIVER.
 */
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export interface StorageProvider {
  /** Store bytes and return a public URL the browser can load. */
  put(opts: { folder: string; data: Buffer; mimeType: string; ext?: string }): Promise<{ key: string; url: string }>;
  /** Read bytes back from a URL produced by `put` (used to send product images to AI providers). */
  read(url: string): Promise<{ data: Buffer; mimeType: string }>;
  delete(url: string): Promise<void>;
}

const ROOT = path.join(process.cwd(), "storage");
const PUBLIC_PREFIX = "/api/files/";

export const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
  "application/json": "json",
};

export function mimeFromPath(p: string) {
  const ext = path.extname(p).slice(1).toLowerCase();
  const found = Object.entries(MIME_EXT).find(([, e]) => e === ext || (ext === "jpeg" && e === "jpg"));
  return found?.[0] ?? "application/octet-stream";
}

class LocalStorage implements StorageProvider {
  async put({ folder, data, mimeType, ext }: { folder: string; data: Buffer; mimeType: string; ext?: string }) {
    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "");
    const key = `${safeFolder}/${crypto.randomUUID()}.${ext ?? MIME_EXT[mimeType] ?? "bin"}`;
    const full = path.join(ROOT, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { key, url: PUBLIC_PREFIX + key };
  }

  resolve(url: string) {
    if (!url.startsWith(PUBLIC_PREFIX)) throw new Error(`Not a local storage URL: ${url}`);
    const full = path.normalize(path.join(ROOT, url.slice(PUBLIC_PREFIX.length)));
    if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage path");
    return full;
  }

  async read(url: string) {
    if (/^https?:\/\//.test(url)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      return { data: Buffer.from(await res.arrayBuffer()), mimeType: res.headers.get("content-type") ?? "application/octet-stream" };
    }
    const full = this.resolve(url);
    return { data: await fs.readFile(full), mimeType: mimeFromPath(full) };
  }

  async delete(url: string) {
    try {
      await fs.unlink(this.resolve(url));
    } catch {
      /* already gone */
    }
  }
}

let instance: StorageProvider | null = null;

export function storage(): StorageProvider {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver !== "local") throw new Error(`Storage driver "${driver}" not implemented yet — add it in src/server/storage`);
  instance = new LocalStorage();
  return instance;
}

export const localStorageRoot = ROOT;

export async function toDataUri(url: string) {
  const { data, mimeType } = await storage().read(url);
  return `data:${mimeType};base64,${data.toString("base64")}`;
}
