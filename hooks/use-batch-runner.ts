"use client";

import { useState, useCallback } from "react";

export type RowStatus = "idle" | "running" | "success" | "error";

export interface ProjectConfig {
  workflowId: string;
  inputSchema: { key: string; type: string }[];
  outputSchema: { key: string; path: string; type: string }[];
}

export interface RunnerRow {
  [key: string]: unknown;
  status?: RowStatus;
  errorMessage?: string;
}

/** 常见 Coze/Variable 返回的 key，用于兜底 */
const FALLBACK_KEYS = ["output", "result", "content", "answer", "data"];

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let val: unknown = obj;
  for (const p of parts) {
    val = (val as Record<string, unknown>)?.[p];
  }
  return val;
}

function resolveOutputValue(
  resultData: Record<string, unknown>,
  path: string
): string {
  let val = getByPath(resultData, path);
  if (val != null && val !== "") {
    return typeof val === "object" ? JSON.stringify(val) : String(val);
  }
  // 按 path 找不到时：尝试常见 key
  for (const key of FALLBACK_KEYS) {
    const v = resultData[key];
    if (v != null && v !== "") {
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    }
  }
  // 仍无则展示整个对象，确保不空白
  return JSON.stringify(resultData);
}

export function useBatchRunner(
  getToken: () => string | null,
  updateRow: (index: number, updates: Partial<RunnerRow>) => void,
  onComplete?: () => void
) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const runBatch = useCallback(
    async (rows: RunnerRow[], projectConfig: ProjectConfig) => {
      const token = getToken();
      if (!token) return;

      setIsRunning(true);
      setCurrentIndex(0);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.status === "success") continue;

        try {
          updateRow(i, { status: "running" });
          setCurrentIndex(i);

          const parameters: Record<string, unknown> = {};
          for (const col of projectConfig.inputSchema) {
            const val = row[col.key];
            if (val !== undefined && val !== null && val !== "") {
              parameters[col.key] = val;
            }
          }

          const res = await fetch("/api/proxy/run", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              workflow_id: projectConfig.workflowId,
              parameters,
            }),
          });

          const json = await res.json();

          if (json.code === 0 && json.data != null) {
            let resultData = json.data;
            if (typeof resultData === "string") {
              try {
                resultData = JSON.parse(resultData) as Record<string, unknown>;
              } catch {
                resultData = { raw: resultData } as Record<string, unknown>;
              }
            }
            const dataObj =
              resultData != null && typeof resultData === "object" && !Array.isArray(resultData)
                ? (resultData as Record<string, unknown>)
                : { value: resultData };
            const outputUpdates: Record<string, unknown> = { status: "success" };
            for (const out of projectConfig.outputSchema) {
              outputUpdates[out.key] = resolveOutputValue(dataObj, out.path);
            }
            updateRow(i, outputUpdates);
          } else {
            throw new Error(json.msg || json.message || "Unknown error");
          }
        } catch (err) {
          updateRow(i, {
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
          });
        }

        await new Promise((r) => setTimeout(r, 200));
      }

      setIsRunning(false);
      setCurrentIndex(0);
      onComplete?.();
    },
    [getToken, updateRow, onComplete]
  );

  return { runBatch, isRunning, currentIndex };
}
