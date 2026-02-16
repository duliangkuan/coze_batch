import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAuthFromCookie } from "@/lib/auth";

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
// 放宽类型限制，支持所有常见文件（File/Media 统一类型）
const ALLOWED_TYPES = [
  "image/*",
  "video/*",
  "audio/*",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/octet-stream",
];

export async function POST(req: NextRequest) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: MAX_SIZE_BYTES,
        addRandomSuffix: true,
      }),
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Client upload handleUpload error", err);
    return NextResponse.json(
      { error: (err as Error).message || "上传失败" },
      { status: 400 }
    );
  }
}
