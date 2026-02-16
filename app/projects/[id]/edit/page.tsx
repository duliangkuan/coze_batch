"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseCurlCommand, parseResponseToSchema, parseCurlMetadata } from "@/lib/curl-parser";
import type { InputSchemaItem, OutputSchemaItem } from "@/lib/schema-types";
import { Wand2, Save, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const INPUT_TYPES = [
  { value: "text", label: "Text" },
  { value: "file", label: "File/Media" },
];

const OUTPUT_TYPES = [
  { value: "text", label: "Text" },
  { value: "file", label: "File/Media" },
  { value: "link", label: "Link" },
];

const CURL_PLACEHOLDER = 'curl -X POST ... -d \'{"parameters": {...}}\'';
const JSON_PLACEHOLDER = '{"data": {...}, "code": 0}';

export default function ProjectEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === "new";

  const [curl, setCurl] = useState("");
  const [responseJson, setResponseJson] = useState("");
  const [inputSchema, setInputSchema] = useState<InputSchemaItem[]>([]);
  const [outputSchema, setOutputSchema] = useState<OutputSchemaItem[]>([]);
  const [name, setName] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showApiToken, setShowApiToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(!isNew);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setName(data.name || "");
        setWorkflowId(data.workflowId || "");
        setApiToken(data.apiToken ?? "");
        type LegacyInput = Omit<InputSchemaItem, "type"> & { type: string };
        type LegacyOutput = Omit<OutputSchemaItem, "type"> & { type: string };
        const normInput = (arr: LegacyInput[]): InputSchemaItem[] =>
          arr.map((c) => ({ ...c, type: (c.type === "image" || c.type === "media" ? "file" : c.type === "file" ? "file" : "text") as InputSchemaItem["type"] }));
        const normOutput = (arr: LegacyOutput[]): OutputSchemaItem[] =>
          arr.map((c) => ({
            ...c,
            type: (c.type === "image" || c.type === "video" || c.type === "media" ? "file" : c.type === "link" ? "link" : c.type === "file" ? "file" : "text") as OutputSchemaItem["type"],
          }));
        setInputSchema(Array.isArray(data.inputSchema) ? normInput(data.inputSchema as LegacyInput[]) : []);
        setOutputSchema(Array.isArray(data.outputSchema) ? normOutput(data.outputSchema as LegacyOutput[]) : []);
      })
      .catch(() => toast.error("加载项目失败"))
      .finally(() => setFetchLoading(false));
  }, [id, isNew]);

  const handleAutoParse = () => {
    const metadata = parseCurlMetadata(curl);
    if (metadata.workflowId) setWorkflowId(metadata.workflowId);
    if (metadata.apiToken) setApiToken(metadata.apiToken);

    const inputs = parseCurlCommand(curl);
    const outputs = parseResponseToSchema(responseJson);
    setInputSchema(inputs.length ? inputs : inputSchema);
    setOutputSchema(outputs.length ? outputs : outputSchema);

    const hasSchema = inputs.length > 0 || outputs.length > 0;
    const hasMetadata = !!metadata.workflowId || !!metadata.apiToken;
    if (hasMetadata) {
      toast.success("解析成功！已自动提取 Workflow ID 和 API Token。");
    } else if (hasSchema) {
      toast.success("解析完成");
    } else {
      toast.error("未能解析出列，请检查 cURL 与 JSON 格式");
    }
  };

  const setInputItem = (index: number, field: keyof InputSchemaItem, value: string) => {
    setInputSchema((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const setOutputItem = (index: number, field: keyof OutputSchemaItem, value: string) => {
    setOutputSchema((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "path") next[index].key = value.replace(/\./g, "_");
      return next;
    });
  };

  const addInputRow = () => {
    setInputSchema((prev) => [...prev, { key: "", label: "", type: "text" }]);
  };

  const removeInputRow = (index: number) => {
    setInputSchema((prev) => prev.filter((_, i) => i !== index));
  };

  const addOutputRow = () => {
    setOutputSchema((prev) => [...prev, { path: "", key: "", label: "", type: "text" }]);
  };

  const removeOutputRow = (index: number) => {
    setOutputSchema((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("请输入项目名称");
      return;
    }
    if (!workflowId.trim()) {
      toast.error("请输入 Workflow ID");
      return;
    }
    const validInputs = inputSchema.filter((r) => r.key.trim() !== "");
    if (!validInputs.length) {
      toast.error("请至少配置一列输入");
      return;
    }
    const inputKeys = validInputs.map((r) => r.key.trim());
    if (new Set(inputKeys).size !== inputKeys.length) {
      toast.error("输入列 Key 不能重复");
      return;
    }
    const validOutputs = outputSchema.filter((r) => r.path.trim() !== "");
    const outputPaths = validOutputs.map((r) => r.path.trim());
    if (outputPaths.length && new Set(outputPaths).size !== outputPaths.length) {
      toast.error("输出列 Key/Path 不能重复");
      return;
    }
    setLoading(true);
    try {
      if (isNew) {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            workflowId: workflowId.trim(),
            apiToken: apiToken.trim() || null,
            inputSchema: validInputs.map((r) => ({ ...r, label: r.label.trim() || r.key.trim() })),
            outputSchema: validOutputs.map((r) => ({ ...r, key: r.path.replace(/\./g, "_"), label: r.label.trim() || r.path.trim() })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "创建失败");
        toast.success("项目已创建");
        router.replace(`/projects/${data.id}/edit`);
        return;
      }
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          workflowId: workflowId.trim(),
          apiToken: apiToken.trim() || null,
          inputSchema: validInputs.map((r) => ({ ...r, label: r.label.trim() || r.key.trim() })),
          outputSchema: validOutputs.map((r) => ({ ...r, key: r.path.replace(/\./g, "_"), label: r.label.trim() || r.path.trim() })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      toast.success("已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        加载中…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{isNew ? "新建项目" : "编辑项目"}</h1>
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
          返回仪表盘
        </Button>
      </div>

      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-white">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={50} minSize={30}>
            <div className="p-4 h-full flex flex-col gap-4">
              <div>
                <Label className="text-zinc-600">粘贴 cURL 请求</Label>
                <Textarea
                  placeholder={CURL_PLACEHOLDER}
                  value={curl}
                  onChange={(e) => setCurl(e.target.value)}
                  className="mt-1 min-h-[160px] font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-zinc-600">粘贴 JSON 响应</Label>
                <Textarea
                  placeholder={JSON_PLACEHOLDER}
                  value={responseJson}
                  onChange={(e) => setResponseJson(e.target.value)}
                  className="mt-1 min-h-[160px] font-mono text-sm"
                />
              </div>
              <Button onClick={handleAutoParse} className="w-fit">
                <Wand2 className="w-4 h-4 mr-2" />
                Auto Parse
              </Button>
            </div>
          </Panel>
          <PanelResizeHandle className="w-2 bg-zinc-100 hover:bg-zinc-200 transition-colors" />
          <Panel defaultSize={50} minSize={30}>
            <div className="p-4 h-full overflow-auto flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>项目名称</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="My Workflow" />
                </div>
                <div>
                  <Label>Workflow ID</Label>
                  <Input value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} className="mt-1" placeholder="从 Coze 复制" />
                </div>
              </div>
              <div>
                <Label className="text-zinc-700">API Token (Optional)</Label>
                <div className="mt-1 relative flex items-center">
                  <Input
                    type={showApiToken ? "text" : "password"}
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder="pat_xxx / sat_xxx，可从 cURL Auto Parse 提取"
                    className="pr-9 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 h-8 w-8 text-zinc-500 hover:text-zinc-700"
                    onClick={() => setShowApiToken((v) => !v)}
                    aria-label={showApiToken ? "隐藏 Token" : "显示 Token"}
                  >
                    {showApiToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-700 font-medium">Input Columns</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addInputRow} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Add Input
                  </Button>
                </div>
                <div className="mt-2 space-y-2">
                  {inputSchema.length === 0 && (
                    <p className="text-sm text-zinc-500 py-2">点击 Add Input 或左侧 Auto Parse 添加列</p>
                  )}
                  {inputSchema.map((item, i) => (
                    <div key={`input-${i}`} className="flex gap-2 items-center flex-wrap">
                      <Input
                        value={item.key}
                        onChange={(e) => setInputItem(i, "key", e.target.value)}
                        placeholder="e.g. prompt, image"
                        className="flex-1 min-w-[100px] font-mono text-xs"
                      />
                      <Select
                        value={item.type}
                        onValueChange={(v) => setInputItem(i, "type", v as "text" | "file")}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INPUT_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeInputRow(i)}
                        aria-label="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-700 font-medium">Output Columns</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addOutputRow} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Add Output
                  </Button>
                </div>
                <div className="mt-2 space-y-2">
                  {outputSchema.length === 0 && (
                    <p className="text-sm text-zinc-500 py-2">点击 Add Output 或左侧 Auto Parse 添加列</p>
                  )}
                  {outputSchema.map((item, i) => (
                    <div key={`output-${i}`} className="flex gap-2 items-center flex-wrap">
                      <Input
                        value={item.path}
                        onChange={(e) => setOutputItem(i, "path", e.target.value)}
                        placeholder="e.g. data.image_url"
                        className="flex-1 min-w-[100px] font-mono text-xs"
                      />
                      <Select
                        value={item.type}
                        onValueChange={(v) => setOutputItem(i, "type", v as "text" | "file" | "link")}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OUTPUT_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeOutputRow(i)}
                        aria-label="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleSave} disabled={loading} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                {isNew ? "创建项目" : "保存项目"}
              </Button>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
