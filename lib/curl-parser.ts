/**
 * cURL 解析器 - 从 Coze 请求中提取 parameters 并生成 Input Schema
 * 参考 PRD Part 7 金手指实现
 */
export interface InputSchemaItem {
  key: string;
  label: string;
  type: "text" | "image";
}

/** 从 cURL 中解析出的额外元数据 */
export interface CurlMetadata {
  workflowId?: string;
  apiToken?: string;
}

const BEARER_REGEX = /Authorization:\s*Bearer\s+([a-zA-Z0-9_\-\.]+)/i;

/**
 * 从 cURL 字符串中提取 Workflow ID 和 API Token（若存在）
 */
export function parseCurlMetadata(curl: string): CurlMetadata {
  const out: CurlMetadata = {};
  try {
    const dataMatch = curl.match(/(?:-d|--data)\s+(['"])([\s\S]*?)\1/);
    if (dataMatch?.[2]) {
      let jsonString = dataMatch[2].replace(/\\n/g, "");
      const parsed = JSON.parse(jsonString) as Record<string, unknown>;
      const wfId = parsed.workflow_id ?? parsed.workflowId;
      if (typeof wfId === "string" && wfId.trim()) out.workflowId = wfId.trim();
    }
  } catch {
    // ignore
  }
  const bearerMatch = curl.match(BEARER_REGEX);
  if (bearerMatch?.[1]) out.apiToken = bearerMatch[1];
  return out;
}

export function parseCurlCommand(curl: string): InputSchemaItem[] {
  try {
    const dataMatch = curl.match(/(?:-d|--data)\s+(['"])([\s\S]*?)\1/);
    if (!dataMatch || !dataMatch[2]) {
      throw new Error("No JSON data found in cURL");
    }

    let jsonString = dataMatch[2];
    jsonString = jsonString.replace(/\\n/g, "");
    const parsed = JSON.parse(jsonString) as Record<string, unknown>;

    if (!parsed.parameters || typeof parsed.parameters !== "object") {
      return Object.keys(parsed).map((key) => ({
        key,
        label: key,
        type: "text" as const,
      }));
    }

    const params = parsed.parameters as Record<string, unknown>;
    return Object.keys(params).map((key) => ({
      key,
      label: key,
      type: "text" as const,
    }));
  } catch (e) {
    console.error("Parse cURL failed", e);
    return [];
  }
}

export interface OutputSchemaItem {
  key: string;
  path: string;
  label: string;
  type: "text" | "image" | "link" | "video";
}

function isUrlLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (!value.startsWith("http")) return false;
  const lower = value.toLowerCase();
  return /\.(png|jpg|jpeg|gif|webp|mp4|webm)(\?|$)/i.test(lower) || lower.includes("image") || lower.includes("video");
}

function flattenKeys(obj: unknown, prefix = ""): { path: string; value: unknown }[] {
  const out: { path: string; value: unknown }[] = [];
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== "object") {
    out.push({ path: prefix || "data", value: obj });
    return out;
  }
  const rec = obj as Record<string, unknown>;
  if (Array.isArray(rec)) {
    out.push({ path: prefix || "data", value: rec });
    return out;
  }
  for (const key of Object.keys(rec)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const val = rec[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val) && key !== "data" && key !== "content") {
      out.push(...flattenKeys(val, fullPath));
    } else {
      out.push({ path: fullPath, value: val });
    }
  }
  return out;
}

/**
 * 规范化 data：若为 JSON 字符串（如 Coze Variable 返回）则二次解析
 */
function normalizeDataPayload(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
        return { data: parsed };
      } catch {
        return { data: raw };
      }
    }
    return { data: raw };
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return { data: raw };
}

/**
 * 从 JSON 响应字符串解析出输出列 Schema。
 * 支持 data 为双重编码的 JSON 字符串（如 {"code":0,"data":"{\"output\":\"...\"}"}）。
 */
export function parseResponseToSchema(jsonString: string): OutputSchemaItem[] {
  try {
    const parsed = JSON.parse(jsonString) as Record<string, unknown>;
    const rawData = parsed.data ?? parsed.content ?? parsed;
    const data = normalizeDataPayload(rawData);
    const items = flattenKeys(data);
    return items.map(({ path, value }) => {
      const key = path.replace(/\./g, "_");
      let type: "text" | "image" | "link" | "video" = "text";
      if (isUrlLike(value)) {
        const s = String(value);
        if (/\.(mp4|webm|mov|ogg)(\?|$)/i.test(s)) type = "video";
        else if (/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(s)) type = "image";
        else type = "link";
      }
      return { key, path, label: path, type };
    });
  } catch (e) {
    console.error("Parse response JSON failed", e);
    return [];
  }
}
