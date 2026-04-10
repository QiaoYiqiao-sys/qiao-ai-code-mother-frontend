# Qiao AI 应用生成平台 - 前端

基于 Vue 3 + TypeScript 的 AI 应用生成平台前端项目。通过自然语言对话，即可生成完整的网站应用。

## 技术栈

- **框架**: Vue 3 (Composition API + `<script setup>`)
- **构建工具**: Vite 7
- **语言**: TypeScript
- **样式**: Tailwind CSS 4
- **UI 组件库**: Ant Design Vue
- **状态管理**: Pinia
- **路由**: Vue Router
- **HTTP 请求**: Axios
- **Markdown 渲染**: markdown-it + highlight.js

## 项目结构

```
src/
├── api/              # 后端接口（OpenAPI 自动生成）
│   ├── appController.ts
│   ├── chatHistoryController.ts
│   ├── userController.ts
│   └── typings.d.ts
├── pages/            # 页面组件
│   ├── HomePage.vue       # 首页（含应用管理、用户管理、对话管理）
│   ├── AppChatPage.vue    # 应用对话页面（AI 对话 + 实时预览）
│   └── AppEditPage.vue    # 应用编辑页面
├── stores/           # Pinia 状态管理
│   └── loginUser.ts
├── router/           # 路由配置
├── assets/           # 静态资源与全局样式
├── request.ts        # Axios 请求封装
└── main.ts           # 应用入口
```

## 核心功能

- **AI 对话生成代码**: 通过 SSE 流式对话实时生成网站代码，支持多轮对话上下文
- **实时预览**: 左侧对话面板 + 右侧 iframe 实时预览生成的网站
- **代码高亮查看**: 提取 AI 输出的代码块，语法高亮展示，支持一键复制
- **对话历史**: 游标分页加载历史消息，支持加载更多
- **应用管理**: 我的应用、精选应用展示，管理员可管理所有应用
- **对话管理**: 管理员查看所有对话记录，按应用 ID 和消息类型筛选
- **用户管理**: 管理员管理用户账号，支持编辑角色和信息
- **主题切换**: 支持浅色/深色主题，以及渐变主题背景

## 快速开始

### 环境要求

- Node.js >= 20.19.0 或 >= 22.12.0

### 安装依赖

```sh
npm install
```

### 配置环境变量

在项目根目录创建 `.env.local` 文件：

```env
# 应用部署域名
VITE_DEPLOY_DOMAIN=http://localhost

# API 基础地址
VITE_API_BASE_URL=http://localhost:8123/api
```

### 启动开发服务器

```sh
npm run dev
```

### 构建生产版本

```sh
npm run build
```

## 其他命令

```sh
npm run type-check    # TypeScript 类型检查
npm run lint          # 代码检查（oxlint + eslint）
npm run format        # 代码格式化（prettier）
npm run openapi2ts    # 从 OpenAPI 规范生成 TypeScript 接口代码
```
