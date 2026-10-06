# Studio — AI Creative Studio for E-commerce

> Upload your product once. Generate dozens of realistic photos and UGC ads ready to publish.

This document is the design that the MVP code implements. It follows the order requested:
product analysis → risks → stack → schema → API → AI abstraction → frontend → jobs → screens.

---

## 1. Product analysis

**Who pays:** DTC fashion / apparel brands doing $20k–$2M/month on Shopify, running Meta + TikTok ads.
Their bottleneck is not "an image" — it is **creative volume**. Ad platforms reward constant testing of
new hooks, faces and formats, and every new creative today costs a shoot, a model, or a $150–$500 UGC creator.

**Job to be done:** "Give me 20 new, on-brand ad creatives for this product this week, that look real,
show the product *exactly* as it is, and that I can upload straight to Ads Manager."

**What makes it a product, not a toy:**

| Generic AI image tool | Studio |
|---|---|
| Starts from a blank prompt | Starts from **the product** (catalog object, with analyzed attributes) |
| Random faces each time | **Persistent AI creators** with a locked identity, reused across products |
| One output | **Variations** that deliberately vary hook / creator / location / angle — built for ad testing |
| User writes prompts | User picks a **creative format** (Mirror Selfie, GRWM, Unboxing…); prompts are built by the system |
| No memory | **Brand Kit** applied to every generation |
| Files in a downloads folder | **Creative Library** + (later) push to Meta / TikTok |

The core loop that must be flawless: **Upload product → choose creator → choose creative → generate → download.**

## 2. Biggest technical risks (and mitigations)

1. **Product fidelity (highest risk).** Diffusion models "redraw" garments: logos warp, prints change, colors shift.
   Brands will churn the first time a logo is wrong.
   - Always pass the product photo as a *reference image* (image-edit / reference-conditioned models), never text-only.
   - Run a product **analysis** step at upload that extracts colors (hex), logos, graphics, materials, fit → injected as hard constraints into every prompt (`src/server/generation/prompts.ts`).
   - Roadmap: segmentation + compositing of the original product pixels for logo areas; automated fidelity check (vision model compares output vs. reference, auto-retry on mismatch).
2. **Identity consistency of AI creators.** Each creator stores an `identityPrompt`, a fixed `seed`, and reference images. Providers that support face/character references (e.g. character-reference or LoRA endpoints) receive them; the abstraction already carries `creator.referenceImages`.
3. **Realistic talking-head UGC video.** Requires script → voice → lip-synced avatar → B-roll → edit. No single API does all of it well. The pipeline is split into providers (Script, Voice, Video) so an avatar/lip-sync vendor can be dropped in behind `VideoGenerationProvider` without touching the app.
4. **Latency & cost.** Videos take 1–10 minutes and cost real money per call. → Async job queue, credits debited up-front and **refunded automatically on failure**, provider polling instead of long-held HTTP requests.
5. **Provider churn.** The best model changes every quarter. → Everything is behind interfaces chosen by env vars (`src/server/ai/registry.ts`).
6. **Abuse / rights.** Users could upload content they don't own or try to clone real people. → ToS, moderation hook point in the job pipeline (`runJob` is the single choke point), "Recreate Creative" designed to copy *structure*, never footage.

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Web app | **Next.js 15 (App Router) + TypeScript** | One codebase for landing, app and API; server components read the DB directly for fast pages |
| UI | **Tailwind CSS** + lucide icons | Fast to build a premium, consistent design system |
| DB | **Prisma** — SQLite in dev, **Postgres** in production | Zero-setup local dev; switch `provider` in `prisma/schema.prisma` for prod (Neon / Supabase / RDS) |
| Auth | Email + password, bcrypt, signed JWT cookie (`jose`) | Small and dependency-light; isolated in `src/lib/auth.ts` so Clerk/Auth.js can replace it |
| Jobs | **DB-backed queue + worker process** (`npm run worker`) | No Redis needed for MVP; atomic claim works on SQLite and Postgres. Swap for BullMQ/Inngest/Trigger.dev when volume demands |
| Storage | `StorageProvider` — local disk in dev, S3/R2 in prod | Same interface, `src/server/storage` |
| Payments | **Stripe** Checkout + Billing Portal + webhooks | Subscriptions grant monthly credits |
| AI | Anthropic Claude (scripts, hooks, product analysis), OpenAI `gpt-image-1` (reference-based photos), fal.ai (image→video), ElevenLabs (voice) | All behind interfaces; **mock providers** make the whole app work with zero keys |

