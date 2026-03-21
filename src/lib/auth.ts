import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, verificationTokens } from "@/lib/db";
import { eq } from "drizzle-orm";
import { handleSignupBonus } from "@/lib/auth-events";

export const { auth, signIn, signOut, handlers } = NextAuth({
  // Pass explicit table references so DrizzleAdapter uses our custom schema
  // ("users" table, uuid PK, etc.) instead of its own internal defaults
  // ("user" table with composite PK). Without this, createUser() fails and
  // NextAuth returns ?error=Configuration on every OAuth attempt.
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    // sessionsTable omitted intentionally — JWT strategy stores sessions in
    // cookies, not the database, so this table is never touched at runtime.
    // Our sessions table has a custom uuid PK which doesn't match the
    // adapter's DefaultPostgresSessionsTable type (expects sessionToken as PK).
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  events: {
    /**
     * Fires on every sign-in (new and returning users).
     * handleSignupBonus() is idempotent — the unique idempotency key ensures
     * the 2 credits are only awarded once, ever, per user.
     */
    async signIn({ user }) {
      if (user.id) {
        await handleSignupBonus(user.id);
      }
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      if (token?.role) {
        (session.user as typeof session.user & { role: string }).role =
          token.role as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        // Fetch role from DB on sign-in
        const [dbUser] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        if (dbUser) {
          token.role = dbUser.role;
        }
      }
      return token;
    },
    authorized() {
      // Auth happens at purchase, not upload — allow all public access
      return true;
    },
  },
});
