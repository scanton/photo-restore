# Changelog

All notable changes to PicRenew will be documented in this file.

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
