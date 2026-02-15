"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  username: string;
  createdAt: string;
  status: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.error && data.error === "Unauthorized") {
          router.replace("/dashboard");
          return;
        }
        setUsers(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleBan = async (user: User) => {
    if (user.status === 0) return;
    if (!window.confirm(`确定要封禁用户「${user.username}」吗？其 Session 将立即失效。`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "操作失败");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: 0 } : u)));
      toast.success("已封禁，该用户 Session 已失效");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  };

  const handleUnban = async (user: User) => {
    if (user.status === 1) return;
    if (!window.confirm(`确定要解封用户「${user.username}」吗？`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "操作失败");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: 1 } : u)));
      toast.success("已解封");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-semibold">用户管理 (God Mode)</h1>
        </div>
        {loading ? (
          <p className="text-zinc-500">加载中…</p>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600">用户名</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600">注册时间</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600">状态</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-zinc-100">
                    <td className="py-3 px-4 font-mono text-sm">{u.username}</td>
                    <td className="py-3 px-4 text-sm text-zinc-500">
                      {new Date(u.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={u.status === 1 ? "text-green-600" : "text-red-600"}>
                        {u.status === 1 ? "正常" : "禁用"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.status === 1 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-zinc-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleBan(u)}
                        >
                          封禁
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-zinc-500 hover:text-green-600 hover:bg-green-50"
                          onClick={() => handleUnban(u)}
                        >
                          解封
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
