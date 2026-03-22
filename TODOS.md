# TODOS

## P1 — Next Sprint (Billing UX + Purchase Flow)

### Fix "Unauthorized" Error on Credit Purchase
**What:** Clicking "Buy 10 credits" (or any credit pack) on `/billing` triggers a browser alert: "Unauthorized." The Stripe Checkout session is not being created.
**Why:** Users can't buy anything — this is a complete purchase blocker.
**Pros:** Unblocks all revenue.
**Cons:** —
**Context:** Observed in production (2026-03-20). Likely a missing or misconfigured auth check on `POST /api/checkout/create` — the user is signed out or the session cookie isn't being forwarded. Check that the endpoint accepts the correct auth state (signed-in vs anonymous) and that STRIPE_SECRET_KEY is set correctly in Vercel env.
**Effort:** XS (human: ~1 hr / CC: ~5 min)
**Priority:** P1
**Depends on:** —

---

### Fix Blurry Watermark Preview
**What:** The watermarked preview image on the restore page is blurry — not just the photo, but the "BEFORE" / "RESTORED" labels and UI controls are also blurry/low-res. The blur should only appear on the restored half to indicate a watermark, not on the entire UI.
**Why:** Makes the product look broken rather than intentionally watermarked.
**Pros:** Dramatically improves first impression at the highest-intent moment.
**Cons:** —
**Context:** Observed in production (2026-03-20). The watermark is burned in during `burnWatermark()` in `src/lib/watermark.ts`. The "BEFORE" / "RESTORED" labels and the slider handle are rendered on top of the image in the UI — if those look blurry, the issue is either the image is being upscaled or the Next.js `<Image>` component is displaying the image at a size larger than the actual pixel dimensions. Check the image size returned from `burnWatermark()` and the CSS/layout of the comparison slider.
**Effort:** S (human: ~half day / CC: ~10 min)
**Priority:** P1
**Depends on:** —

---

### Billing Page: Show Subscriptions First, One-Time Packs Second
**What:** Reorder the `/billing` page so subscription plans appear above one-time credit packs. Default to the Annual tab (shows lower monthly price).
**Why:** Subscriptions are higher LTV; showing them first anchors the pricing conversation on recurring value. Annual default shows the lowest price point (e.g. $8.99/mo vs $9.99/mo) which improves conversion.
**Pros:** Higher LTV per acquired user; better pricing anchoring.
**Cons:** One-time buyers may take slightly longer to find their section.
**Context:** Observed (2026-03-20). Current order: Credit Packs (one-time) → Subscriptions. Toggle defaults to Monthly. Invert both.
**Effort:** XS (human: ~30 min / CC: ~5 min)
**Priority:** P1
**Depends on:** —

---

### Billing Page: Describe What Each Credit Pack Gets You
**What:** Add a plain-English description to each credit pack card explaining how many restorations it enables at each resolution tier. E.g. "10 credits — restore 10 photos at 1K, or 5 photos at 2K, or 3 photos at 4K."
**Why:** Users don't intuitively know what "1 credit" means. Concrete restoration counts make the value proposition tangible and reduce purchase hesitation.
**Pros:** Reduces friction; increases conversion; sets correct expectations.
**Cons:** Copy needs updating if credit costs change.
**Context:** Observed (2026-03-20). Currently cards just show "10 credits / $4.99 one-time" with no explanation of what the credits buy. Copy should reference the resolution tiers (1K = 1cr, 2K = 2cr, 4K = 3cr) as shown on the restore page.
**Effort:** XS (human: ~30 min / CC: ~5 min)
**Priority:** P1
**Depends on:** —

---

### Billing Page: Product Icons
**What:** Add an icon/illustration to each billing card (Starter Pack, Power Pack, Value Pack, Hobbyist, Professional). Icons are available in `public/icons/` — wire them up to the corresponding product cards.
**Why:** Icons make the pricing cards feel more differentiated and premium, consistent with the Refined Artisan design system.
**Pros:** Visual polish; brand consistency.
**Cons:** —
**Context:** Icon assets will be dropped into `public/icons/` manually. Map file names to product slugs when implementing.
**Effort:** XS (human: ~30 min / CC: ~5 min)
**Priority:** P1
**Depends on:** Icon files dropped into `public/icons/`

---

