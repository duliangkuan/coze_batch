import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, setAuthCookie } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body as { username?: string; password?: string };

    if (!password?.trim()) {
      return NextResponse.json(
        { success: false, message: "请输入密码" },
        { status: 400 }
      );
    }

    const adminPassword = process.env.ADMIN_PASSWORD || "admin888";

    // God Mode: 密码匹配管理员
    if (password === adminPassword) {
      const token = await signToken({ role: "admin" });
      await setAuthCookie(token);
      return NextResponse.json({
        success: true,
        role: "admin",
        message: "God Mode 已启用",
      });
    }

    // 普通用户: 查库
    if (!username?.trim()) {
      return NextResponse.json(
        { success: false, message: "请输入用户名" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
    });

    if (!user || user.status !== 1) {
      return NextResponse.json(
        { success: false, message: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { success: false, message: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const token = await signToken({ role: "user", userId: user.id });
    await setAuthCookie(token);
    return NextResponse.json({
      success: true,
      role: "user",
      userId: user.id,
      message: "登录成功",
    });
  } catch (e) {
    console.error("Login error", e);
    return NextResponse.json(
      { success: false, message: "服务器错误" },
      { status: 500 }
    );
  }
}
