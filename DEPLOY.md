# 部署到 Vercel

## 1. 数据库（Vercel Postgres）

- 在 Vercel 项目 → Storage → Create Database → 选择 **Postgres**，创建后会自动注入环境变量：
  - `POSTGRES_PRISMA_URL`
  - `POSTGRES_URL_NON_POOLING`
- 无需在 Environment Variables 里再手填上述两项（若已挂载到项目则会自动带出）。

## 2. 环境变量

在 Vercel 项目 **Settings → Environment Variables** 中配置：

| 变量 | 说明 | 示例 |
|------|------|------|
| `POSTGRES_PRISMA_URL` | 由 Vercel Postgres 自动注入 | （创建 DB 后自动有） |
| `POSTGRES_URL_NON_POOLING` | 由 Vercel Postgres 自动注入 | （同上） |
| `ADMIN_PASSWORD` | 管理员（上帝模式）密码 | 自行设置强密码 |
| `JWT_SECRET` | JWT 签名密钥 | 随机长字符串 |

## 3. 构建命令

在 Vercel 项目 **Settings → General → Build & Development Settings** 中：

- **Build Command** 填写：`npm run vercel-build`  
  （会执行 `prisma generate`、`prisma migrate deploy`、`next build`）
- **Output Directory** 保持默认（Next.js 自动识别）。  
- 不修改时 Vercel 默认使用 `npm run build`（仅 `next build`），需改为上述命令才会在部署时执行数据库迁移。

## 4. 本地开发（可选）

当前 Prisma 使用 **Postgres**。本地需有 Postgres 才能跑迁移与完整功能：

- **Docker**：`docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres`
- 在项目根目录复制 `.env.example` 为 `.env`，将 `POSTGRES_PRISMA_URL`、`POSTGRES_URL_NON_POOLING` 改为指向本地（如 `localhost:5432`）。
- 执行：`npx prisma migrate deploy`（或 `prisma migrate dev`）后再 `npm run dev`。
