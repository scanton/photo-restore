# Changelog

All notable changes to PicRenew will be documented in this file.

## [0.3.2.0] - 2026-03-20

### Added
- **AI restoration pipeline** — full async pipeline via QStash + kie.ai. Upload → `POST /api/jobs/restore` submits a 1K restoration task; kie.ai callback (`POST /api/webhooks/kie?phase=initial`) applies watermark, estimates era, and transitions status to `pending_payment`.
- **Hi-res pipeline** — 2K/4K purchases enqueue `POST /api/jobs/restore-hires` via QStash; kie.ai callback (`phase=hires`) uploads the full-res output and marks the restoration `complete`.
- **Failure handler** — `POST /api/jobs/restore-failed` receives QStash failure callbacks after all retries are exhausted and sets restoration status to `failed`, ending the spinner.
- **Transactional email** — `sendRestorationReadyEmail()` sends a branded "Your photo is ready" email via Resend after a restoration completes. No-op for anonymous users and when `RESEND_API_KEY` is not set.
- **Era estimation** — `lib/openrouter.ts` calls OpenRouter (Gemini Flash 1.5) to estimate the decade a photo was taken. Result displayed on the restore page. Best-effort: any failure returns null silently.
- **QStash client** — shared `lib/qstash.ts` with `verifyQStash()` helper and `buildFailureCallback()` utility. Raw body is read before signature verification to avoid consuming the stream.
- **kie.ai client** — `lib/kie.ts` wraps `POST /api/v1/jobs/createTask` and `buildKieCallbackUrl()`. Throws on any non-2xx so the job route returns 500 and QStash retries.
- **Preset prompts** — `lib/presets.ts` extended with `prompt` field for each preset (standard, colorize, enhance, portrait).
- **161 tests** across 13 test files covering all new routes and library modules.

### Changed
- **Upload route** — now validates preset slug before any expensive operations; publishes QStash job with 3 retries + failure callback after blob upload; marks restoration `failed` if publish fails (prevents orphaned "analyzing" records).
- **Purchase route** — 1K purchases: `status → complete` + email immediately (preview IS the full 1K output). 2K/4K purchases: `status → processing` + QStash `restore-hires` job; credits refunded if QStash publish fails.

### Fixed
- `restore-hires` idempotency: added `status = 'processing'` guard to prevent duplicate kie.ai submissions if QStash delivers after the job already completed.
- `restore-hires` retry safety: `createKieTask` failures now reset `kieAiJobId` to `null` and re-throw so QStash can retry cleanly (previously: `kieAiJobId` stayed `'hires-pending'` and all retries silently skipped).
- `restore-hires` NULL idempotency: `WHERE` clause now includes `OR kieAiJobId IS NULL` to handle retry-after-failure-reset (SQL `NULL != 'hires-pending'` evaluates to `NULL`, not `TRUE`).
- `restore-failed` terminal state guard: protects `complete` and `refunded` restorations in addition to `failed` — a stale failure callback can no longer clobber a completed restoration.
- Webhook auth uses `crypto.timingSafeEqual` to prevent timing attacks on the shared secret comparison.
- Webhook hires phase: idempotency check (`status === 'complete'`) now runs before image download, not after.
- Email module: `Resend` is instantiated inside the function body (not at module level) to prevent throws in test environments missing `RESEND_API_KEY`.

## [0.3.1.0] - 2026-03-19

### Added
- **Billing page** (`/billing`) — browse credit packs and subscriptions in one place, toggle monthly/annual pricing (10% off annual), and jump there automatically when you run low on credits.
- **Resolution picker** — before downloading a restoration, choose 1k (1 credit), 2k (2 credits), or 4k (3 credits). The "Use X credits" CTA updates live so you always know the cost before committing.
- **Customer Portal** — subscribers can cancel, upgrade, or update their payment method via Stripe's hosted portal (`POST /api/billing/portal`).
- **Vercel Analytics** — page-view and interaction data now flowing to the Vercel dashboard.

### Fixed
- **Auth was silently broken** — the NextAuth API route (`/api/auth/[...nextauth]/route.ts`) was missing entirely, causing every session check to 404 on each page load. Now in place.
- **Restore page showed "Loading…" on error** — the heading now reads "Restoration not found." when the fetch fails instead of staying stuck on "Loading…"
- **Upload returned 500 on malformed requests** — bad request bodies now return 400 with a clear error message instead of an internal server error.
- **Non-UUID restore IDs caused 500 errors** — both the status and purchase routes now validate the ID format and return 400 "Invalid restoration ID." before hitting the database.

### Testing
- 39 new tests covering: purchase endpoint UUID validation, status route auth matrix (4 cases updated). Total: 93 passing.

---

## [0.3.0.0] - 2026-03-19

### Added
- **Product registry** (`src/lib/products.ts`) — all 7 Stripe products in one place: 3 credit packs (Starter/Power/Value) and 4 subscription tiers (Hobbyist/Professional, monthly and annual). Single source of truth for credit amounts — `metadata.credits` always comes from here, never from client input.
- **Credit purchase endpoint** (`POST /api/restore/[id]/purchase`) — atomically debits credits and kicks off restoration processing. Cost is `preset base × resolution multiplier` (1×/2×/3× for 1k/2k/4k). Guards against double-debit with a per-restoration idempotency key.
- **Stripe Checkout Sessions** (`POST /api/checkout/create`) — creates the right session type (`"payment"` or `"subscription"`) based on the product, reuses existing Stripe customers so you never get duplicates, and validates `priceId` server-side before touching Stripe.
- **Subscription renewal credits** (`invoice.payment_succeeded` webhook) — subscribers now receive their monthly credits automatically on renewal. Awards `creditsPerMonth` from the database, not Stripe metadata. Idempotency key `sub-{subId}-{periodStart}` survives Stripe retries safely.
- **Resolution column** — `restorations.resolution` pgEnum (`"1k" | "2k" | "4k"`) added to the schema, defaults to `"1k"`. Run `npx drizzle-kit push` to sync.

