import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBalance } from "@/lib/credits";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ balance: 0 });
  }

  try {
    const balance = await getBalance(userId);
    return NextResponse.json({ balance });
  } catch (err) {
    console.error("[GET /api/credits/balance]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
