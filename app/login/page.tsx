"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const GOD_TRIGGERS = [":godmode", "sudo su"];
const GOD_USERNAME = "root@system:~# ";

export default function LoginPage() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const checkGodMode = useCallback((value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (GOD_TRIGGERS.some((t) => trimmed === t.toLowerCase())) {
      setIsAdminMode(true);
      setUsername(GOD_USERNAME);
      setTimeout(() => passwordRef.current?.focus(), 100);
    }
  }, []);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (isAdminMode) return;
    setUsername(v);
    checkGodMode(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: isAdminMode ? "admin" : username.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "登录失败");
        return;
      }
      toast.success(data.message || "登录成功");
      const dest = data.role === "admin" ? "/admin" : "/dashboard";
      // 使用完整跳转确保 Cookie 已写入并随请求发送，避免 SPA 下登录死循环
      window.location.href = dest;
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={
        isAdminMode
          ? "min-h-screen bg-zinc-950 flex items-center justify-center p-4 transition-colors duration-500"
          : "min-h-screen bg-zinc-50 flex items-center justify-center p-4 transition-colors duration-500"
      }
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={
          isAdminMode
            ? "w-full max-w-md rounded-xl border border-green-500/50 bg-zinc-950 p-8 shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]"
            : "w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm"
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label
              className={isAdminMode ? "text-green-400" : "text-zinc-700"}
            >
              用户名
            </Label>
            <Input
              name="username"
              value={username}
              onChange={handleUsernameChange}
              readOnly={isAdminMode}
              placeholder={isAdminMode ? GOD_USERNAME : "请输入用户名"}
              className={
                isAdminMode
                  ? "font-mono text-green-400 bg-black border-none focus:ring-0 focus-visible:ring-0 caret-green-400 god-mode-cursor"
                  : ""
              }
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label
              className={isAdminMode ? "text-green-400" : "text-zinc-700"}
            >
              密码
            </Label>
            <Input
              ref={passwordRef}
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                isAdminMode ? "Enter Access Key..." : "请输入密码"
              }
              className={
                isAdminMode
                  ? "font-mono text-green-400 bg-black border-none focus:ring-0 focus-visible:ring-0 caret-green-400"
                  : ""
              }
              autoComplete="current-password"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className={
              isAdminMode
                ? "w-full bg-green-600 hover:bg-green-700 text-white"
                : "w-full"
            }
          >
            {loading ? "登录中…" : "登录"}
          </Button>
          {!isAdminMode && (
            <p className="text-center text-sm text-zinc-500">
              没有账号？{" "}
              <a href="/register" className="text-zinc-900 underline hover:no-underline">
                注册
              </a>
            </p>
          )}
        </form>
      </motion.div>
    </div>
  );
}