### One-Time $0.99 Single-Image Download Option
**What:** Add a "Just download this one — $0.99" option on the restore page for users who don't want to buy a credit pack. This is a single-use purchase that grants a 1K download of the current restoration only, no credits added to the account.
**Why:** There is a segment of users who will pay for their one photo but won't commit to a 10-credit pack. $0.99 captures that revenue instead of losing it to churn.
**Pros:** Captures bottom-of-funnel users; extremely low friction; higher conversion at lower price point.
**Cons:** Lower LTV per user; need a dedicated Stripe product (one-time, $0.99); need a new purchase flow that doesn't credit the account.
**Context:** Identified (2026-03-20). Requires: (1) create a $0.99 Stripe product in the Stripe dashboard; (2) add the product to `src/lib/products.ts`; (3) add a `POST /api/checkout/create-single` endpoint or extend the existing one with a `type: "single"` flag; (4) add a "Just download this one — $0.99" CTA on the restore page below "Buy credits to continue".
**Effort:** S (human: ~1 day / CC: ~15 min)
**Priority:** P1
**Depends on:** Stripe $0.99 single-download product created in dashboard first

---

## Restore Page — Transform Feature (Near-Term Backlog)

### Design Spec: Restore Page Transform UI
**What:** Full UI design for the "Transform" section on `/restore/[id]` — a collapsible accordion below the resolution picker that lets users apply AI transformation presets (Birthday Scene, Christmas Sweaters, etc.) and/or a free-form custom prompt on top of the standard restoration.
**Why:** The restore page currently only supports two restoration options (Remove Frame, Colorize). Transformations are coming in the next 1-2 sprints and the options card layout must accommodate them without a rearchitecture.
**Design decisions already made (from /plan-design-review 2026-03-21):**

```
ARCHITECTURE:
  Options card layout (right column, Sprint 8):
    1. Basic options: Remove Frame checkbox, Colorize checkbox
    2. Resolution picker: Standard/High Res/Museum
    3. Transform accordion (collapsed by default)
       ├── Trigger: "✦ Transform this photo ▸" button
       ├── Teaser: 3 portrait-ratio thumbnail teasers visible below trigger (always)
       │   Shows "+N more →" count
       └── Expanded panel (animates open 300ms ease-out):
           ├── Category chips: [Seasonal] [Fun] [Artistic] [All]
           ├── 2-wide portrait-ratio thumbnail grid (aspect-[3/4], ~72px wide)
           │   Real photo example content (not emoji/icons)
           │   Selected state: 2px solid #B5622A border, label color #9B5424
           ├── "── Or add your own ──────────────" section
           └── Textarea: bg #E8E0D4, rounded-[8px], min-h-[80px], max-h-[160px]
               char counter: text-xs JetBrains Mono, right-aligned, 200 char limit
               Placeholder changes when preset selected: "Further customize…"
    4. CTA button (dynamic label):
       "Restore this photo" — no transform selected
       "Restore & transform" — both restore options + transform
       "Transform this photo" — transform only, no restore checkboxes checked
       Label changes animate via crossfade 150ms

INTERACTION STATES:
  Accordion: collapsed → animating-open (300ms ease-out) → expanded → animating-close
  Arrow: ▸ rotates 90° to ▾ in sync with animation
  Trigger shows selected preset name when collapsed: "✦ Transform: Birthday Scene ▸"
  Thumbnails: loading (shimmer skeleton) → idle → hover (scale 1.02) → selected (amber border)
  Category chips: filter thumbnails, non-matching fade to 40% opacity
  Preset + custom prompt: BOTH allowed simultaneously (they stack/compound)

CREDIT COST: Transformations included in base resolution cost for v1 (no extra charge).

THUMBNAIL ANTI-SLOP SPEC:
  Shape: portrait rectangle aspect-[3/4], NOT circles or squares
  Content: real photo transformation examples (before/after composite)
  Size: ~72px wide × ~96px tall
  Corner: rounded-[6px]
  Label: text-[10px] font-semibold uppercase tracking-[0.1em] color #6B5D52, below thumbnail

A11Y:
  Accordion: role="button" aria-expanded aria-controls
  Thumbnail grid: role="radiogroup", each thumb role="radio" aria-checked
  Arrow key navigation within grid
  Custom prompt: aria-label, aria-describedby char counter (aria-live="polite")
  Touch targets: min 44px (category chips need min-h-[44px])

ANIMATION (see CLAUDE.md Animation section):
  Panel open: 300ms cubic-bezier(0.16, 1, 0.3, 1)
  Panel close: 300ms cubic-bezier(0.4, 0, 0.6, 1)
  Color transitions: 150ms ease-out
  Teaser thumbnails fade/scale as panel expands into full grid
  prefers-reduced-motion: all animations disabled
```

