/**
 * Structured provider errors.
 * - `userMessage` is safe to show in the UI (no keys, no raw payloads).
 * - `detail` is logged server-side and stored on the job for debugging (never sent to the browser).
 * - `retryable` decides whether the worker retries or fails fast (and refunds) immediately.
 */
export type ProviderErrorCode =
  | "auth" // bad / missing API key
  | "network" // provider host unreachable / blocked by an egress proxy or firewall
  | "config" // provider not configured correctly (model name, env)
  | "content_policy" // request or output blocked by the provider's safety system
  | "invalid_request" // provider rejected our input
  | "rate_limit"
  | "quota" // out of credits / billing on the provider side
  | "timeout"
  | "upstream" // 5xx / network
  | "bad_output"; // provider answered but returned nothing usable

const USER_MESSAGES: Record<ProviderErrorCode, string> = {
  auth: "The AI provider rejected our credentials. Your credits were refunded — please contact support.",
  network: "We couldn't reach the AI provider. Your credits were refunded — please contact support.",
  config: "This generation engine isn't configured correctly. Your credits were refunded.",
  content_policy: "The AI provider's safety filter blocked this request. Try a different format or product photo.",
  invalid_request: "The AI provider couldn't process this request. Try a different photo or format.",
  rate_limit: "The AI provider is busy right now. We retried automatically but it didn't succeed — please try again shortly.",
  quota: "The AI provider's usage limit was reached. Your credits were refunded.",
  timeout: "The AI provider took too long to respond. Your credits were refunded.",
  upstream: "The AI provider had a temporary problem. Your credits were refunded — please try again.",
  bad_output: "The AI provider returned no usable result. Your credits were refunded — please try again.",
};

const RETRYABLE: Record<ProviderErrorCode, boolean> = {
  auth: false,
  network: false,
  config: false,
  content_policy: false,
  invalid_request: false,
  rate_limit: true,
  quota: false,
  timeout: true,
  upstream: true,
  bad_output: true,
};

export class ProviderError extends Error {
  readonly retryable: boolean;
  readonly userMessage: string;
  constructor(
    readonly provider: string,
    readonly code: ProviderErrorCode,
    readonly detail: string,
    opts: { retryable?: boolean; userMessage?: string; status?: number } = {},
  ) {
    super(`[${provider}] ${code}: ${detail}`);
    this.retryable = opts.retryable ?? RETRYABLE[code];
    this.userMessage = opts.userMessage ?? USER_MESSAGES[code];
    this.status = opts.status;
  }
  readonly status?: number;
}

/** Map an HTTP error response to a ProviderError. Body is truncated and must never contain our key. */
export function httpError(provider: string, status: number, body: string, hints: { contentPolicy?: RegExp } = {}) {
  const detail = `HTTP ${status}: ${body.slice(0, 1500)}`;
  // egress proxies / firewalls (e.g. "Host not in allowlist") — not the provider talking
  if (/Host not in allowlist|egress|proxy authentication|ERR_ACCESS_DENIED/i.test(body)) return new ProviderError(provider, "network", detail, { status });
  if (hints.contentPolicy?.test(body)) return new ProviderError(provider, "content_policy", detail, { status });
  // Google answers 400 INVALID_ARGUMENT/API_KEY_INVALID for bad keys; OpenAI uses 401 invalid_api_key.
  if (/API_KEY_INVALID|API key not valid|invalid_api_key|Incorrect API key|invalid x-api-key|Unauthorized/i.test(body)) {
    return new ProviderError(provider, "auth", detail, { status });
  }
  if (status === 401 || status === 403) return new ProviderError(provider, "auth", detail, { status });
  if (status === 402) return new ProviderError(provider, "quota", detail, { status });
  if (status === 404) return new ProviderError(provider, "config", detail, { status });
  if (status === 408 || status === 504) return new ProviderError(provider, "timeout", detail, { status });
  if (status === 429) {
    // quota exhaustion often comes back as 429 too
    if (/quota|billing|insufficient|exceeded your current/i.test(body)) return new ProviderError(provider, "quota", detail, { status });
    return new ProviderError(provider, "rate_limit", detail, { status });
  }
  if (status >= 500) return new ProviderError(provider, "upstream", detail, { status });
  return new ProviderError(provider, "invalid_request", detail, { status });
}

/** fetch() wrapper that turns network failures/timeouts into ProviderErrors. */
export async function providerFetch(provider: string, url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 180_000, ...rest } = init;
  try {
    return await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const e = err as Error;
    if (e.name === "TimeoutError") throw new ProviderError(provider, "timeout", `No response after ${timeoutMs}ms from ${new URL(url).host}`);
    const cause = (e as Error & { cause?: { code?: string } }).cause?.code;
    // DNS failure / refused connection is a config problem, not worth retrying
    const permanent = cause === "ENOTFOUND" || cause === "ECONNREFUSED";
    throw new ProviderError(provider, permanent ? "network" : "upstream", `Network error calling ${new URL(url).host}: ${e.message}${cause ? ` (${cause})` : ""}`);
  }
}

/** Normalize anything thrown during a job into user + debug messages. */
export function describeError(err: unknown): { userMessage: string; detail: string; retryable: boolean; code: string } {
  if (err instanceof ProviderError) return { userMessage: err.userMessage, detail: err.message, retryable: err.retryable, code: err.code };
  const e = err instanceof Error ? err : new Error(String(err));
  return {
    userMessage: "Something went wrong while generating. Your credits were refunded.",
    detail: `${e.name}: ${e.message}${e.stack ? `\n${e.stack.split("\n").slice(1, 6).join("\n")}` : ""}`,
    retryable: true,
    code: "internal",
  };
}
