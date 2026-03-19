import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  json,
} from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const creditTypeEnum = pgEnum("credit_type", [
  "purchase",
  "spend",
  "refund",
  "award",
  "subscription_grant",
]);

export const restorationStatusEnum = pgEnum("restoration_status", [
  "analyzing",
  "watermarking",
  "pending_payment",
  "processing",
  "complete",
  "failed",
  "refunded",
]);

export const batchJobStatusEnum = pgEnum("batch_job_status", [
  "pending",
  "processing",
  "partial",
  "complete",
  "failed",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name"),
  image: text("image"),
  googleId: text("google_id").unique(),
  role: userRoleEnum("role").default("user").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// NextAuth adapter tables
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").unique().notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
});

export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: creditTypeEnum("type").notNull(),
  description: text("description"),
  idempotencyKey: text("idempotency_key").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  restorationId: uuid("restoration_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const restorations = pgTable("restorations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  presetId: text("preset_id").notNull(),
  status: restorationStatusEnum("status").default("analyzing").notNull(),
  inputBlobUrl: text("input_blob_url"),
  outputBlobUrl: text("output_blob_url"),
  watermarkedBlobUrl: text("watermarked_blob_url"),
  eraEstimate: text("era_estimate"),
  eraConfidence: real("era_confidence"),
  kieAiJobId: text("kie_ai_job_id"),
  idempotencyKey: text("idempotency_key").unique(),
  creditsCharged: integer("credits_charged").default(1).notNull(),
  batchJobId: uuid("batch_job_id"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const batchJobs = pgTable("batch_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: batchJobStatusEnum("status").default("pending").notNull(),
  restorationIds: json("restoration_ids").$type<string[]>().default([]),
  totalCount: integer("total_count").notNull(),
  completeCount: integer("complete_count").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  qstashJobId: text("qstash_job_id"),
  zipBlobUrl: text("zip_blob_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gifts = pgTable("gifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderUserId: uuid("sender_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  recipientEmail: text("recipient_email").notNull(),
  message: text("message"),
  restorationId: uuid("restoration_id")
    .notNull()
    .references(() => restorations.id, { onDelete: "cascade" }),
  downloadToken: text("download_token").unique().notNull(),
  downloadTokenExpiresAt: timestamp("download_token_expires_at"),
  emailSentAt: timestamp("email_sent_at"),
  downloadedAt: timestamp("downloaded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeSubscriptionId: text("stripe_subscription_id").unique().notNull(),
  status: subscriptionStatusEnum("status").notNull(),
  creditsPerMonth: integer("credits_per_month").notNull(),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const presets = pgTable("presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  prompt: text("prompt"),
  creditsCost: integer("credits_cost").default(1).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── DB Instance ─────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool);
