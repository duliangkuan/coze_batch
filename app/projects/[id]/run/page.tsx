"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUploadCell, MediaPreviewDialog, isVideoUrl, isMediaUrl } from "@/components/runner/file-cell";
import { useBatchRunner, type RunnerRow, type ProjectConfig } from "@/hooks/use-batch-runner";
import { Play, Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

type InputSchemaItem = { key: string; label: string; type: string };
type OutputSchemaItem = { key: string; path: string; label: string; type: string };

export default function ProjectRunPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [project, setProject] = useState<{
    id: string;
    name: string;
    workflowId: string;
    apiToken: string | null;
    inputSchema: InputSchemaItem[];
    outputSchema: OutputSchemaItem[];
  } | null>(null);
  const [rows, setRows] = useState<RunnerRow[]>([]);
  const [cozeToken, setCozeToken] = useState("");
  const [loading, setLoading] = useState(true);
  const rowsRef = useRef<RunnerRow[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const getToken = useCallback(() => {
    return cozeToken.trim() || project?.apiToken || null;
  }, [cozeToken, project?.apiToken]);

  const updateRow = useCallback((index: number, updates: Partial<RunnerRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }, []);

  const downloadResults = useCallback(() => {
      const finalRows = rowsRef.current;
      if (!project || !finalRows.length) return;
      const inputCols = project.inputSchema as InputSchemaItem[];
      const outputCols = project.outputSchema as OutputSchemaItem[];
      const headers = [
        "状态",
        ...inputCols.map((c) => c.label || c.key),
        ...outputCols.map((c) => c.label || c.key),
      ];
      const escape = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csvRows = finalRows.map((row) =>
        [
          row.status === "success" ? "成功" : row.status === "error" ? "失败" : row.status || "",
          ...inputCols.map((c) => escape(row[c.key])),
          ...outputCols.map((c) => escape(row[c.key])),
        ].join(",")
      );
      const csv = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}-results.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }, [project]);

  const handleBatchComplete = useCallback(() => {
      setTimeout(() => {
        toast.success("批量运行完成", {
          action: {
            label: "Download Results",
            onClick: () => downloadResults(),
          },
        });
      }, 100);
    }, [downloadResults]);

  const { runBatch, isRunning, currentIndex } = useBatchRunner(
    getToken,
    updateRow,
    handleBatchComplete
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("coze_api_token");
      if (t) setCozeToken(t);
    }
  }, []);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setProject(data);
        if (!data.apiToken && typeof window !== "undefined") {
          const t = localStorage.getItem("coze_api_token");
          if (t) setCozeToken(t);
        } else if (data.apiToken) setCozeToken(data.apiToken);
        setRows([createEmptyRow(data.inputSchema, data.outputSchema)]);
      })
      .catch(() => toast.error("加载项目失败"))
      .finally(() => setLoading(false));
  }, [id]);

  const addRow = () => {
    if (!project) return;
    setRows((prev) => [...prev, createEmptyRow(project.inputSchema, project.outputSchema)]);
  };

  const handleDeleteRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [outputPreviewUrl, setOutputPreviewUrl] = useState<string | null>(null);
  const handleClearAll = () => {
    setRows([]);
    setClearDialogOpen(false);
    toast.success("表格已清空");
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text");
      if (!text || !project || isRunning) return;

      // 1. 只要包含换行就强制拦截，防止数据挤进当前 Input
      if (text.includes("\n")) {
        e.preventDefault();
        e.stopPropagation();
      } else return;

      const rawRows = text.split(/\r\n|\n|\r/).filter((row) => row.trim() !== "");
      if (rawRows.length === 0) return;

      const inputCols = project.inputSchema as InputSchemaItem[];

      let dataRows: RunnerRow[] = rawRows.map((rowStr) => {
        const cellValues = rowStr.split("\t");
        const row = createEmptyRow(project.inputSchema, project.outputSchema);
        inputCols.forEach((col, index) => {
          const val = cellValues[index]?.trim();
          if (val !== undefined) row[col.key] = val ?? "";
        });
        return row;
      });

      // 2. 智能过滤表头：第一行与 inputSchema 的 key/label 完全匹配（不区分大小写）则剔除
      let headerFiltered = false;
      if (dataRows.length > 0 && inputCols.length > 0) {
        const first = dataRows[0];
        const firstCells = inputCols.map((col) => String(first[col.key] ?? "").trim().toLowerCase());
        const allMatch = inputCols.every(
          (col, i) =>
            firstCells[i] === col.key.toLowerCase() || firstCells[i] === (col.label || "").trim().toLowerCase()
        );
        if (allMatch) {
          dataRows = dataRows.slice(1);
          headerFiltered = true;
        }
      }
      if (dataRows.length === 0) return;

      // 3. 智能填充：先覆盖完全空白的行，再追加
      setRows((prev) => {
        const emptyIndices: number[] = [];
        prev.forEach((row, i) => {
          const isEmpty = inputCols.every((col) => !String(row[col.key] ?? "").trim());
          if (isEmpty) emptyIndices.push(i);
        });

        const next = [...prev];
        const toFill = Math.min(emptyIndices.length, dataRows.length);
        for (let j = 0; j < toFill; j++) next[emptyIndices[j]] = dataRows[j];
        if (dataRows.length > emptyIndices.length) {
          next.push(...dataRows.slice(emptyIndices.length));
        }
        return next;
      });

      const toastMsg = headerFiltered
        ? `已成功导入 ${dataRows.length} 条数据（已自动过滤表头行）`
        : `已成功导入 ${dataRows.length} 条数据`;
      toast.success(toastMsg);
    },
    [project, isRunning]
  );

  const projectConfig: ProjectConfig | null = project
    ? {
        workflowId: project.workflowId,
        inputSchema: project.inputSchema,
        outputSchema: project.outputSchema,
      }
    : null;

  const handleRun = () => {
    const token = getToken();
    if (!token) {
      toast.error("请填写 Coze API Token（或保存到项目配置）");
      return;
    }
    if (typeof window !== "undefined") localStorage.setItem("coze_api_token", token);
    if (!projectConfig) return;
    runBatch(rows, projectConfig);
  };

  if (loading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        {loading ? "加载中…" : "项目不存在"}
      </div>
    );
  }

  const inputCols = project.inputSchema as InputSchemaItem[];
  const outputCols = project.outputSchema as OutputSchemaItem[];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50/50">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold">{project.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="password"
              placeholder="Coze API Token"
              value={cozeToken}
              onChange={(e) => setCozeToken(e.target.value)}
              className="w-48 text-sm"
            />
            <Button onClick={handleRun} disabled={isRunning || rows.length === 0}>
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing {currentIndex + 1}/{rows.length}...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Batch
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div
        className="flex-1 overflow-auto p-4"
        tabIndex={0}
        onPaste={handlePaste}
      >
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="w-12 py-2 text-left text-xs font-medium text-zinc-500 border-b border-zinc-200">
                  状态
                </th>
                {inputCols.map((col) => (
                  <th
                    key={col.key}
                    className="py-2 px-3 text-left text-xs font-medium text-zinc-600 border-b border-zinc-200"
                  >
                    {col.label || col.key}
                  </th>
                ))}
                {outputCols.map((col) => (
                  <th
                    key={col.key}
                    className="py-2 px-3 text-left text-xs font-medium text-zinc-600 border-b border-zinc-200"
                  >
                    {col.label || col.key}
                  </th>
                ))}
                <th className="w-10 py-2 px-2 text-center text-xs font-medium text-zinc-500 border-b border-zinc-200">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={1 + inputCols.length + outputCols.length + 1}
                    className="py-8 text-center text-sm text-zinc-500"
                  >
                    暂无数据，点击下方「添加一行」开始填写
                  </td>
                </tr>
              )}
              {rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-zinc-100 last:border-0 focus-within:bg-zinc-50/50"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Delete" && e.shiftKey) {
                      e.preventDefault();
                      handleDeleteRow(rowIndex);
                    }
                  }}
                >
                  <td className="py-2 px-2 text-center">
                    {row.status === "success" && <span title="Success">🟢</span>}
                    {row.status === "error" && <span title={row.errorMessage as string}>🔴</span>}
                    {row.status === "running" && <span>🔵</span>}
                    {(!row.status || row.status === "idle") && <span className="text-zinc-300">○</span>}
                  </td>
                  {inputCols.map((col) => (
                    <td key={col.key} className="py-1 px-3">
                      {col.type === "image" ? (
                        <FileUploadCell
                          value={row[col.key] as string | undefined}
                          url={row[`_url_${col.key}`] as string | undefined}
                          onUpload={(fileId, url) => {
                            updateRow(rowIndex, { [col.key]: fileId, [`_url_${col.key}`]: url });
                          }}
                          disabled={isRunning}
                        />
                      ) : (
                        <Input
                          value={(row[col.key] as string) ?? ""}
                          onChange={(e) => updateRow(rowIndex, { [col.key]: e.target.value })}
                          placeholder={col.label}
                          className="min-h-[36px] border-zinc-200 text-sm"
                          disabled={isRunning}
                        />
                      )}
                    </td>
                  ))}
                  {outputCols.map((col) => {
                    const val = row[col.key];
                    const str = val != null ? String(val) : "";
                    const isMedia = str && isMediaUrl(str);
                    return (
                      <td key={col.key} className="py-1 px-3">
                        <div className="min-h-[36px] flex items-center text-sm text-zinc-700">
                          {isMedia ? (
                            <div
                              className="flex items-center gap-1 cursor-pointer hover:opacity-90"
                              onClick={() => setOutputPreviewUrl(str)}
                            >
                              {isVideoUrl(str) ? (
                                <video
                                  src={str}
                                  muted
                                  playsInline
                                  className="h-10 w-auto max-w-[120px] rounded object-cover border border-zinc-200"
                                  title="点击预览"
                                />
                              ) : (
                                <img
                                  src={str}
                                  alt=""
                                  className="w-10 h-10 object-cover rounded border border-zinc-200"
                                  title="点击预览"
                                />
                              )}
                              <span className="text-xs text-zinc-500">预览</span>
                            </div>
                          ) : (
                            str || "—"
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="w-10 py-1 px-2 text-center align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => handleDeleteRow(rowIndex)}
                      disabled={isRunning}
                      aria-label={`删除第 ${rowIndex + 1} 行`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" onClick={addRow} disabled={isRunning}>
            添加一行
          </Button>
          {rows.length > 0 && (
            <>
              <span className="text-zinc-300">|</span>
              <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-500 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setClearDialogOpen(true)}
                  disabled={isRunning}
                  aria-label="清空表格"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>清空所有数据？</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作无法撤销，表格中的所有内容将被移除。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      className={cn(buttonVariants({ variant: "destructive" }))}
                      onClick={handleClearAll}
                    >
                      确认清空
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
      {outputPreviewUrl && (
        <MediaPreviewDialog url={outputPreviewUrl} onClose={() => setOutputPreviewUrl(null)} />
      )}
    </div>
  );
}

function createEmptyRow(
  inputSchema: { key: string }[],
  outputSchema: { key: string }[]
): RunnerRow {
  const row: RunnerRow = { status: "idle" };
  inputSchema.forEach((col) => (row[col.key] = ""));
  outputSchema.forEach((col) => (row[col.key] = ""));
  return row;
}
