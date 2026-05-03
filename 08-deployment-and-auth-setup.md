# 部署与 Auth 配置设计 v0.1

本文档记录 `note-remeber` Web 端第一版的上线部署、Supabase Auth、Netlify 环境变量、本地开发环境和生产环境配置方案。

本文档基于：

```text
02-web-technical-environment.md
03-web-backend-design.md
05-supabase-database-sql-design.md
06-web-data-api-design.md
```

参考官方文档：

```text
Supabase Auth Redirect URLs：https://supabase.com/docs/guides/auth/redirect-urls
Supabase Passwordless Email Login：https://supabase.com/docs/guides/auth/auth-email-passwordless
Supabase Storage：https://supabase.com/docs/guides/storage
Netlify Environment Variables：https://docs.netlify.com/build/environment-variables/overview
Netlify Build Environment Variables：https://docs.netlify.com/configure-builds/environment-variables/
```

## 1. 总体上线目标

第一版上线目标：

```text
Web 页面可以通过互联网访问
用户必须登录后才能使用
数据保存在 Supabase 云端
图片和文件保存在 Supabase Storage
前端部署在 Netlify
删除等服务端清理操作由 Netlify Functions 执行
```

整体架构：

```text
用户浏览器
  -> Netlify 静态站点
  -> Supabase Auth
  -> Supabase Postgres
  -> Supabase Storage
  -> Netlify Functions
```

## 2. 环境划分

第一版至少区分两个环境：

```text
本地开发环境
生产环境
```

后续可以增加：

```text
Netlify Deploy Preview
Staging 测试环境
```

### 2.1 本地开发环境

本地地址：

```text
http://localhost:3000
```

启动命令：

```text
npm run dev
```

本地环境变量文件：

```text
.env.local
```

注意：

```text
.env.local 不能提交到 Git
```

### 2.2 生产环境

生产环境由 Netlify 托管。

生产 URL 可能是：

```text
https://<netlify-site-name>.netlify.app
```

如果后续绑定自定义域名，则生产 URL 改为：

```text
https://<your-domain>
```

Supabase Auth 的 Site URL 必须使用生产 URL。

## 3. 当前 Netlify 构建配置

当前 `netlify.toml`：

```toml
[build]
command = "npm run build"
publish = "out"

[build.environment]
NODE_VERSION = "22"
```

说明：

```text
Next.js 使用静态导出
构建命令为 npm run build
发布目录为 out
Netlify 云端构建使用 Node 22
```

## 4. 环境变量设计

### 4.1 本地 `.env.local`

本地开发需要：

```text
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=note-assets
SUPABASE_SERVICE_ROLE_KEY=
```

说明：

```text
NEXT_PUBLIC_* 会进入浏览器代码
SUPABASE_SERVICE_ROLE_KEY 只能在服务端使用
```

如果本地暂时不跑 Netlify Functions，可以先不填 `SUPABASE_SERVICE_ROLE_KEY`。

### 4.2 Netlify 生产环境变量

Netlify 生产环境需要：

```text
NEXT_PUBLIC_SITE_URL=https://<netlify-site-name>.netlify.app
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=note-assets
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
```

变量作用：

```text
NEXT_PUBLIC_SITE_URL：前端生成 Auth 回调地址
NEXT_PUBLIC_SUPABASE_URL：Supabase 项目地址
NEXT_PUBLIC_SUPABASE_ANON_KEY：浏览器端 Supabase key
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET：默认 Storage bucket
SUPABASE_SERVICE_ROLE_KEY：Netlify Functions 专用服务端密钥
```

安全规则：

```text
service role key 不能以 NEXT_PUBLIC_ 开头
service role key 不能写入前端代码
service role key 不能提交到 Git
```

### 4.3 Netlify 变量作用范围

建议：

```text
NEXT_PUBLIC_*：Builds 需要可用，因为静态前端构建时会读取
SUPABASE_SERVICE_ROLE_KEY：Functions 需要可用
```

如果使用 Netlify UI 配置变量，应检查变量 scope 是否覆盖对应场景。

## 5. Supabase 项目配置

### 5.1 创建 Supabase 项目

需要创建一个新的 Supabase 项目，专门给 `note-remeber` 使用。

不要复用旧项目数据库，避免数据和权限混在一起。

创建后需要记录：

```text
Project URL
anon public key
service role key
```

其中：

```text
Project URL 和 anon public key 放到前端环境变量
service role key 只放到 Netlify Functions 环境变量
```

### 5.2 执行数据库 SQL

在 Supabase SQL Editor 中执行后续迁移 SQL。

迁移 SQL 应来自：

```text
05-supabase-database-sql-design.md
```

执行完成后需要确认：

```text
表已创建
视图已创建
RPC 已创建
RLS 已开启
Policy 已创建
Storage bucket 已创建
Storage policy 已创建
```

