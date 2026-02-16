import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getAuthFromCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "缺少 file 字段或非文件" }, { status: 400 });
    }

    const blob = await put(file.name, file, { access: "public" });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("Upload error", err);
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}
