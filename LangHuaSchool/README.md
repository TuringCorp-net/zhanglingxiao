# 浪花学校 (LangHua School)

这是为“浪花学校”制作的官方网站。

## 项目简介
浪花学校是一所建立在海岛上的学校，官网设计风格简单、清晰、具备童趣。
本项目独立于 zhanglingxiao 的个人作品集。

## 技术栈
- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Framework**: [Hono](https://hono.dev/)
- **Language**: TypeScript

## 开发指南

### 安装依赖
```bash
npm install
```

### 本地开发
启动本地开发服务器：
```bash
npm run dev
```

### 部署
部署到 Cloudflare Workers（包含上传静态资源）：
```bash
npm run deploy
```

> **注意**: 部署前需要通过 `wrangler login` 登录。

## 文档索引
关于网站的详细功能和业务需求，请阅读 [需求说明.md](./需求说明.md)。