### 5.3 创建 Storage bucket

bucket 名称：

```text
note-assets
```

建议：

```text
Private bucket
通过 RLS 和 signed URL 控制访问
```

用途：

```text
正文图片
粘贴图片
附件
后续导入资源
```

## 6. Auth 登录方案

第一版推荐使用：

```text
邮箱 OTP 验证码登录
```

原因：

```text
不需要记密码
比 Magic Link 更少依赖 URL hash 回调
适合静态部署和 hash 路由
适合个人应用
```

登录流程：

```text
1. 用户输入邮箱
2. 前端调用 signInWithOtp
3. 用户收到邮箱验证码
4. 用户在页面输入验证码
5. 前端调用 verifyOtp
6. Supabase 返回 session
7. 进入问题库首页
```

## 7. 个人应用的账号策略

这个产品第一阶段主要给自己使用。

推荐策略：

```text
先在 Supabase Dashboard 里创建自己的用户
前端登录时设置 shouldCreateUser: false
不允许陌生邮箱自动注册
```

原因：

```text
防止别人通过公开网页注册空账号
降低免费额度被滥用的风险
你的数据仍然由 RLS 隔离
```

登录发送验证码时：

```ts
await supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: false
  }
});
```

验证码验证时：

```ts
await supabase.auth.verifyOtp({
  email,
  token,
  type: "email"
});
```

如果后续要开放给别人使用，再改为：

```text
允许注册
增加用户引导
增加配额控制
增加滥用防护
```

## 8. Supabase Auth Email 配置

### 8.1 Email Provider

需要启用：

```text
Email Auth
```

Supabase 邮箱登录支持 Magic Link 和 OTP。

如果选择邮箱 OTP，需要检查 Email Template，确保邮件里包含验证码 token。

Supabase 官方说明中，Magic Link 和 OTP 共用 `signInWithOtp`，区别主要在邮件模板。

### 8.2 OTP 邮件模板

OTP 邮件模板需要包含：

```text
{{ .Token }}
```

示例方向：

```html
<h2>登录验证码</h2>
<p>你的验证码是：{{ .Token }}</p>
```

第一版只需要可用，不需要复杂品牌邮件。

### 8.3 OTP 安全设置

建议使用 Supabase 默认限制。

注意：

```text
验证码有过期时间
同一用户请求验证码有频率限制
不要把过期时间设置得过长
```

Supabase 官方文档提醒，过长的 OTP 有效期会增加暴力猜测风险。

## 9. Supabase Auth URL 配置

即使使用 OTP，仍然建议正确配置 Auth URL，方便后续 Magic Link、密码重置或 OAuth。

### 9.1 Site URL

生产环境 Site URL：

```text
https://<netlify-site-name>.netlify.app
```

如果绑定自定义域名：

```text
https://<your-domain>
```

Supabase 官方文档说明，Site URL 是未显式传入 redirectTo 时的默认跳转地址。

### 9.2 Redirect URLs

需要加入：

```text
http://localhost:3000/**
https://<netlify-site-name>.netlify.app/**
https://**--<netlify-site-name>.netlify.app/**
```

用途：

```text
localhost：本地开发
生产 URL：正式站点
Netlify deploy preview URL：预览部署
```

生产环境尽量使用精确 URL。

Netlify 预览环境可以使用通配符。

## 10. Auth 与 hash 路由的关系

第一版前端计划使用：

```text
/#/questions
```

这种 hash 路由适合静态部署。

但 Magic Link 的隐式登录流程也可能使用 URL hash 传递认证信息。

因此第一版推荐 OTP 验证码登录，避免 hash 路由和认证回调互相干扰。

如果后续改用 Magic Link，需要：

```text
在应用初始化时先处理 Supabase Auth hash
再处理应用自己的 hash route
或者改为非 hash 路由并配置 Netlify rewrite
```

## 11. Netlify 部署方式

可以选择两种方式。

### 11.1 Git-based 部署

适合正式开发。

流程：

```text
1. 把项目推到 GitHub
2. Netlify 连接 GitHub repo
3. 设置 build command：npm run build
4. 设置 publish directory：out
5. 配置环境变量
6. push 后自动部署
```

优点：

```text
长期维护更方便
每次 push 自动部署
可以有 deploy preview
```

### 11.2 Manual deploy

适合早期原型。

流程：

```text
1. 本地 npm run build
2. 上传 out 目录到 Netlify
```

也可以用 Netlify CLI：

```text
npx netlify deploy
npx netlify deploy --prod
```

当前本机没有全局 Netlify CLI，但可以使用 `npx netlify`，不必全局安装。

## 12. Netlify CLI 状态文件

如果后续使用 Netlify CLI link 项目，会生成：

```text
.netlify/
```

这个目录包含本地站点链接状态，不应该提交到 Git。

