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
- **后端**: Cloudflare Pages Functions
- **数据库**: Supabase
- **AI**: OpenRouter (Gemini)
- **存储**: CTFile 云盘

## 本地开发

详细说明见 [DEV_SETUP.md](./DEV_SETUP.md)

## 部署

详细部署说明见 [DEPLOYMENT.md](./DEPLOYMENT.md)

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
