# Melody Timeline

一个交互式音乐时间线应用，展示华语音乐历史。

## 功能特性

- 📅 **时间线视图** - 按年份浏览歌曲
- 🔍 **AI 搜索** - 智能搜索歌曲信息
- 🎵 **音频播放** - 在线播放音乐
- ☁️ **云端同步** - 自动从 CTFile 同步音乐文件
- 📝 **歌词展示** - AI 自动获取歌词

## 技术栈

- **前端**: React + TypeScript + Vite + Tailwind CSS
- **后端**: Cloudflare Pages Functions (Worker)
- **数据库**: Supabase
- **AI**: OpenRouter (Gemini)
- **存储**: CTFile 云盘

## 安全架构

所有敏感操作都通过 Cloudflare Worker 代理，API 密钥不会暴露给浏览器：

```
浏览器 → Worker API (/api/ai) → Supabase / CTFile / OpenRouter
         ↑ 密钥只在这里使用
```

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 部署

详细部署说明见 [DEPLOYMENT.md](./DEPLOYMENT.md)

### 快速步骤

1. 推送代码到 GitHub
2. 在 Cloudflare Pages 连接仓库
3. 配置环境变量（不加 VITE_ 前缀）:
   - `OPENROUTER_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `CTFILE_FOLDER_ID`
   - `CTFILE_TOKEN`
4. 部署完成

## 项目结构

```
├── src/
│   ├── components/     # React 组件
│   ├── services/       # API 服务 (backendProxy.ts)
│   └── types.ts        # TypeScript 类型定义
├── functions/
│   └── api/ai.ts       # Cloudflare Worker
├── supabase/           # 数据库 Schema
└── DEPLOYMENT.md       # 部署指南
```

## License

MIT