当前 `.gitignore` 已加入：

```text
.netlify/
```

## 13. Netlify Functions 配置

后续需要新增：

```text
netlify/functions/delete-question.js
netlify/functions/delete-article.js
```

如果使用 Functions，需要在 `netlify.toml` 中增加：

```toml
[functions]
directory = "netlify/functions"
```

第一版在真正写 Function 时再加入。

Functions 需要：

```text
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_URL
```

注意：

```text
Function 必须验证 Authorization Bearer token
Function 内所有删除都必须限定当前 user_id
```

## 14. 本地开发流程

首次配置：

```text
1. 创建 Supabase 项目
2. 执行数据库 SQL
3. 创建自己的 Auth 用户
4. 复制 .env.example 为 .env.local
5. 填入 Supabase URL 和 anon key
6. 启动 npm run dev
7. 打开 http://localhost:3000
8. 用邮箱 OTP 登录
```

日常开发：

```text
npm run dev
npm run build
```

如果需要本地测试 Netlify Functions：

```text
npx netlify dev
```

但第一版前期页面和 Supabase CRUD 开发可以先用：

```text
npm run dev
```

## 15. 生产部署流程

建议流程：

```text
1. 确认本地 npm run build 成功
2. 创建或连接 Netlify 项目
3. 配置 Netlify 环境变量
4. 部署 preview
5. 在 Supabase Auth 加入 preview redirect URL
6. 测试登录
7. 测试问题 CRUD
8. 测试正文保存
9. 测试图片上传
10. 测试删除
11. 部署 production
12. 把 production URL 设置为 Supabase Site URL
```

## 16. 上线前安全检查

必须确认：

```text
.env.local 没有提交
SUPABASE_SERVICE_ROLE_KEY 没有进入前端代码
SUPABASE_SERVICE_ROLE_KEY 没有 NEXT_PUBLIC_ 前缀
RLS 已开启
业务表 policy 已创建
Storage bucket 是 private
Storage policy 只允许访问自己的 user_id 路径
Auth 登录不允许陌生用户自动注册
Supabase Site URL 是生产 URL
Redirect URLs 包含 localhost 和 Netlify 预览 URL
Netlify 环境变量配置完整
生产站点可以登录
未登录无法看到应用数据
```

## 17. 上线后维护

上线后需要定期关注：

```text
Supabase 免费额度
Netlify 免费额度
Storage 文件大小
数据库大小
Auth 用户列表
部署日志
Function 错误日志
```

后续建议增加：

```text
数据导出
备份恢复
孤儿 Storage 文件清理
错误监控
```

## 18. 常见问题

### 18.1 登录邮件收不到

检查：

```text
邮箱是否正确
垃圾邮件
Supabase Auth Email Provider 是否启用
是否触发频率限制
邮件模板是否正确
```

### 18.2 OTP 无法登录

检查：

```text
用户是否已经在 Supabase Auth 中存在
shouldCreateUser 是否为 false
验证码是否过期
verifyOtp 的 type 是否为 email
```

### 18.3 生产环境登录后跳错地址

检查：

```text
NEXT_PUBLIC_SITE_URL
Supabase Site URL
Supabase Redirect URLs
Netlify 生产 URL
```

### 18.4 图片上传失败

检查：

```text
Storage bucket 是否存在
bucket 是否为 note-assets
Storage policy 是否允许当前用户路径
storage_path 是否以 user_id 开头
文件是否太大
```

### 18.5 本地能用，Netlify 不能用

检查：

```text
Netlify 环境变量是否配置
变量 scope 是否包含 Builds 或 Functions
生产 URL 是否加入 Supabase Redirect URLs
Netlify build log 是否有错误
```

## 19. 实施优先级

建议按这个顺序做：

```text
1. 创建 Supabase 项目
2. 执行数据库 SQL
3. 创建 Storage bucket 和 policy
4. 创建自己的 Auth 用户
5. 配置本地 .env.local
6. 实现 Auth 登录页面
7. 本地验证登录和 RLS
8. 创建 Netlify 项目
9. 配置 Netlify 环境变量
10. 部署 preview
11. 配置 Supabase Redirect URLs
12. 测试 preview 登录和数据读写
13. 部署 production
14. 设置 Supabase Site URL 为生产 URL
```

## 20. 当前设计总结

第一版部署和登录方案可以概括为：

```text
Netlify 托管静态 Web
Supabase 承担 Auth、数据库和 Storage
邮箱 OTP 作为登录方式
手动创建自己的用户，禁止陌生用户自动注册
本地用 .env.local
生产环境变量放 Netlify
service role key 只给 Netlify Functions
Supabase Site URL 和 Redirect URLs 必须配置正确
```

这套方案能满足：

```text
免费或低成本上线
互联网访问
个人数据私有
可本地开发
可生产部署
后续可扩展到多人使用
```
