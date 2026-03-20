import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

// ─── DB Connection ────────────────────────────────────────────────────────────
// Connection pool is owned here, not in schema.ts. schema.ts is pure table defs.

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });

// Re-export everything from schema for convenient single-import access
export * from "./schema";

// Re-export commonly used Drizzle query helpers
export { eq, and, or, desc, asc, sql, inArray } from "drizzle-orm";
