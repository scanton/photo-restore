# PicRenew

AI-powered photo restoration for family memories. Upload an old, faded, or damaged photograph — get back a beautifully restored version in seconds.

Built for the person at 45 dealing with a box of their parents' photos. Not a tech tool. A skilled conservator in your browser.

---

## What It Does

- **Upload & restore** — drag in a JPG or PNG, get a watermarked preview instantly, purchase to download the full-resolution result
- **Before/after slider** — drag to compare original and restored side by side; share to social with one click
- **AI era estimation** — the app identifies the approximate decade a photo was taken and suggests the right restoration preset automatically
- **Gift a restoration** — buy a restored photo as a gift; the recipient gets an email with a one-click download link, no account required
- **Batch processing** — upload up to 10 photos at once; they process in parallel and arrive as a zip download
- **$0.99 guest checkout** — download a single restoration for $0.99 without creating an account; credits optional
- **Credit packs & subscriptions** — pay per restoration or subscribe for a monthly credit allowance
- **Admin dashboard** — restorations per day, revenue, preset popularity, failed job log

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) on Vercel |
| Auth | NextAuth.js + Google OAuth |
| Database | Neon Postgres + Drizzle ORM |
| Storage | Vercel Blob (30-day auto-delete) |
| Payments | Stripe Checkout + Customer Portal |
| Restoration AI | kie.ai nano-banana-2 |
| Era estimation | OpenRouter vision model |
| Async queue | Upstash QStash (restoration jobs) |
| Email | Resend + React Email |
| Tests | Vitest (unit/integration) + Playwright (E2E) |

---

## Architecture Decisions

- **Anonymous upload, auth at purchase** — users see a watermarked preview without signing in; Google OAuth is required only at checkout. Maximizes top-of-funnel.
- **Watermark is burned in server-side** — never a CSS overlay. The watermarked preview is a separate image file.
- **Append-only credit ledger** — credits are never mutated, only appended. Every debit, refund, and award is a separate row with an idempotency key.
- **QStash for async restoration** — each upload becomes an independent async job (restore → hires), avoiding Vercel serverless timeouts. At-least-once delivery with idempotency guards and a failure callback.
- **30-day retention** — restored images are auto-deleted after 30 days; users can re-download within the window.

Full architecture details in [`docs/designs/photo-restore-v1.md`](docs/designs/photo-restore-v1.md).

---

## Design System

The product uses a **Refined Artisan** aesthetic — warm, unhurried, treats photographs as precious objects.

- **Fonts:** Fraunces (display/headings), Plus Jakarta Sans (body/UI), JetBrains Mono (data/credits)
- **Accent:** `#B5622A` cognac amber — unclaimed territory in the AI photo tools space
- **Background:** `#FAF7F2` archival cream — never pure white
- **Spacing:** 8px base, comfortable density

Full token system in [`DESIGN.md`](DESIGN.md). All visual decisions must be grounded there.

---

## Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in: DATABASE_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
#          STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, BLOB_READ_WRITE_TOKEN,
#          KIE_AI_API_KEY, OPENROUTER_API_KEY, UPSTASH_REDIS_REST_URL,
#          UPSTASH_REDIS_REST_TOKEN, RESEND_API_KEY

# Run database migrations
npx drizzle-kit push

# Start dev server
npm run dev
```

```bash
# Run tests
npm run test           # Vitest unit/integration (200 tests)
```

---

## gstack Skills

This repo uses [gstack](https://github.com/codestack-ai/gstack) for AI-assisted development. Skills are vendored in `.claude/skills/`. Build the browse binary before first use:

```bash
cd .claude/skills/gstack && ./setup
```

Available skills: `/browse`, `/plan-ceo-review`, `/plan-eng-review`, `/design-consultation`, `/review`, `/ship`, `/qa`, `/qa-only`, `/design-review`, `/office-hours`, `/retro`, `/debug`, `/document-release`

---

## Project Docs

| File | What it covers |
|---|---|
| [`DESIGN.md`](DESIGN.md) | Full design system — fonts, colors, spacing, motion, layout |
| [`TODOS.md`](TODOS.md) | Roadmap — P2/P3 post-launch items: print ordering, genealogy integrations, referral program, API, family album |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history |
| [`docs/designs/photo-restore-v1.md`](docs/designs/photo-restore-v1.md) | CEO-reviewed v1 product plan and scope decisions |

---

## Status

**v0.3.4.0 — Sprint 4: options screen, $0.99 guest checkout, and billing UX.**

Users can now toggle "Remove frame" and "Colorize" before restoring. A $0.99 guest checkout lets anyone download a single photo without creating an account. The billing page shows subscriptions first with annual pricing as default, product icons on every card, and plain-English credit pack descriptions. 200 tests passing.