## 4. Database schema

See `prisma/schema.prisma`. Core entities:

```
User ─< Membership >─ Workspace (the brand account: plan, credit balance, Stripe ids)
                          ├── BrandKit (1:1)
                          ├── Product ─< Creative
                          ├── Creator (workspaceId NULL = stock library creator)
                          ├── GenerationJob ─1:1─ Creative (result)
                          ├── CreditLedger (append-only; balance cached on Workspace)
                          └── Integration (shopify / meta / tiktok — future)
WebhookEvent (Stripe idempotency)
```

Design notes:
- **Credits** are an append-only ledger (`CreditLedger`) + a cached `Workspace.creditBalance`, always updated in the same transaction. Every debit references a job; failures write a compensating refund row.
- **GenerationJob** carries the full `input` snapshot (product attributes, creator, brand kit, variation spec) so a job is reproducible and the worker never depends on later edits.
- `Product.source/externalId/variants` exist so Shopify import is a pure addition.
- JSON columns are stored as strings for SQLite compatibility (helpers in `src/lib/json.ts`).

## 5. API architecture

REST-style route handlers under `src/app/api`. Every handler resolves the session → workspace and scopes all queries by `workspaceId`.

| Method & path | Purpose |
|---|---|
| `POST /api/auth/signup` · `login` · `logout` | Session cookie auth |
| `POST /api/uploads` | Multipart upload → `{ url }` |
| `GET/POST /api/products` · `GET/PATCH/DELETE /api/products/:id` | Product library (POST enqueues free `analyze_product` job) |
| `GET/POST /api/creators` | Creator library (stock + brand creators) |
| `POST /api/generations` | Create 1–10 jobs (variations), debit credits, enqueue → returns job ids immediately |
| `GET /api/generations?ids=…` | Poll job status (`queued`/`generating`/`processing`/`completed`/`failed`) |
| `GET /api/creatives` · `PATCH/DELETE /api/creatives/:id` · `POST /api/creatives/:id/duplicate` | Library actions; variations reuse `POST /api/generations` with `sourceCreativeId` |
| `GET/PUT /api/brand` | Brand kit |
| `POST /api/billing/checkout` · `POST /api/billing/portal` · `POST /api/webhooks/stripe` | Billing |
| `GET /api/files/*` | Serves local storage in dev (S3/CDN URLs in prod) |

Later: `/api/integrations/shopify/*` (OAuth + product sync), `/api/campaigns`, `/api/exports/meta`.

## 6. AI provider abstraction

`src/server/ai/types.ts`:

```ts
interface ImageGenerationProvider  { generate(req: ImageRequest): Promise<ProviderResult> }
interface VideoGenerationProvider  { submit(req: VideoRequest): Promise<ProviderResult>; poll(id: string): Promise<ProviderResult> }
interface VoiceGenerationProvider  { synthesize(req: VoiceRequest): Promise<{ audio: Buffer; mimeType: string }> }
interface ScriptGenerationProvider { analyzeProduct(...); generateUGCScript(...); generatePhotoConcept(...) }

type ProviderResult =
  | { status: "completed"; files: GeneratedFile[] }
  | { status: "pending"; providerJobId: string }   // worker re-polls later
```

