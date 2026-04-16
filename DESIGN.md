# DESIGN.md — Qiao AI Code Mother 设计系统

## 1. Visual Theme & Atmosphere

**设计哲学**：温暖、友好、专业。像在阳光充足的咖啡馆里使用的创作工具。
- 情绪关键词：温暖、柔和、亲切、舒适、可信赖
- 密度：宽松留白，呼吸感强
- 灵感来源：Notion 的温暖极简 + Airbnb 的柔和圆润
- 以亮色模式为主，深色模式为辅

---

## 2. Color Palette & Roles

### 主色系

| Token | Hex | 角色 |
|-------|-----|------|
| `--color-primary` | `#E8734A` | 主色 — 珊瑚橘，用于主按钮、链接、活跃态 |
| `--color-primary-hover` | `#D4623D` | 主色悬停 |
| `--color-primary-light` | `#FDF0EC` | 主色浅底，用于选中行、高亮背景 |
| `--color-primary-dark` | `#C4553A` | 主色深色模式活跃态 |

### 语义色

| Token | Hex | 角色 |
|-------|-----|------|
| `--color-success` | `#2DB87F` | 成功 — 温暖绿 |
| `--color-success-hover` | `#26A06E` | 成功悬停 |
| `--color-danger` | `#E05454` | 危险 — 柔和红 |
| `--color-danger-hover` | `#CC4545` | 危险悬停 |
| `--color-warning` | `#E5A84B` | 警告 — 琥珀 |
| `--color-info` | `#6B9FD4` | 信息 — 柔蓝 |

### 中性色（亮色模式）

| Token | Hex | 角色 |
|-------|-----|------|
| `--color-bg` | `#FBF8F5` | 页面底色 — 暖白 |
| `--color-bg-elevated` | `#FFFFFF` | 浮层/卡片底色 |
| `--color-bg-muted` | `#F5F0EB` | 次级背景 — 输入框/表头 |
| `--color-bg-subtle` | `#EDE7E0` | 微弱背景 — hover 态 |
| `--color-border` | `#E8E0D8` | 边框 |
| `--color-border-muted` | `#F0EAE3` | 弱分割线 |
| `--color-text` | `#2D2318` | 主文字 — 深棕黑 |
| `--color-text-secondary` | `#7A6E62` | 次要文字 |
| `--color-text-muted` | `#A89B8C` | 弱文字/占位符 |

### 中性色（深色模式）

| Token | Hex | 角色 |
|-------|-----|------|
| `--color-bg` | `#1A1714` | 页面底色 — 暖黑 |
| `--color-bg-elevated` | `#231F1B` | 浮层/卡片底色 |
| `--color-bg-muted` | `#2E2924` | 次级背景 |
| `--color-bg-subtle` | `#3D3630` | 微弱背景 |
| `--color-border` | `#3D3630` | 边框 |
| `--color-border-muted` | `#332E28` | 弱分割线 |
| `--color-text` | `#F0EAE3` | 主文字 |
| `--color-text-secondary` | `#B5A899` | 次要文字 |
| `--color-text-muted` | `#7A6E62` | 弱文字/占位符 |

---

## 3. Typography Rules

**字体族**：
```
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
```

**代码字体**：
```
font-family: 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
```

### 层级表

| 级别 | 大小 | 行高 | 字重 | 用途 |
|------|------|------|------|------|
| Display | 3rem (48px) | 1.1 | 700 | 英雄区标题 |
| H1 | 1.875rem (30px) | 1.3 | 700 | 页面标题 |
| H2 | 1.25rem (20px) | 1.4 | 600 | 区块标题 |
| H3 | 1rem (16px) | 1.5 | 600 | 小标题 |
| Body | 0.875rem (14px) | 1.6 | 400 | 正文 |
| Small | 0.75rem (12px) | 1.5 | 400 | 辅助文字、标签 |
| Tiny | 0.625rem (10px) | 1.4 | 500 | 头像内文字 |

---

## 4. Component Stylings

### 按钮

**Primary（主按钮）**
- Default: `bg: #E8734A` `text: white` `rounded: 12px` `px: 16px` `py: 10px`
- Hover: `bg: #D4623D`
- Active: `bg: #C4553A`
- Disabled: `opacity: 0.5` `cursor: not-allowed`
- Focus: `ring: 2px #E8734A/30`

**Secondary（次要按钮）**
- Default: `bg: transparent` `border: 1px solid #E8E0D8` `text: #7A6E62`
- Hover: `border-color: #E8734A` `text: #E8734A`
- Active: `bg: #FDF0EC`
- Disabled: `opacity: 0.4`

