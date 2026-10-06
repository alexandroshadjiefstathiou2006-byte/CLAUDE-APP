# Studio — AI Creative Studio for E-commerce

**Upload your product once. Generate dozens of realistic photos and UGC ads ready to publish.**

A SaaS for fashion and e-commerce brands. You upload a product, pick an AI creator and a creative format, then generate model photos, UGC videos and ad variations. Everything is saved to a creative library and paid for with credits.

The design is in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: product analysis, technical risks, stack, schema, API, AI abstraction, job system and screens.

## Quick start

```bash
npm install
cp .env.example .env        # works as-is: every AI provider defaults to "mock"
npm run setup               # create the SQLite DB + seed 12 stock creators and a demo brand
npm run dev                 # http://localhost:3000
```

Log in with **demo@studio.dev / demo1234**, or sign up a new brand (20 free credits).

With no API keys, the app runs end to end using **mock providers**. They render branded SVG previews: product shots and animated video storyboards built from the generated script. Add keys to get real AI output.

## Where the API keys go

All keys go in `.env` and are read only by the server and the worker. They are never sent to the browser. Each capability sits behind an interface in `src/server/ai/types.ts` and is chosen by its own env var:

| Capability | Env to enable | Key | Host to allow | Implementation |
|---|---|---|---|---|
| Scripts, hooks, product analysis | `SCRIPT_PROVIDER=anthropic` | `ANTHROPIC_API_KEY` | api.anthropic.com | `providers/anthropic-script.ts` |
| Photos (Gemini image, recommended) | `IMAGE_PROVIDER=google` | `GEMINI_API_KEY` | generativelanguage.googleapis.com | `providers/google-image.ts` |
| Photos (OpenAI GPT Image) | `IMAGE_PROVIDER=openai` | `OPENAI_API_KEY` | api.openai.com | `providers/openai-image.ts` |
| Video with speech (Veo 3, recommended) | `VIDEO_PROVIDER=google` | `GEMINI_API_KEY` | generativelanguage.googleapis.com | `providers/google-veo.ts` |
| Video, no audio (Kling via fal.ai) | `VIDEO_PROVIDER=fal` | `FAL_KEY` | queue.fal.run, *.fal.media | `providers/fal-video.ts` |
| Voiceover (for fal) | `VOICE_PROVIDER=elevenlabs` | `ELEVENLABS_API_KEY` | api.elevenlabs.io | `providers/elevenlabs-voice.ts` |
| Billing | — | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | api.stripe.com | `src/server/billing/stripe.ts` |

The minimum real setup is one `GEMINI_API_KEY`, which covers photos and talking UGC video. Add `ANTHROPIC_API_KEY` for real scripts and product analysis.

## AI Creator identities

Brands open **AI Creators → Create AI Creator** to make their own creator:

1. **Describe the creator:** name, age, gender, appearance, hair, eyes, body type, fashion style, personality and target niche.
2. **Generate Creator:** creates 4 fictional, photorealistic portrait candidates.
3. **Pick one:** it becomes the **master identity reference**.
4. **Identity pack:** generated automatically from the master: front-facing, 3/4 angle, side angle, smiling and neutral.

Every creator has a persistent `identityId` (`idn_…`). References are stored as `CreatorReference` rows: `candidate`, `master`, `front`, `three_quarter`, `side`, `smiling`, `neutral`.

When a creator appears in a product photo or video keyframe, the image provider receives three things (see `ImageRequest` in `src/server/ai/types.ts`):

- the **product reference image** (image 1),
- the **identity references**, master first, then front and 3/4,
- the **prompt**, which explains which image is which.

Other rules:

- Creators must be fictional. Descriptions that compare the creator to a real person ("looks like…", "celebrity", "lookalike") are rejected, and every portrait prompt says the person is fictional.
- Portraits are async jobs on the normal queue and cost 1 credit each (4 for candidates, 5 for the pack). Failed portraits are refunded.
- Draft creators (no face chosen yet) can't be used for product generation.
- Without an image API key, portraits are illustrated previews; the workflow is otherwise identical.
- Tests: `npx tsx scripts/test-creator-identity.ts` (mock) and `--stub` (records the exact provider requests, no paid calls).

