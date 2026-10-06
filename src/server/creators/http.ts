import { NextResponse } from "next/server";
import { InsufficientCreditsError } from "@/server/billing/credits";
import { CreatorError } from "./service";

/** Map creator-workflow errors to HTTP responses; rethrow anything else. */
export async function creatorResponse<T>(fn: () => Promise<T>, status = 200) {
  try {
    return NextResponse.json(await fn(), { status });
  } catch (err) {
    if (err instanceof CreatorError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: `Not enough credits: need ${err.needed}, you have ${err.available}`, needed: err.needed, available: err.available }, { status: 402 });
    }
    throw err;
  }
}
