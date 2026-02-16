/**
 * cURL 解析器 - 从 Coze 请求中提取 parameters 并生成 Input Schema
 * 参考 PRD Part 7 金手指实现
 */
export interface InputSchemaItem {
  key: string;
  label: string;
  type: "text" | "file";
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
    return Object.keys(params).map((key) => {
      const value = params[key];
      const type = isFileUrl(value) ? ("file" as const) : ("text" as const);
      return { key, label: key, type };
    });
  } catch (e) {
    console.error("Parse cURL failed", e);
    return [];
  }
}

export interface OutputSchemaItem {
  key: string;
  path: string;
  label: string;
  type: "text" | "file" | "link";
}

/** 嗅探：字符串是否为带已知文件后缀的 URL，自动识别为 File 类型（含 query 的 URL 按 pathname 判断） */
const FILE_EXT_REGEX = /\.(png|jpg|jpeg|gif|webp|mp4|mov|webm|pdf|doc|docx|xls|xlsx|csv|txt|md)(\?|$)/i;

function isFileUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    return FILE_EXT_REGEX.test(new URL(s).pathname);
  } catch {
    return FILE_EXT_REGEX.test(s);
  }
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return /^https?:\/\//i.test(s);
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
      let type: "text" | "file" | "link" = "text";
      if (typeof value === "string" && value.trim()) {
        if (isFileUrl(value)) type = "file";
        else if (isHttpUrl(value)) type = "link";
      }
      return { key, path, label: path, type };
    });
  } catch (e) {
    console.error("Parse response JSON failed", e);
    return [];
  }
}
