import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookie } from "@/lib/auth";
import axios from "axios";

const COZE_UPLOAD_URL = "https://api.coze.cn/v1/files/upload";

export async function POST(req: NextRequest) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });

  try {
    const formData = await req.formData();
    const response = await axios.post(COZE_UPLOAD_URL, formData, {
      headers: {
        Authorization: authHeader,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const data = response.data;
    if (data.code !== undefined && data.code !== 0) {
      return NextResponse.json(
        { code: data.code, msg: data.msg || "Upload failed" },
        { status: 400 }
      );
    }
    return NextResponse.json({ code: 0, data: data.data || data });
  } catch (err: unknown) {
    const ax = err as { response?: { data?: unknown; status?: number } };
    const status = ax.response?.status ?? 500;
    const body = ax.response?.data ?? { error: "Upload failed" };
    return NextResponse.json(body, { status });
  }
}