`src/server/ai/registry.ts` picks implementations from env vars:

| Env var | Values | API key |
|---|---|---|
| `IMAGE_PROVIDER` | `mock` (default) · `openai` | `OPENAI_API_KEY` |
| `VIDEO_PROVIDER` | `mock` (default) · `fal` | `FAL_KEY` |
| `VOICE_PROVIDER` | `mock` (default) · `elevenlabs` | `ELEVENLABS_API_KEY` |
| `SCRIPT_PROVIDER` | `mock` (default) · `anthropic` | `ANTHROPIC_API_KEY` |

Adding a vendor = one file implementing the interface + one line in the registry. The rest of the app never imports a vendor SDK.

Prompts are **built by the system, not the user** (`src/server/generation/prompts.ts`): product fidelity block + creator identity block + creative preset scene + brand kit style + variation spec.

## 7. Frontend architecture

- `src/app/(marketing)` — landing page.
- `src/app/(auth)` — login / signup.
- `src/app/app/*` — the authenticated studio, with a persistent sidebar layout. Pages are **server components** that query Prisma directly; interactive parts are small client components (`src/components/*`).
- `src/lib/catalog.ts` — single source of truth for creative presets (photo + video formats), credit costs, platforms, ad styles. Both UI and worker read it.
- Live job status via a polling hook (`useJobs`) — 2s interval, stops when all jobs are terminal. (SSE/websocket later; the API shape stays the same.)

## 8. Generation / job system

```
User clicks Generate
  → POST /api/generations
      validate → build N variation specs → in one transaction:
      debit credits (ledger) + insert N GenerationJob(status=queued)
  ← 202 { jobIds }                         (UI immediately shows "Queued" cards)

Worker loop (npm run worker, or in-process in dev):
  claim: UPDATE job SET status='generating', lockedAt=now WHERE id=? AND status='queued'
  photo: script.generatePhotoConcept → image.generate → storage.put → Creative → completed
  video: script.generateUGCScript → voice.synthesize → video.submit
           → pending? status='processing', runAfter=now+10s, store providerJobId → re-poll later
           → completed: storage.put → Creative → completed
  error: retry with backoff (max 3) → then status='failed' + credit refund
  stale lock (>15 min) → re-queued
```

Statuses shown to users: **Queued → Generating… → Processing… → Completed / Failed**.

## 9. MVP screens

1. **Landing** — headline, workflow, before/after strip, pricing, CTA.
2. **Sign up / Log in.**
3. **Dashboard** — big "Create Content" CTA, quick actions, recent products, recent creatives, credit balance.
4. **Products** — grid of product cards; **Add Product** (drag-and-drop image, name, description, URL, logo, colors). Product detail shows AI analysis + its creatives + "Create content".
5. **AI Creators** — filterable library (gender, age, style, location, category) + "Create brand creator".
6. **Create** — the core wizard: Product → Creator → Format (Photos / Videos) → Options (style, platform, duration, quality, variations) with live credit cost → Generate → live result cards.
7. **Creative Library** — filters (All, Photos, Videos, UGC, Ads, Favorites), preview modal, download, rename, favorite, duplicate, delete, generate variations.
8. **Brand Kit** — name, logo, colors, fonts, tone, target customer, categories, preferred styles.
9. **Billing** — plan cards, credit balance, ledger history, Stripe checkout/portal.
10. Analytics / Settings — placeholders in the MVP.

## 10. Roadmap after MVP

- Campaign generator (`Campaign` entity grouping jobs: hooks, scripts, videos, photos, captions).
- Recreate Creative (reference video → structure analysis via vision model → `SceneSpec[]` → same UGC pipeline).
- Shopify app (OAuth, product webhooks → `Product` upsert by `externalId`), "Create Ads" button on imported products.
- Meta / TikTok Ads export, performance analytics feeding back into which hooks to generate.
- Fidelity QA step and automatic re-generation.
