"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, LayoutGroup } from "framer-motion";
import { Plus, Zap, Settings, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as LucideIcons from "lucide-react";

interface Project {
  id: string;
  name: string;
  icon: string;
  lastRunAt: string | null;
  updatedAt: string;
  owner?: { username: string };
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/me").then((r) => r.json()), fetch("/api/projects").then((r) => r.json())])
      .then(([me, data]) => {
        if (me.error || data.error) {
          if (me.error === "Unauthorized" || data.error === "Unauthorized") {
            router.replace("/login");
            return;
          }
          throw new Error(data.error || me.error);
        }
        setProjects(Array.isArray(data) ? data : []);
        setIsAdmin(me.role === "admin");
      })
      .catch(() => toast.error("加载失败"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const IconComponent = (name: string) => {
    const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
    return Icon ? <Icon className="w-5 h-5" /> : <Zap className="w-5 h-5" />;
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!window.confirm("确定要永久删除这个项目及其所有运行数据吗？")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "删除失败");
      }
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success("项目已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        加载中…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900">项目</h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => router.push("/admin")}>
                <Settings className="w-4 h-4 mr-1" />
                用户管理
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" />
              退出
            </Button>
          </div>
        </div>

        <LayoutGroup>
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <motion.div
              layout
              className="rounded-xl border-2 border-dashed border-zinc-200 bg-white/50 min-h-[140px] flex items-center justify-center hover:border-zinc-300 hover:bg-zinc-50/80 transition-colors cursor-pointer"
              onClick={() => router.push("/projects/new/edit")}
              whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
            >
              <div className="flex flex-col items-center gap-2 text-zinc-500">
                <Plus className="w-8 h-8" />
                <span className="text-sm font-medium">New Project</span>
              </div>
            </motion.div>

            {projects.map((p) => (
              <motion.div
                key={p.id}
                layout
                className="rounded-xl border border-zinc-200 bg-white min-h-[140px] p-5 flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-zinc-300 transition-all"
                onClick={() => router.push(`/projects/${p.id}/run`)}
                whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600">
                      {IconComponent(p.icon)}
                    </div>
                    <div>
                      <h2 className="font-medium text-zinc-900">{p.name}</h2>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                      onClick={(e) => handleDeleteProject(e, p.id)}
                      aria-label={`删除项目 ${p.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/projects/${p.id}/edit`);
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/projects/${p.id}/run`);
                    }}
                  >
                    运行
                  </Button>
                </div>
                {isAdmin && p.owner?.username && (
                  <p className="mt-2 text-xs text-zinc-400 text-right">@{p.owner.username}</p>
                )}
              </motion.div>
            ))}
          </motion.div>
        </LayoutGroup>
      </div>
    </div>
  );
}
