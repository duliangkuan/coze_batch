import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAuthFromCookie } from "@/lib/auth";

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/** Allow all common types: Images, Videos, PDFs, Docs (client-side upload, no 4.5MB limit) */
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
  try {
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
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          error:
            "Content-Type must be application/json. Use upload() from @vercel/blob/client with handleUploadUrl.",
        },
        { status: 400 }
      );
    }

    const raw = await request.text();
    if (!raw || !raw.trim()) {
      return NextResponse.json(
        { error: "Request body is empty. Use upload() from @vercel/blob/client." },
        { status: 400 }
      );
    }
    try {
      body = JSON.parse(raw) as HandleUploadBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body. Ensure the client uses upload() from @vercel/blob/client." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || !("type" in body)) {
      return NextResponse.json(
        { error: "Invalid upload payload: missing type. Use upload() from @vercel/blob/client." },
        { status: 400 }
      );
    }

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
        console.log("Blob uploaded", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Upload API error", error);
    return NextResponse.json(
      { error: (error as Error).message || "Upload failed" },
      { status: 400 }
    );
  }
}