## Testing real generation

```bash
npx tsx scripts/provider-probe.ts      # one tiny call per provider: checks keys, network, model names
npx tsx scripts/live-test.ts           # full end-to-end run through the job queue
npx tsx scripts/live-test.ts --skip-video
npx tsx scripts/live-test.ts --product my-garment.jpg --creator Maya
```

`live-test.ts` runs the following, all through the real worker, storage and credit ledger:

- Creates an isolated workspace and uploads a real garment photo.
- Runs product analysis, then generates **3 model photos** and **1 UGC video** with one AI creator.
- Checks stored files, MIME types, mp4 playability (via ffprobe), HTTP download (if the app is running), DB state and the credit ledger.
- Tests failure handling:
  - a bad key fails fast and refunds the credits;
  - injected transient failures are retried, then succeed, and are charged once;
  - when retries run out, the job fails and the credits are refunded.

It writes the outputs and a `REPORT.md` to `test-output/<timestamp>/`.

## How generation works

`POST /api/generations` validates the request, builds N variation specs, debits credits, inserts `GenerationJob` rows (all in one transaction) and returns `202` right away. A worker claims jobs atomically and runs this pipeline:

- **Photo:** concept → prompt (product fidelity + creator identity + brand) → image provider → storage → `Creative`.
- **Video:**
  1. Generate the script.
  2. Generate a **keyframe image**: the creator wearing the product, made with the product photo as reference.
  3. Add a voiceover, but only if the video engine can't speak on its own.
  4. Send the keyframe to an image-to-video provider. The job then goes to `processing` and the worker polls until the video is ready.

Every image request sends the **original product photo** as a reference image. Creator consistency comes from an identity portrait generated once per creator, which is reused as the face reference for every later generation.

Transient errors (rate limits, 5xx, timeouts) retry with backoff, up to 3 attempts. Permanent errors fail immediately: bad key, blocked host, content policy, invalid request. Either way, credits are refunded automatically. The user sees a specific, safe message. The full provider response is logged and stored in `GenerationJob.errorDetail`, which is never sent to the browser. The UI polls job status and shows **Queued → Generating… → Processing… → Completed / Failed**.

- **Development:** `JOB_RUNNER=inline` runs the worker inside the Next.js process.
- **Production:** set `JOB_RUNNER=external` and run `npm run worker` as its own service. You can scale it horizontally.

## Project layout

```
prisma/schema.prisma          data model (SQLite dev → switch provider to postgresql for prod)
prisma/seed.ts                stock AI creators + demo account
src/lib/catalog.ts            creative formats, ad styles, platforms, CREDIT PRICING
src/lib/plans.ts              subscription plans
src/server/ai/                provider interfaces, registry, vendor implementations
src/server/generation/        prompt builders + variation engine
src/server/jobs/              enqueue, runner (claim/run/retry/refund), inline dev worker
src/server/billing/           credit ledger + Stripe
src/server/storage/           storage abstraction (local disk; add S3/R2)
src/server/integrations/      Shopify import (scaffold)
src/worker/index.ts           standalone worker process
src/app/                      landing, auth, /app studio pages, /api routes
src/components/               UI: create wizard, creative library, creator library, …
scripts/                      pipeline smoke tests
```

## Production checklist

- `DATABASE_URL` → Postgres, and change `provider` in `prisma/schema.prisma`. Then run `prisma migrate`.
- `AUTH_SECRET` → a long random value.
- Storage → implement S3/R2 in `src/server/storage` and set `STORAGE_DRIVER`.
- Run `npm run worker` separately with `JOB_RUNNER=external`.
- Stripe: create 3 recurring prices and set the `STRIPE_PRICE_*` vars. Point the webhook at `/api/webhooks/stripe` with these events: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`.

## Not in the MVP yet (designed for)

- Campaign generator
- Recreate Creative
- Shopify OAuth and sync (importer scaffold exists)
- Meta / TikTok Ads export
- Ad performance analytics
- Automated fidelity QA
