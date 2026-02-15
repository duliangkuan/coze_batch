"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error("请输入用户名");
      return;
    }
    if (password.length < 6) {
      toast.error("密码至少 6 位");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "注册失败");
        return;
      }
      toast.success(data.message || "注册成功");
      router.push("/login");
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900 mb-6">注册</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>用户名</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              className="mt-1"
              autoComplete="username"
            />
          </div>
          <div>
            <Label>密码</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              className="mt-1"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "注册中…" : "注册"}
          </Button>
          <p className="text-center text-sm text-zinc-500">
            已有账号？{" "}
            <Link href="/login" className="text-zinc-900 underline hover:no-underline">
              登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