**Danger（危险按钮）**
- Default: `bg: transparent` `border: 1px solid #E8E0D8` `text: #E05454`
- Hover: `bg: #FDF2F2` `border-color: #E05454`

**Ghost（幽灵按钮）**
- Default: `bg: transparent` `text: #7A6E62`
- Hover: `bg: #F5F0EB`

### 输入框

- Border: `1px solid #E8E0D8`
- Border Radius: `12px`
- Background: `#FFFFFF`（亮）/ `#2E2924`（暗）
- Padding: `10px 16px`
- Font Size: `14px`
- Placeholder Color: `#A89B8C`
- Focus: `border-color: #E8734A` `ring: 2px #E8734A/10`
- Disabled: `bg: #F5F0EB` `opacity: 0.6`

### 卡片

- Background: `#FFFFFF`（亮）/ `#231F1B`（暗）
- Border: `1px solid #E8E0D8`（亮）/ `#3D3630`（暗）
- Border Radius: `16px`
- Shadow: `0 2px 12px rgba(45, 35, 24, 0.06)`
- Hover Shadow: `0 4px 20px rgba(45, 35, 24, 0.1)`
- Padding: `24px`

### 标签/徽章

- Border Radius: `9999px`
- Padding: `2px 10px`
- Font Size: `12px`
- AI 标签: `bg: #EBF3FB` `text: #6B9FD4`
- User 标签: `bg: #E9F7F0` `text: #2DB87F`
- Warning 标签: `bg: #FEF6E7` `text: #E5A84B`

### 表格

- 表头: `bg: #F5F0EB` `text: #7A6E62` `font-weight: 600`
- 行: `border-top: 1px solid #F0EAE3`
- 行 Hover: `bg: #FBF8F5`
- 单元格 Padding: `12px 16px`

---

## 5. Layout Principles

### 间距比例尺（4px 基准）

| Token | 值 | 用途 |
|-------|------|------|
| `xs` | 4px | 图标与文字间距 |
| `sm` | 8px | 紧凑元素间 |
| `md` | 12px | 表单元素间 |
| `lg` | 16px | 区块内边距 |
| `xl` | 24px | 卡片内边距 |
| `2xl` | 32px | 区块间距 |
| `3xl` | 48px | 大区域间距 |

### 留白哲学
- 宁可多留白不要拥挤
- 卡片内边距统一 24px
- 区块间距统一 32px

---

## 6. Depth & Elevation

| 层级 | Shadow | 用途 |
|------|--------|------|
| Level 0 | 无 | 页面底色 |
| Level 1 | `0 1px 3px rgba(45,35,24,0.04)` | 卡片默认 |
| Level 2 | `0 2px 12px rgba(45,35,24,0.06)` | 卡片悬停、输入框聚焦 |
| Level 3 | `0 4px 20px rgba(45,35,24,0.1)` | 弹窗、浮层 |
| Level 4 | `0 8px 32px rgba(45,35,24,0.14)` | 模态框 |

---

## 7. Do's and Don'ts

**Do's:**
- 所有颜色使用 CSS 变量，不硬编码
- 圆角统一三级：12px（按钮/输入）、16px（卡片）、9999px（标签）
- 使用暖色阴影（棕色基调），不用纯黑阴影
- 保持宽松留白

**Don'ts:**
- 不用纯黑 `#000` 或纯白 `#FFF` 作为背景
- 不用冷色蓝 `#3B82F6` — 已全量替换为珊瑚橘
- 不用方角（低于 8px 的圆角）
- 不用超过 3 种字重

---

## 8. Responsive Behavior

- 断点：`sm: 640px` `md: 768px` `lg: 1024px` `xl: 1280px`
- 触摸目标最小：44px
- 移动端卡片改为单列
- 表格在移动端横向滚动

---

## 9. Agent Prompt Guide

### 快速颜色参考
```
主色: #E8734A    主色悬停: #D4623D    主色浅底: #FDF0EC
成功: #2DB87F    危险: #E05454       警告: #E5A84B    信息: #6B9FD4
背景: #FBF8F5    卡片: #FFFFFF       次级背景: #F5F0EB
边框: #E8E0D8    主文字: #2D2318     次文字: #7A6E62  弱文字: #A89B8C
暗底: #1A1714    暗卡片: #231F1B     暗边框: #3D3630
```

### AI Agent 生成页面时应遵循：
1. 所有交互色用 `#E8734A` 系列
2. 背景用 `#FBF8F5`，卡片用 `#FFFFFF`
3. 圆角按钮 12px，卡片 16px
4. 阴影用暖色调 `rgba(45,35,24,0.06)`
5. 字体 Inter + 系统字体回退