### Testing
- 54 new tests across 4 new test files: purchase endpoint (14), checkout/create (11), products registry (24), invoice webhook (7). Total: 93 passing.

## [0.2.0.0] - 2026-03-19

### Added
- Full Next.js 16 app scaffold (App Router, TypeScript, Tailwind CSS, deployed to Vercel)
- Database schema (`src/lib/db/schema.ts`) — 8 tables: `users`, `accounts`, `sessions`, `verificationTokens`, `creditLedger`, `restorations`, `batchJobs`, `gifts`, `subscriptions`, `presets`; 5 enums; append-only credit ledger architecture
- Auth (`src/lib/auth.ts`) — NextAuth v5 + Google OAuth + DrizzleAdapter; JWT strategy; role injected into session; middleware protecting `/admin/*`
- Credit service (`src/lib/credits.ts`) — `getBalance`, atomic `debitCredits` (SELECT FOR UPDATE in transaction), idempotent `awardCredits` (Postgres 23505 dedup); `InsufficientCreditsError`
- Server-side watermark (`src/lib/watermark.ts`) — jimp burns "PREVIEW — PicRenew" diagonally; pure-JS, no native deps
- Preset definitions (`src/lib/presets.ts`) — Standard (1cr), Colorize (2cr), Deep Enhance (2cr), Portrait Focus (1cr)
- Design system applied to root layout (`src/app/layout.tsx`) — Fraunces, Plus Jakarta Sans, JetBrains Mono via next/font; CSS custom property token system in `globals.css`
- Landing page (`src/app/(marketing)/page.tsx`) — upload CTA with drag-and-drop; hero copy "Give your family photos the care they deserve"
- Restore page (`src/app/(app)/restore/[id]/page.tsx`) — polls `/api/restore/[id]/status` every 2s; before/after slider; purchase CTA at `pending_payment`; download at `complete`
- UI components: `Button` (primary/secondary/ghost/loading), `UploadZone` (drag-and-drop, 20MB + image validation), `BeforeAfterSlider` (touch+mouse, 60fps CSS transforms), `CreditBalance`
- API routes: `POST /api/upload` (magic-byte validated), `GET /api/restore/[id]/status` (IDOR protected), `POST /api/webhooks/stripe` (signature verified, idempotent credit award), `GET /api/credits/balance`
- Stripe webhook handler — `checkout.session.completed` awards credits; subscription lifecycle (create/update/delete); idempotency key prevents double grants on retry
- Product renamed from "Photo Restore" to **PicRenew** (domain: picrenew.com)
- `.env.example` with all required env vars; `RESEND_FROM_EMAIL=noreply@picrenew.com`
- Vitest test suite (37 tests, 4 files) — credits service, upload validation, IDOR guard, Stripe webhook

### Fixed
- `debitCredits` race condition: balance check and ledger insert now wrapped in a DB transaction with SELECT FOR UPDATE, preventing concurrent double-spend
- `awardCredits` idempotency: Postgres 23505 unique constraint violations caught and returned silently — Stripe webhook retries no longer return 500
- Upload route MIME spoofing: magic byte validation added (JPEG/PNG/GIF/WebP) alongside client-controlled MIME type check
- Restore page polling stale closure: replaced `data`-in-deps pattern with `useRef` for status tracking; removed `eslint-disable` comment

### For contributors
- `src/lib/db/schema.ts` is now pure table/enum definitions; DB connection (`Pool`, `drizzle()`) moved to `src/lib/db/index.ts`
- `credit_ledger` table now has an index on `user_id` for balance sum query performance

## [0.1.0.0] - 2026-03-18

### Added
- Design system (`DESIGN.md`) — Refined Artisan aesthetic; Fraunces display font, Plus Jakarta Sans body, JetBrains Mono data; cognac amber `#B5622A` accent on archival cream `#FAF7F2` background; 8px spacing base; intentional film grain on marketing surfaces
- Project instructions (`CLAUDE.md`) — design system key rules, gstack skill index, QA design compliance expectations
- v1 product plan (`docs/designs/photo-restore-v1.md`) — scope decisions and locked architecture: before/after slider, AI era estimation, gift flow, batch processing, admin analytics; anonymous upload + watermark gate; Vercel Blob, Upstash QStash, Neon Postgres, 30-day retention
- Post-launch roadmap (`TODOS.md`) — five deferred items: physical print ordering, genealogy integrations, referral program, developer API, family album
- Vendored gstack skills (`/browse`, `/plan-ceo-review`, `/plan-eng-review`, `/design-consultation`, `/review`, `/ship`, `/qa`, `/qa-only`, `/design-review`, `/office-hours`, `/retro`, `/debug`, `/document-release`)
- `.gitignore` — Node/Next.js, Vercel, gstack binaries, OS artifacts
- `README.md` — product overview, tech stack, architecture decisions, design system summary, dev setup, gstack skills index
