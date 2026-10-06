import { HttpError } from "@/server/auth";

/** Only accept file URLs that belong to the caller's workspace (prevents referencing other tenants' files). */
export function assertOwnFile(url: string | null | undefined, workspaceId: string) {
  if (!url) return;
  if (!url.startsWith(`/api/files/ws/${workspaceId}/`)) throw new HttpError(400, "Invalid file reference");
}

export const HEX = /^#[0-9a-fA-F]{6}$/;
