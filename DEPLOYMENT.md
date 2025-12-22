# Cloudflare Pages Deployment Guide

## 部署步骤

### 1. 连接 GitHub 仓库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Pages** 页面
3. 点击 **Create a project** → **Connect to Git**
4. 选择您的 GitHub 仓库
5. 授权 Cloudflare 访问

### 2. 配置构建设置

**Framework preset**: `Vite`

**Build command**:
```bash
npm run build
```

**Build output directory**:
```
dist
```

**Root directory**: `/` (或留空)

### 3. 配置环境变量 ⚠️ 重要

在 Cloudflare Pages 项目设置中，添加以下**所有**环境变量：

**进入设置**：Cloudflare Dashboard → Pages → 您的项目 → Settings → Environment variables

#### Worker 环境变量（**不加 VITE_ 前缀**）

> **安全说明**：所有敏感密钥都只在 Worker 中使用，不会暴露给浏览器！

| 变量名 | 值（示例） | 说明 |
|--------|-----------|------|
| `OPENROUTER_API_KEY` | `sk-or-v1-2f952dcf...` | OpenRouter API密钥 |
| `SUPABASE_URL` | `https://sbp-2o0ycwcbagexxjpc...` | Supabase项目URL |
| `SUPABASE_ANON_KEY` | `eyJ0eXAiOiJKV1QiLCJhbGci...` | Supabase匿名密钥 |
| `CTFILE_FOLDER_ID` | `d158245757` | CTFile文件夹ID |
| `CTFILE_TOKEN` | `5933ca3f8ef44b3fdc27a14f12f6cb93` | CTFile访问令牌 |

> **重要规则**: 
> - **所有变量都不加 `VITE_` 前缀**
> - 这些变量只在 Worker 中使用，浏览器无法访问
> - 前端通过调用 `/api/ai` Worker API 间接使用这些服务

### 4. 部署

点击 **Save and Deploy**，Cloudflare 会自动：
1. 构建您的 Vite 应用
2. 部署 Cloudflare Worker (`functions/api/ai.ts`)
3. 设置路由 `/api/ai` → Worker

### 5. 验证部署

部署完成后，访问您的网站：
```
https://your-project.pages.dev
```

测试功能：
- 搜索歌曲
- 查看歌词
- CTFile 自动同步

## 架构说明

```
用户浏览器
    ↓ (HTTPS, 无密钥)
Cloudflare Pages (静态文件)
    ↓ (调用 /api/ai)
Cloudflare Worker (密钥只在这里)
    ↓ (HTTPS + API Key)
OpenRouter / Supabase / CTFile
```

**安全优势**：
- ✅ **所有 API Key 只存在于 Worker 环境变量**
- ✅ 永不暴露到前端 JavaScript 代码
- ✅ 访客无法通过浏览器开发者工具看到密钥
- ✅ 可以在 Worker 中添加访问控制和限流

## 故障排查

### Worker 没有运行

**症状**: 功能不工作，浏览器显示 404

**解决**:
1. 检查 `functions/api/ai.ts` 是否存在
2. 检查 Cloudflare Dashboard → Functions → 查看是否有 `ai` 函数
3. 查看构建日志确认 Worker 已部署

### 环境变量未生效

**症状**: Worker 返回 401 或 500 错误

**解决**:
1. 检查 Cloudflare Pages → Settings → Environment variables
2. 确认**所有**必需变量已设置（见上方表格）
3. 确认变量名称正确（区分大小写，无 VITE_ 前缀）
4. 重新部署项目

### CORS 错误

**症状**: 浏览器控制台显示 CORS 错误

**解决**: Worker 已配置 CORS，如果仍有问题：
1. 检查请求是否来自正确的域名
2. 更新 `functions/api/ai.ts` 中的 CORS 设置

## 自动更新

每次推送代码到 GitHub，Cloudflare 会自动：
1. 重新构建前端
2. 重新部署 Worker
3. 更新生产环境

无需手动操作！

## 环境变量配置清单

部署前，请确保在 Cloudflare Pages 设置中配置了以下**所有**变量：

- [ ] `OPENROUTER_API_KEY` - AI 服务
- [ ] `SUPABASE_URL` - 数据库 URL
- [ ] `SUPABASE_ANON_KEY` - 数据库访问密钥
- [ ] `CTFILE_FOLDER_ID` - 云存储文件夹 ID
- [ ] `CTFILE_TOKEN` - 云存储访问令牌

### 变量值来源

这些值可以从您的本地 `.dev.vars` 文件中复制到 Cloudflare Dashboard。

**注意**：不要将 `.dev.vars` 文件上传到 GitHub！
