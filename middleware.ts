import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-super-secret-key-change-in-production"
);

const COOKIE_NAME = "coze-batch-token";
const publicPaths = ["/", "/login", "/register"];
const adminPaths = ["/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  // 已登录用户访问登录/注册页 → 强制跳到 dashboard 或 admin，避免死循环
  if (publicPaths.some((p) => pathname === p) && token) {
    try {
      const { payload } = await jose.jwtVerify(token, JWT_SECRET);
      const role = (payload as { role?: string }).role;
      const dest = role === "admin" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    } catch {
      // token 无效，放行到登录页
    }
  }

  if (publicPaths.some((p) => pathname === p)) return NextResponse.next();

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    const role = (payload as { role?: string }).role;

    if (adminPaths.some((p) => pathname.startsWith(p))) {
      if (role !== "admin") return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  // 不匹配 api、静态资源，确保 API 能正常 Set-Cookie，且 Cookie 对全站 path 生效
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
