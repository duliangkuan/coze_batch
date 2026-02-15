import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookie } from "@/lib/auth";
import axios from "axios";

const COZE_RUN_URL = "https://api.coze.cn/v1/workflow/run";

export async function POST(req: NextRequest) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });

  try {
    const body = await req.json();
    const { workflow_id, parameters } = body as { workflow_id?: string; parameters?: Record<string, unknown> };
    if (!workflow_id) return NextResponse.json({ error: "Missing workflow_id" }, { status: 400 });

    const response = await axios.post(
      COZE_RUN_URL,
      { workflow_id, parameters: parameters || {} },
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      }
    );

    const result = response.data as { code?: number; data?: unknown; msg?: string };

    // 智能双重解析：Coze 返回 Variable 时 data 常为 JSON 字符串
    if (result.data != null && typeof result.data === "string") {
      const raw = result.data;
      const trimmed = raw.trim();
      if (trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          return NextResponse.json({
            ...result,
            data: parsed,
            raw_data: raw,
          });
        } catch {
          // 解析失败则保留原字符串在 data，raw_data 便于调试
          return NextResponse.json({ ...result, data: raw, raw_data: raw });
        }
      }
      // 纯文本字符串：保持 data 不变，可选保留 raw_data
      return NextResponse.json({ ...result, data: raw, raw_data: raw });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: unknown; status?: number } };
    const status = ax.response?.status ?? 500;
    const body = ax.response?.data ?? { error: "Run failed" };
    return NextResponse.json(body, { status });
  }
}
