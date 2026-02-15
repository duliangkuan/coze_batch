/**
 * inputSchema / outputSchema 在 DB 中存为 JSON 字符串 (兼容 SQLite)。
 * 读写时在此做序列化/反序列化，保证 API 仍返回对象、前端无感知。
 */

export function parseSchema<T = unknown>(value: string | T): T {
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return [] as unknown as T;
  }
}

export function stringifySchema(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? []);
}