**API note:** `presetId` field already exists in `StatusResponse`. `handleStart` will need to accept `{ removeFrame, colorize, presetId?, customPrompt? }` — send both when set.
**Pros:** Puts transformation feature on solid design footing before any code is written.
**Cons:** Thumbnail assets needed (real photo examples per preset).
**Context:** Designed in /plan-design-review session 2026-03-21. Implementation on separate sprint from Sprint 8.
**Effort:** M (human: ~3 days / CC: ~45 min)
**Priority:** P2
**Depends on:** ~~Sprint 8 (source image + resolution picker) must ship first~~ ✓ Shipped in v0.3.6.0

---

### Preset Data Model — Hardcoded vs Database
**What:** Decide where transformation preset definitions live: a static `PRESETS` array in the codebase vs a database table vs a headless CMS. This determines whether adding new presets (holiday drops, seasonal themes) requires a code deploy.
**Why:** If presets are hardcoded, every new preset needs an engineer + deploy. With enough presets, this becomes a bottleneck. With a DB table or CMS, marketing can add presets without engineering.
**Pros (DB/CMS):** Marketing-speed preset updates; seasonal drops without deploys; A/B testable.
**Cons (DB/CMS):** Added complexity; DB schema change; admin UI or CMS setup.
**Context:** For v1, hardcode is fine. Before the transformation sprint, decide the target architecture so the initial implementation can be built to migrate easily. Consider: a `presets` DB table with `{ id, name, category, promptTemplate, thumbnailUrl, isActive, order }`.
**Effort:** S to decide, M to implement DB model (human: ~1 day / CC: ~20 min)
**Priority:** P2
**Depends on:** Transformation sprint planning

---

### Rolling Messages — Transformation-Aware Set
**What:** Add a second set of rolling messages (`TRANSFORMATION_MESSAGES`) shown during AI processing when `presetId` or `customPrompt` is set. Current messages are restoration-specific and will be tonally wrong for transformation jobs.
**Why:** "Matching era-accurate tones…" during a "Birthday Scene" transformation is confusing and kills the playful vibe.
**Sample transformation messages:**
  - "Setting the scene…", "Dressing everyone up…", "Adding festive cheer…",
  - "Applying the finishing touches…", "Creating the moment…", "Adding seasonal magic…",
  - "Weaving in the details…", "Transforming with care…"
**Pros:** Coherent, delightful processing experience for transformation jobs.
**Cons:** Minor additional copy; needs branching logic in the rolling message timer.
**Context:** Current `ROLLING_MESSAGES` array in `/restore/[id]/page.tsx`. Branch on `data?.presetId || data?.customPrompt` to select message set.
**Effort:** XS (human: ~30 min / CC: ~5 min)
**Priority:** P2
**Depends on:** Transformation sprint (presetId surfaced in StatusResponse)

---

### Animation Tokens in DESIGN.md
**What:** Add an `## Animation` section to `DESIGN.md` defining standard durations and easing curves. Animation is now a non-negotiable product principle (see CLAUDE.md).
**Why:** Without defined tokens, engineers will use inconsistent durations (200ms here, 400ms there) and generic easing. The animated panels, smooth scroll, and transition system will feel incoherent.
**Tokens to add:**
  - `--duration-fast: 150ms` — color/opacity transitions, button hover, state changes
  - `--duration-panel: 300ms` — accordion open/close, panel transitions, page elements appearing
  - `--ease-out-spring: cubic-bezier(0.16, 1, 0.3, 1)` — open/expand (spring-like settle)
  - `--ease-in-panel: cubic-bezier(0.4, 0, 0.6, 1)` — close/collapse (ease-in)
  - `--ease-standard: ease-out` — general transitions
