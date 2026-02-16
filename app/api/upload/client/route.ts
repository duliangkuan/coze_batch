import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAuthFromCookie } from "@/lib/auth";

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/** 允许的 MIME 类型：支持 File/Media 统一类型（图片、视频、文档等） */
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/x-icon",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/ogg",
  "video/x-msvideo",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/html",
  "application/octet-stream",
];

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is not set");
    return NextResponse.json(
      { error: "Server upload is not configured (missing BLOB_READ_WRITE_TOKEN)" },
      { status: 503 }
    );
  }

  const auth = await getAuthFromCookie();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, _clientPayload) => {
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: auth.userId ?? auth.role }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Blob uploaded:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Client upload handleUpload error", error);
    return NextResponse.json(
      { error: (error as Error).message || "Upload failed" },
      { status: 400 }
    );
  }
}
