# Web 端技术环境清单 v0.1

本文档记录 `note-remeber` Web 端当前已经准备好的技术环境，以及后续上线前仍需配置的云端资源。

## 1. 本地基础环境

当前项目已可用于本地开发和静态构建。

已确认环境：

```text
Node.js: v25.9.0
npm: 11.12.1
git: 2.40.1
```

项目已初始化为 Git 仓库。

## 2. 前端与部署骨架

当前 Web 端采用：

```text
Next.js
React
TypeScript
npm
Netlify 静态部署
```

关键配置：

```text
package.json
tsconfig.json
next.config.mjs
netlify.toml
.gitignore
.netlifyignore
.env.example
```

当前构建方式：

```text
npm run build
```

构建输出目录：

```text
out
```

Netlify 发布目录：

```text
out
```

Netlify 云端构建 Node 版本：

```text
Node.js 22
```

## 3. 已安装核心依赖

### 3.1 云数据库与登录

```text
@supabase/supabase-js
```

用于连接 Supabase：

```text
Auth 登录
Postgres 数据库
Storage 文件和图片存储
```

### 3.2 富文本编辑器

```text
@tiptap/react
@tiptap/starter-kit
@tiptap/extension-underline
@tiptap/extension-link
@tiptap/extension-image
@tiptap/extension-text-style
@tiptap/extension-color
@tiptap/extension-highlight
@tiptap/extension-table
@tiptap/extension-table-row
@tiptap/extension-table-cell
@tiptap/extension-table-header
@tiptap/extension-placeholder
@tiptap/extension-text-align
@tiptap/extension-font-family
```

用于实现接近 Word 的富文本正文编辑能力。

覆盖方向：

```text
加粗
斜体
下划线
标题
列表
链接
图片
表格
颜色
高亮
字体
对齐
占位提示
```

### 3.3 流程图编辑器

```text
@xyflow/react
```

用于实现可拖拽、可连线、可编辑的流程图画布。

### 3.4 数据校验与状态管理

```text
zod
zustand
@tanstack/react-query
```

用途：

```text
zod：表单和数据结构校验
zustand：前端局部状态和导航状态管理
@tanstack/react-query：异步数据读取、缓存和刷新
```

### 3.5 安全与 UI 辅助

```text
dompurify
lucide-react
```

用途：

```text
dompurify：富文本 HTML 展示前的清理
lucide-react：图标
```

## 4. 已验证命令

已成功执行：

```text
npm install
npm run build
```

说明当前依赖可以安装，项目可以构建。

## 5. 上线前仍需配置的云端资源

以下不是本地安装问题，而是上线前必须在云端配置的资源。

### 5.1 Supabase 项目

需要一个 Supabase 项目，用于：

```text
用户登录
业务数据库
正文图片和附件存储
```

需要配置到 `.env.local` 和 Netlify 环境变量：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=note-assets
```

注意：

```text
anon key 可以放到前端环境变量
service role key 不能放到前端
```

### 5.2 Supabase 数据库表

后续需要创建业务表，例如：

```text
questions
answer_articles
documents
derived_question_links
flowcharts
assets
```

并开启 Row Level Security，保证用户只能访问自己的数据。

### 5.3 Supabase Storage bucket

需要创建存储桶，建议名称：

```text
note-assets
```

用于保存：

```text
正文图片
粘贴图片
流程图相关资源
附件
```

### 5.4 Netlify 项目

当前本地已经有 `netlify.toml`，后续可以创建或连接 Netlify 项目。

Netlify 需要配置同样的 Supabase 环境变量。

## 6. 当前结论

本地开发环境已经具备实现第一版 Web 产品的基础条件。

已经完备：

```text
Next.js 开发骨架
TypeScript 配置
Netlify 静态部署配置
Supabase 客户端依赖
富文本编辑器依赖
流程图编辑器依赖
数据校验和状态管理依赖
Git 仓库
构建验证
```

还未完成，但需要等后端设计确认后再做：

```text
Supabase 云项目配置
数据库表结构
Row Level Security 策略
Storage bucket 权限
Netlify 项目连接和环境变量
```
