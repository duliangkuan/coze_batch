"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const VIDEO_EXT = /\.(mp4|webm|mov|ogg)$/i;

export function isVideoUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return VIDEO_EXT.test(path);
  } catch {
    return VIDEO_EXT.test(url);
  }
}

const IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i;

export function isImageUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return IMAGE_EXT.test(path);
  } catch {
    return IMAGE_EXT.test(url);
  }
}

export function isMediaUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) && (isVideoUrl(url) || isImageUrl(url));
}

interface MediaPreviewDialogProps {
  url: string | null;
  onClose: () => void;
}

export function MediaPreviewDialog({ url, onClose }: MediaPreviewDialogProps) {
  if (!url) return null;
  const video = isVideoUrl(url);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {video ? (
          <video
            src={url}
            controls
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
            onEnded={() => {}}
          />
        ) : (
          <img
            src={url}
            alt="预览"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 rounded-full text-white hover:bg-white/20 transition-colors"
          aria-label="关闭"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

interface FileUploadCellProps {
  value: string | undefined;
  url: string | undefined;
  onUpload: (fileId: string, url: string) => void;
  disabled?: boolean;
  className?: string;
}

export function FileUploadCell({ value, url, onUpload, disabled, className }: FileUploadCellProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");
      const fileUrl = data.url;
      if (!fileUrl) throw new Error("未返回文件地址");
      onUpload(fileUrl, fileUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  if (value && url) {
    const video = isVideoUrl(url);
    return (
      <>
        <div
          className={cn("flex items-center gap-2 min-h-[36px]", className)}
          onClick={() => setPreviewUrl(url)}
        >
          {video ? (
            <video
              src={url}
              muted
              playsInline
              className="h-10 w-auto max-w-[120px] rounded object-cover border border-zinc-200 cursor-pointer hover:opacity-90"
              title="点击预览"
            />
          ) : (
            <img
              src={url}
              alt=""
              className="w-10 h-10 object-cover rounded border border-zinc-200 cursor-pointer hover:opacity-90"
              title="点击预览"
            />
          )}
          <span className="text-xs text-zinc-500 truncate max-w-[80px]">已上传</span>
        </div>
        {previewUrl && (
          <MediaPreviewDialog url={previewUrl} onClose={() => setPreviewUrl(null)} />
        )}
      </>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
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
