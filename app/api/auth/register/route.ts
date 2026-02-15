import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body as { username?: string; password?: string };

    if (!username?.trim()) {
      return NextResponse.json({ error: "请输入用户名" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { username: username.trim() },
    });
    if (existing) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        passwordHash,
      },
    });

    return NextResponse.json({
      success: true,
      userId: user.id,
      message: "注册成功，请登录",
    });
  } catch (e) {
    console.error("Register error", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
