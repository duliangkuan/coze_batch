import { NextResponse } from "next/server";
import { getAuthFromCookie } from "@/lib/auth";

export async function GET() {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    role: auth.role,
    userId: auth.userId ?? null,
  });
}
