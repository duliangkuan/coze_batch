# Coze Workflow Batch Tool

扣子工作流批量处理工具 · Next.js 14 + Prisma + 极客风 God Mode 登录

## 功能

- **登录**: 普通用户登录 / 管理员入口（用户名输入 `:godmode` 触发）
- **仪表盘**: Bento Grid 项目卡片，支持 Hover 与布局动画
- **项目配置 (Builder)**: 粘贴 cURL + JSON 响应 → Auto Parse → 配置输入/输出列与类型
- **批量运行 (Runner)**: 表格输入、图片上传单元格、串行执行、结果导出 CSV
- **代理**: `/api/proxy/upload`、`/api/proxy/run` 解决跨域并处理双重 JSON

## 技术栈

- Next.js 14 (App Router)、TypeScript (Strict)
- Tailwind CSS、Shadcn/UI (Radix)、Framer Motion
- Prisma + Vercel Postgres、Zustand、React Hook Form + Zod、jose (JWT)、sonner

## 快速开始

1. 复制环境变量并填写：

```bash
cp .env.example .env
# 填写 POSTGRES_PRISMA_URL、POSTGRES_URL_NON_POOLING、ADMIN_PASSWORD、JWT_SECRET
```

2. 初始化数据库：

```bash
npx prisma db push
```

3. 启动开发服务器：

```bash
npm run dev
```

4. 打开 [http://localhost:3000](http://localhost:3000) → 注册/登录 → 新建项目 → 粘贴 cURL 与 JSON → Auto Parse → 保存 → 运行页批量执行。

5. 管理员：登录页用户名输入 **`:godmode`**，密码为 `ADMIN_PASSWORD`。

## 目录结构（概览）

- `app/` — 页面与 API（login、register、dashboard、admin、projects/[id]/edit|run、api/auth、api/proxy、api/projects）
- `components/ui/` — Button、Input、Label、Select、Textarea
- `components/runner/` — FileUploadCell、ImageLightbox
- `lib/` — prisma、auth、utils、curl-parser、schema-types
- `hooks/use-batch-runner.ts` — 批量执行与完成回调
- `prisma/schema.prisma` — User、Project

## 验收要点

- 登录页输入 `:godmode` 可进入上帝模式并进入后台
- 粘贴 Coze cURL 可正确解析并生成表格列
- 表格中上传图片 → 运行 → Coze 收到 file_id 并返回结果
- 多行数据串行运行稳定，完成后可点击 Toast 的 "Download Results" 导出 CSV
- 普通用户仅能访问自己的项目；管理员可访问用户管理
