import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { errorResponse } from "@/server/auth";
import { ensureSeedData } from "@/server/seed-data";

const Body = z.object({ email: z.string().transform((e) => e.trim().toLowerCase()), password: z.string() });

export async function POST(req: Request) {
  try {
    await ensureSeedData(); // first run: creates the demo account + stock creators
    const body = Body.parse(await req.json());
    const user = await db.user.findUnique({ where: { email: body.email }, include: { memberships: true } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash)) || !user.memberships[0]) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, await signSession({ uid: user.id, wid: user.memberships[0].workspaceId }), sessionCookieOptions);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
