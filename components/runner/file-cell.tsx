"use client";

import { useState, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadCellProps {
  value: string | undefined; // file_id
  url: string | undefined;   // 用于预览
  onUpload: (fileId: string, url: string) => void;
  disabled?: boolean;
  className?: string;
}

export function FileUploadCell({ value, url, onUpload, disabled, className }: FileUploadCellProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("coze_api_token") : null;
      const res = await fetch("/api/proxy/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (data.code !== 0 || !data.data) throw new Error(data.msg || "上传失败");
      const id = data.data.id ?? data.data.file_id;
      const fileUrl = data.data.url ?? data.data.file_url ?? "";
      onUpload(id, fileUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  if (value && url) {
    return (
      <div
        className={cn("flex items-center gap-2 min-h-[36px]", className)}
        onClick={() => window.open(url, "_blank")}
      >
        <img
          src={url}
          alt=""
          className="w-10 h-10 object-cover rounded border border-zinc-200 cursor-pointer hover:opacity-90"
          title="点击预览"
        />
        <span className="text-xs text-zinc-500 truncate max-w-[80px]">已上传</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || loading}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-dashed border-zinc-300 text-zinc-600 hover:bg-zinc-50 text-xs"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        <span>{loading ? "上传中…" : "Upload (+)"}</span>
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
