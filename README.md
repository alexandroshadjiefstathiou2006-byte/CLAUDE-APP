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

All keys live in `.env`. Each provider is chosen by its own env var and sits behind an interface in `src/server/ai/types.ts`:

| Capability | Env to enable | Key | Implementation |
|---|---|---|---|
| Scripts, hooks, product analysis | `SCRIPT_PROVIDER=anthropic` | `ANTHROPIC_API_KEY` | `src/server/ai/providers/anthropic-script.ts` |
| Product / model photos | `IMAGE_PROVIDER=openai` | `OPENAI_API_KEY` | `src/server/ai/providers/openai-image.ts` |
| Video (image→video) | `VIDEO_PROVIDER=fal` | `FAL_KEY` | `src/server/ai/providers/fal-video.ts` |
| Voiceover | `VOICE_PROVIDER=elevenlabs` | `ELEVENLABS_API_KEY` | `src/server/ai/providers/elevenlabs-voice.ts` |
| Billing | — | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | `src/server/billing/stripe.ts` |

To add a vendor, implement the interface in one new file and add one line in `src/server/ai/registry.ts`.

## How generation works

`POST /api/generations` validates the request, builds N variation specs, debits credits, inserts `GenerationJob` rows (all in one transaction) and returns `202` right away. A worker claims jobs atomically and runs this pipeline:

- **Photo:** concept → prompt (product fidelity + creator identity + brand) → image provider → storage → `Creative`.
- **Video:** script → voice → submit to video provider. If the provider is still working, the job goes to `processing` and the worker polls it later.

Failed jobs retry with backoff, up to 3 attempts. After the last failure, credits are refunded automatically. The UI polls job status and shows **Queued → Generating… → Processing… → Completed / Failed**.

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
