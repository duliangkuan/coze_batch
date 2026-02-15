import { redirect } from "next/navigation";
import { getAuthFromCookie } from "@/lib/auth";
import Link from "next/link";

export default async function HomePage() {
  const auth = await getAuthFromCookie();
  if (auth) {
    redirect(auth.role === "admin" ? "/admin" : "/dashboard");
  }
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Coze Workflow Batch Tool
      </h1>
      <p className="text-zinc-600 text-center max-w-md">
        扣子工作流批量处理工具 · 极简 Linear 风格
      </p>
      <Link
        href="/login"
        className="rounded-md bg-zinc-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-zinc-800 transition-colors"
      >
        前往登录
      </Link>
    </div>
  );
}
