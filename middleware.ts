import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-super-secret-key-change-in-production"
);

const publicPaths = ["/", "/login", "/register"];
const adminPaths = ["/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (publicPaths.some((p) => pathname === p)) return NextResponse.next();

  const token = req.cookies.get("coze-batch-token")?.value;
  if (!token) {
    const login = new URL("/login", req.url);
    return NextResponse.redirect(login);
  }

  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    const role = (payload as { role?: string }).role;

    if (adminPaths.some((p) => pathname.startsWith(p))) {
      if (role !== "admin") return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  } catch {
    const login = new URL("/login", req.url);
    return NextResponse.redirect(login);
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
