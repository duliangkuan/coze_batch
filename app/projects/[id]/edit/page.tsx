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
import { Wand2, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const INPUT_TYPES = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
];

const OUTPUT_TYPES = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "link", label: "Link" },
  { value: "video", label: "Video" },
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
        setInputSchema(Array.isArray(data.inputSchema) ? data.inputSchema : []);
        setOutputSchema(Array.isArray(data.outputSchema) ? data.outputSchema : []);
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
      return next;
    });
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
    if (!inputSchema.length) {
      toast.error("请至少配置一列输入");
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
            inputSchema,
            outputSchema,
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
          inputSchema,
          outputSchema,
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
                <Label className="text-zinc-700 font-medium">Input Columns</Label>
                <div className="mt-2 space-y-2">
                  {inputSchema.map((item, i) => (
                    <div key={item.key + i} className="flex gap-2 items-center flex-wrap">
                      <Input value={item.key} readOnly className="flex-1 min-w-[100px] bg-zinc-50 font-mono text-xs" />
                      <Input
                        value={item.label}
                        onChange={(e) => setInputItem(i, "label", e.target.value)}
                        placeholder="显示名"
                        className="flex-1 min-w-[100px]"
                      />
                      <Select
                        value={item.type}
                        onValueChange={(v) => setInputItem(i, "type", v as "text" | "image")}
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
                    </div>
                  ))}
                  {inputSchema.length === 0 && (
                    <p className="text-sm text-zinc-500">左侧粘贴 cURL 后点击 Auto Parse</p>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-zinc-700 font-medium">Output Columns</Label>
                <div className="mt-2 space-y-2">
                  {outputSchema.map((item, i) => (
                    <div key={item.key + i} className="flex gap-2 items-center flex-wrap">
                      <Input value={item.path} readOnly className="flex-1 min-w-[100px] bg-zinc-50 font-mono text-xs" />
                      <Input
                        value={item.label}
                        onChange={(e) => setOutputItem(i, "label", e.target.value)}
                        placeholder="显示名"
                        className="flex-1 min-w-[100px]"
                      />
                      <Select
                        value={item.type}
                        onValueChange={(v) => setOutputItem(i, "type", v as "text" | "image" | "link" | "video")}
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
                    </div>
                  ))}
                  {outputSchema.length === 0 && (
                    <p className="text-sm text-zinc-500">左侧粘贴 JSON 响应后点击 Auto Parse</p>
                  )}
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
