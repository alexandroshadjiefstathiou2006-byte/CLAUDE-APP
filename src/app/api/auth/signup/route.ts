import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { SIGNUP_BONUS_CREDITS } from "@/lib/plans";
import { applyCredits } from "@/server/billing/credits";
import { errorResponse } from "@/server/auth";

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  brandName: z.string().trim().min(1).max(80),
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    if (await db.user.findUnique({ where: { email: body.email } })) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(body.password, 10);
    const { user, workspace } = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: body.email, name: body.name, passwordHash } });
      const workspace = await tx.workspace.create({ data: { name: body.brandName } });
      await tx.membership.create({ data: { userId: user.id, workspaceId: workspace.id, role: "owner" } });
      await tx.brandKit.create({ data: { workspaceId: workspace.id, brandName: body.brandName } });
      await applyCredits(tx, { workspaceId: workspace.id, delta: SIGNUP_BONUS_CREDITS, reason: "signup_bonus" });
      return { user, workspace };
    });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, await signSession({ uid: user.id, wid: workspace.id }), sessionCookieOptions);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