**Pros:** Consistent motion feel across the entire product; one-line reference for engineers.
**Cons:** None.
**Context:** Animation principle established in /plan-design-review (2026-03-21). CLAUDE.md updated with animation rules. DESIGN.md should be the single source of truth for tokens.
**Effort:** XS (human: ~15 min / CC: ~5 min)
**Priority:** P1
**Depends on:** —

---

## P2 — Next Sprint Candidates

## P3 — Post-Launch

### Email Marketing / CRM Integration
**What:** Sync new user email addresses from the `users` table to a marketing platform (Loops.so or HubSpot) for welcome emails, retention campaigns, and win-back flows.
**Why:** Sprint 5 captures emails at sign-up (stored in DB). Without a CRM, acquired users have no lifecycle marketing — no welcome email, no nudge if they never restore a photo, no win-back if they churn.
**Pros:** Turns email capture into a retention asset; welcome sequences convert curious sign-ups into paying customers.
**Cons:** Platform selection requires evaluation (Loops.so vs HubSpot vs alternatives); requires a sync mechanism (webhook on `users.insert` or periodic DB export).
**Context:** Explicitly deferred from Sprint 5 /office-hours (2026-03-21). Research Loops.so vs HubSpot vs other options. Emails are captured in `users.email` after Sprint 5's auth-first flow. Sync strategy: call the CRM API from the `events.signIn` handler (alongside `handleSignupBonus`) or batch-sync nightly from a cron job.
**Effort:** S (human: ~1 day / CC: ~15 min)
**Priority:** P2
**Depends on:** Sprint 5 auth-first flow (users.email populated on sign-up)

---

