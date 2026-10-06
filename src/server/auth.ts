import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function getSession() {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Resolve the signed-in user + their workspace, or null. */
export async function getCurrentContext() {
  const session = await getSession();
  if (!session) return null;
  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: session.uid, workspaceId: session.wid } },
    include: { user: true, workspace: true },
  });
  if (!membership) return null;
  return { user: membership.user, workspace: membership.workspace, role: membership.role };
}

export type AppContext = NonNullable<Awaited<ReturnType<typeof getCurrentContext>>>;

/** For server components / pages. */
export async function requireContext(): Promise<AppContext> {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");
  return ctx;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wrap an API route handler: resolves auth context and converts errors to JSON responses. */
export function apiHandler<A extends unknown[]>(
  fn: (ctx: AppContext, ...args: A) => Promise<Response | unknown>,
) {
  return async (...args: A) => {
    try {
      const ctx = await getCurrentContext();
      if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const result = await fn(ctx, ...args);
      return result instanceof Response ? result : NextResponse.json(result);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err && typeof err === "object" && "issues" in err) {
    return NextResponse.json({ error: "Invalid request", details: (err as { issues: unknown }).issues }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