### Subscriber Image Persistence
**What:** Preserve restored images indefinitely for active subscribers, instead of applying the universal 30-day auto-delete. When a subscription renewal event fires, reset `expiresAt` on the user's active restorations (or set it to NULL for permanent retention).
**Why:** Creates a meaningful incentive to maintain an active subscription: "Your restored photos are safe as long as you're subscribed." Increases LTV and reduces churn by tying image access to subscription status.
**Pros:** Differentiates subscription tiers from one-time purchases; high emotional value per subscriber; technically straightforward.
**Cons:** Increases Vercel Blob storage costs for long-term subscribers; requires careful handling of the Blob auto-delete lifecycle (Vercel Blob's 30-day TTL may need to be bypassed or reset).
**Context:** Mentioned by user during /office-hours (2026-03-21). Current schema already has `expiresAt` on the `restorations` table. Implementation: on `invoice.payment_succeeded` for a subscription event, extend `expiresAt` by 30 days for all active restorations for that `userId`. Or set `expiresAt = NULL` for permanent retention and manage Blob lifecycle separately. Do NOT apply to one-time credit purchases — persistence is a subscriber benefit only.
**Effort:** S (human: ~1 day / CC: ~15 min)
**Priority:** P2
**Depends on:** Stable subscription renewal webhook (already implemented in v0.3.0.0); Sprint 5 profile page (users need a place to see persistent images)

---

### Guest Resolution Upgrade Path ($0.99 → 2K/4K Upsell)
**What:** After a guest downloads their $0.99 1K restoration, give them a path to upgrade to 2K or 4K without losing their restoration. Flow: "Want higher resolution? Create an account → buy a credit pack → hi-res restoration fires for the same restorationId."
**Why:** The $0.99 buyer is the warmest possible lead for a credit pack upgrade — they've already paid, they've already seen their result, and they care about this specific photo. This is the highest-intent upsell moment in the product.
**Pros:** Converts the lowest-friction entry point (guest $0.99) into the highest-LTV path (subscription or pack). No new cold acquisition needed.
**Cons:** Requires linking an anonymous restoration to a newly-created user account after the fact; the restorationId → userId backfill is non-trivial and must not break existing access controls.
**Context:** Identified during /plan-eng-review (2026-03-21). Sprint 4 adds a placeholder copy line below the download button ("Want higher resolution? Create an account to unlock 2K and 4K") but does not implement the actual upgrade flow. The restorationId is preserved in the session — the upgrade flow needs to associate it with the new user account at account-creation time. Do NOT overwrite userId on an existing guest restoration without a careful migration — it would lock the guest out of their existing URL.
**Effort:** S (human: ~1 day / CC: ~15 min)
**Priority:** P2
**Depends on:** Stable guest checkout flow (Sprint 4); account creation flow in place

---

### Physical Print Ordering Integration
**What:** After download, CTA to order the restored photo as a print, canvas, or photo book page via Printful or Prodigi API.
**Why:** Purchase intent peaks right at the download moment. High-margin, zero-inventory revenue stream. Each physical product is a brand advertisement with the logo on the back.
**Pros:** Additional revenue stream with high emotional fit; word-of-mouth via physical product.
**Cons:** Fulfillment dependency, returns policy needed, print quality QA across partner printers.
**Context:** Deferred from v1 CEO review (2026-03-18). Core digital product must be stable and generating revenue before adding fulfillment complexity. Evaluate Printful vs Prodigi based on print quality and API maturity.
**Effort:** M (human: ~3 days / CC: ~25 min)
**Priority:** P2
**Depends on:** Stable core product with paying users, print partner selected and tested

---

### Genealogy Platform Integrations (Ancestry, FamilySearch, MyHeritage)
**What:** 'Save to Ancestry' / 'Save to FamilySearch' buttons post-restore. Restored photo pushes directly into user's family tree on partner platforms.
**Why:** Ancestry has 4M+ paying subscribers who are the exact target demographic. Integration = distribution partnership. Photos appearing in family trees drive referral virality (cousin sees it, clicks through).
**Pros:** Best available distribution channel; photos in family trees are viral by nature.
**Cons:** API access and partnership terms take time; some platforms may not have open APIs or may require business agreements.
**Context:** Deferred from v1 CEO review (2026-03-18). Build the integration hooks in the codebase early; flip the switch when partnership is secured. Priority is getting traffic metrics first to strengthen the partnership pitch.
**Effort:** M (human: ~2 days for integration / CC: ~20 min; partnership negotiation is separate)
**Priority:** P2
**Depends on:** Meaningful traffic/revenue metrics to present to partners; API access approval from each platform

---

### Referral Program — Refer a Friend, Get Credits
**What:** Every user gets a unique referral link. When a referred user makes their first purchase, the referrer earns bonus credits (e.g., 2 free restorations).
**Why:** Referral is the highest-ROI acquisition channel for consumer products with strong emotional outcomes. A restored family photo is inherently shareable.
**Pros:** Viral coefficient multiplier; self-funding (bonus credits only issued when referral converts); aligns incentives.
**Cons:** Fraud potential (fake accounts generating fake referrals); needs rate limiting and fraud detection logic.
**Context:** Deferred from v1 CEO review (2026-03-18). Design referral to require verified email + first real purchase to trigger reward — prevents most abuse.
**Effort:** M (human: ~2 days / CC: ~20 min)
**Priority:** P2
**Depends on:** Stable user + credit system; email verification flow in place

---

### Completion Email for Anonymous Users
**What:** At purchase, prompt anonymous users for an optional email address. After restoration completes (status = "complete"), send the download link to that address via Resend — no account required.
**Why:** Anonymous users are a significant top-of-funnel segment and currently have no fallback if they close the tab after purchasing. The photo is stored for 30 days; without an email link, it's effectively lost.
**Pros:** Captures revenue from users unwilling to create accounts; dramatically reduces "I lost my photo" support requests.
**Cons:** Requires storing the email on the restoration record and adding validation at purchase; increases Resend send volume for unverified addresses.
**Context:** Identified during /plan-eng-review (2026-03-20). The restoration pipeline sends email only when userId is non-null. Anonymous purchases set status = "complete" silently. Implement by adding an optional `notificationEmail` field to the purchase endpoint body and storing it on the restorations record.
**Effort:** S (human: ~1 day / CC: ~15 min)
**Priority:** P2
**Depends on:** Stable email flow for authenticated users (completed in restoration pipeline PR)

---

### Rate Limiting on Public API Endpoints
**What:** Add rate limiting to `POST /api/checkout/create-single` and `POST /api/restore/[id]/start` — both are intentionally public (no auth required) and currently have no abuse protection.
**Why:** A bad actor could spam `create-single` to generate hundreds of Stripe Checkout sessions (no charge until they pay, but clutters the Stripe dashboard and wastes DB writes). `start` could be used to repeatedly trigger kie.ai restoration jobs using someone else's restorationId URL.
**Pros:** Protects Stripe dashboard cleanliness; prevents unauthorized compute burn on kie.ai at scale; standard production hygiene for public endpoints.
**Cons:** Rate limiting adds complexity (Redis or edge config); for 5–10 users this weekend, it's premature. Revisit when traffic is measurable.
**Context:** Identified during /plan-eng-review (2026-03-21). Both endpoints are intentionally unauthenticated by design (zero-friction is the value prop). Rate limiting should be added at the edge (Vercel middleware or Upstash ratelimit) rather than at the endpoint level. Implement as: N requests per IP per minute, with a clear `429 Too Many Requests` response.
**Effort:** XS (human: ~2 hrs / CC: ~5 min)
**Priority:** P3
**Depends on:** Meaningful traffic in production to set realistic rate limits

---

### kie.ai Retry Discrimination: 4xx vs 5xx
**What:** In `/api/jobs/restore` and `/api/jobs/restore-hires`, distinguish permanent kie.ai errors (inner code 402 = insufficient credits, 401 = bad API key) from transient errors (5xx = kie.ai downtime). On permanent errors, return 200 so QStash stops retrying and immediately fires the failure path.
**Why:** `createKieTask()` now throws on any non-200 inner code, so QStash retries all failures. But retrying a 402 (out of credits) wastes 3 API calls before the job dies — and leaves the user waiting. Faster failure detection = better UX.
**Pros:** Prevents wasted API calls and credit usage on permanent errors; faster failure detection post-launch.
**Cons:** Requires kie.ai's inner status codes to be reliable in production — not yet verified under real load.
**Context:** Inner json.code validation was added in feat/restoration-pipeline (2026-03-20). The remaining work is teaching the job routes to classify which codes are permanent vs transient. Revisit once we have real production error data from kie.ai callbacks.
**Effort:** XS (human: ~1 hr / CC: ~5 min)
**Priority:** P3
**Depends on:** Stable kie.ai API with predictable inner status codes in production

---

### Orphaned Blob Cleanup Job
**What:** A periodic job (cron or manual trigger) that lists Vercel Blob objects under `originals/` and cross-references them against the `restorations` table. Any blob with no corresponding DB record (or with a DB record at status="failed") older than 48 hours is deleted.
**Why:** When `qstash.publishJSON()` fails after a blob upload, the original image file is uploaded to Vercel Blob but the restoration is marked "failed". Over time these orphaned files accumulate and cost storage money (small but nonzero).
**Pros:** Keeps storage clean; prevents runaway costs at scale; blob storage cleanup is idempotent and safe.
**Cons:** Requires Vercel Blob list() pagination across potentially many objects; need to be careful not to delete blobs for very recent restorations still in-flight.
**Context:** Identified during /plan-eng-review (2026-03-20). The fix for QStash publish failure (upload route) correctly marks the restoration as "failed", but the blob file is still orphaned. Implement as a Next.js route handler protected by cron auth (`CRON_SECRET`), or as a Vercel cron job triggered daily. Cross-reference: `Blob.list({ prefix: "originals/" })` vs `db.select({ inputBlobUrl }).from(restorations)`.
**Effort:** S (human: ~1 day / CC: ~15 min)
**Priority:** P3
**Depends on:** Stable core product in production; meaningful upload volume to justify the cleanup overhead

---

### Developer API
**What:** Public REST API allowing photography studios, print shops, and genealogy services to integrate photo restoration into their own products. Per-call or subscription pricing for API access.
**Why:** B2B revenue channel with much higher LTV per customer than consumer. API customers bring their own distribution.
**Pros:** Opens B2B market; studios/shops have recurring high-volume needs that justify subscription.
**Cons:** API versioning, documentation, SLAs, and support burden.
**Context:** Surfaced during v1 CEO review (2026-03-18). Not surfaced as cherry-pick — deferred for post-launch.
**Effort:** L (human: ~1 week / CC: ~1 hour)
**Priority:** P3
**Depends on:** Proven product quality; stable internal API that can be exposed externally

---

### Family Album / Shared Gallery
**What:** Users can organize restored photos into named albums and share a read-only gallery link with family members.
**Why:** Increases retention (users come back to see and manage their collection) and drives word-of-mouth (sharing a gallery link is a referral).
**Pros:** Retention feature; natural referral mechanism.
**Cons:** Significant UX scope; storage complexity.
**Context:** Surfaced during v1 CEO review (2026-03-18). Part of the 10x platform vision. Build after proving single-photo restore.
**Effort:** L (human: ~2 weeks / CC: ~1.5 hours)
**Priority:** P3
**Depends on:** Stable user accounts; image storage system proven at scale

---

## Completed

### Sprint 8 — Restore Page + Home Page Polish (v0.3.6.0 — 2026-03-21)
**Completed:** v0.3.6.0 (2026-03-21)

Source image preview in the isReady restore flow (two-column layout with source photo left, options right). ResolutionPicker component extracted with credit-based disabled states (1K=1cr, 2K=2cr, 4K=3cr) and balance loading/error states. Favicons wired via Next.js metadata icons. Home page "Decades of damage, undone" section converted from film strip to 2×2 / 1×4 grid matching ColorizeRow layout. Step 03 copy updated to describe auth-first + 2 free credits flow. 296 tests passing.

---

### WCAG 2.1 AA Compliance — Sprint 7 (v0.3.5.0 — 2026-03-21)
**Completed:** v0.3.5.0 (2026-03-21)

Full WCAG 2.1 AA audit across all 5 core pages (`/`, `/billing`, `/restore/[id]`, `/studio`, `/account`): color tokens migrated to warm archival palette (`#9B5424` at 5.3:1, `#6B5D52` at 5.8:1); button primary variant locked to cognac amber; ADA compliance practice permanently codified in CLAUDE.md. Avatar dropdown with WAI-ARIA menu button pattern (`role="menu"`, `aria-expanded`, Escape → focus-return), initials fallback, photo error recovery. Mobile nav drawer with `role="dialog"`, `aria-modal="true"`, WCAG-compliant focus trap, Escape handler, and hamburger race condition fix. BeforeAfterSlider height capped (`min-h-[200px]`, `max-h-[80vh]`), both images use `object-contain` for symmetric comparison. 285 tests passing. Covers both the "ADA / Accessibility Audit" and "Avatar Dropdown — Google Profile Photo + Sign-Out Menu" P2 items.

---

### kie.ai Webhook Security + Failure Handling
**Completed:** feat/restoration-pipeline (2026-03-20)

Full kie.ai webhook hardening: (1) HMAC-SHA256 verification — `X-Webhook-Timestamp` + `X-Webhook-Signature` headers via `base64(HMAC-SHA256(taskId + "." + timestamp, webhookHmacKey))`; (2) ±5 min timestamp window to prevent replay attacks; (3) `data.state="fail"` handling — marks restoration as `"failed"` and returns 200 so kie.ai stops retrying (previously left restorations permanently stuck at "analyzing"); (4) inner `json.code` validation in `createKieTask()` — HTTP 200 with code=402 now throws descriptively. 174 tests passing.

---

### Billing UI, Resolution Picker + Analytics (v0.3.1.0 — 2026-03-19)
**Completed:** v0.3.1.0 (2026-03-19)

`/billing` page with credit pack and subscription cards (monthly/annual toggle), resolution picker on the restore page (1k/2k/4k with live credit cost), `POST /api/billing/portal` Customer Portal endpoint, and Vercel Analytics. The full purchase experience — from browsing plans through checkout to subscription management — is now accessible to users.

---

### QA Fixes — Auth Route, Error States, UUID Validation (2026-03-19)
**Completed:** /qa run on feat/scaffold (2026-03-20)

Four bugs found and fixed: (1) missing NextAuth API route caused all auth to fail silently; (2) restore page heading stuck on "Loading…" when an error occurred; (3) upload API returned 500 instead of 400 for malformed requests; (4) status/purchase routes returned 500 on non-UUID IDs. Health score 72 → 87. All 93 tests passing.

---

### Stripe Checkout + Credit Purchase Flow (v0.3.0.0 — 2026-03-19)
**Completed:** v0.3.0.0 (2026-03-19)

`POST /api/checkout/create`, `POST /api/restore/[id]/purchase`, `invoice.payment_succeeded` webhook handler, `src/lib/products.ts` product registry, and `resolution` column on `restorations`. 93 tests passing. The full payment funnel — from "Use Credits" / "Buy Credits" CTAs through Stripe Checkout to monthly subscription renewal — is now wired.
