# Web 实施路线图 v0.1

本文档记录 `note-remeber` Web 端第一版的实施路线图。

前面文档已经完成：

```text
01-web-product-spec.md
02-web-technical-environment.md
03-web-backend-design.md
04-web-frontend-design.md
05-supabase-database-sql-design.md
06-web-data-api-design.md
07-rich-editor-and-flowchart-design.md
08-deployment-and-auth-setup.md
09-web-test-and-acceptance-checklist.md
```

本文档的目标是把设计转成可执行开发计划。

## 1. 实施总体原则

第一版开发遵循：

```text
先跑通主链路，再完善高级体验
先做真实数据存储，再做视觉 polish
先保证权限和删除安全，再扩展批量能力
先完成 Web 端，不做 App 端
先做个人可用，不做多人协作
```

第一版必须跑通的核心链路：

```text
登录
-> 创建问题
-> 创建回答标题
-> 编辑文章正文
-> 添加衍生问题
-> 写问题见解
-> 从衍生问题跳转到见解或首选回答
-> 返回原正文
-> 创建流程图
```

## 2. 阶段划分

建议分为 10 个阶段：

```text
阶段 0：项目整理与基础骨架
阶段 1：Supabase 云端落库
阶段 2：Auth 登录与 App Shell
阶段 3：问题库
阶段 4：回答标题页
阶段 5：正文文档系统
阶段 6：衍生问题与跳转
阶段 7：富文本能力增强和图片上传
阶段 8：流程图
阶段 9：删除、清理、部署与验收
```

## 3. 阶段 0：项目整理与基础骨架

当前状态：

```text
已完成 Next.js 项目骨架
已完成 npm 依赖安装
已完成 Netlify 静态构建配置
已完成 Git 初始化
已完成设计文档 01-10
```

还需要：

```text
整理 src 目录结构
建立基础 App Shell
建立统一类型文件
建立 Supabase client 文件
建立 React Query Provider
建立 Zustand 导航状态 store
```

产物：

```text
src/lib/supabase/client.ts
src/lib/query-client.ts
src/types/domain.ts
src/data/
src/hooks/
src/components/
```

验收：

```text
npm run build 成功
页面能正常打开
基础 provider 不报错
```

## 4. 阶段 1：Supabase 云端落库

目标：

```text
创建 note-remeber 专用 Supabase 项目
执行数据库 SQL
配置 Storage bucket
配置 RLS
创建自己的 Auth 用户
```

任务：

```text
创建 Supabase 项目
根据 05 文档生成正式迁移 SQL
执行 SQL
创建 note-assets bucket
配置 Storage policy
创建自己的用户
配置本地 .env.local
```

产物：

```text
Supabase 项目
数据库表
视图
RPC
RLS policy
Storage bucket
.env.local
```

验收：

```text
能用 anon key 连接 Supabase
登录用户能读取自己的空数据
RLS 已开启
Storage bucket 存在
```

## 5. 阶段 2：Auth 登录与 App Shell

目标：

```text
未登录显示登录页
登录后进入问题库
支持邮箱 OTP 登录
支持退出登录
```

任务：

```text
实现 Supabase auth data functions
实现 useAuth
实现登录页
实现 OTP 输入和验证
实现 AppShell
实现顶部导航栏基础结构
实现退出登录
```

产物：

```text
登录页
AppShell
Auth hooks
顶部导航栏基础版
```

验收：

```text
未登录不能看到应用页面
已授权邮箱可以登录
未授权邮箱不能自动注册
退出登录后回到登录页
npm run build 成功
```

## 6. 阶段 3：问题库

目标：

```text
完成问题库首页的创建、搜索、编辑、统计展示
```

任务：

```text
实现 questions data functions
实现 listQuestions
实现 searchSimilarQuestions
实现 createQuestion
实现 updateQuestionTitle
实现问题库页面
实现新建问题弹窗或输入框
实现相似问题提示
实现问题行内编辑
实现问题统计显示
```

暂不做：

```text
删除问题
```

删除放到阶段 9，因为需要 Netlify Function 和 Storage 清理。

产物：

```text
问题库首页
问题搜索
新建问题
问题重名拦截
问题统计
```

验收：

```text
可以创建问题
完全重名问题不能创建
搜索按字匹配
问题列表显示回答数和正文数
编辑标题后自动保存
```

## 7. 阶段 4：回答标题页

目标：

```text
完成某个问题下回答文章标题的创建、搜索、编辑、首选回答
```

任务：

```text
实现 articles data functions
实现 listArticles
实现 searchSimilarArticles
实现 createArticle
实现 updateArticleTitle
实现 updateArticleSourceUrl
实现 setPreferredAnswer RPC 调用
实现回答标题页
实现问题见解入口
实现新建回答标题
实现相似标题提示
实现首选回答标记
```

产物：

```text
回答标题页
新建回答标题
回答标题搜索
首选回答设置
来源链接编辑
```

验收：

```text
点击问题进入标题页
可以创建回答标题
同问题下重名标题不能创建
创建标题后生成空 article_body
可以设置首选回答
同一问题最多一个首选回答
```

## 8. 阶段 5：正文文档系统

目标：

```text
完成文章原文正文、文章见解文、问题见解文的基础编辑和保存
```

任务：

```text
实现 documents data functions
实现 ensureArticleBody
实现 ensureArticleInsight
实现 ensureQuestionInsight
实现 getDocument
实现 saveDocument
实现基础 Tiptap 编辑器
实现自动保存状态
实现正文编辑页
实现文章见解页
实现问题见解页
实现顶部路径基础逻辑
```

第一阶段富文本能力先支持：

```text
段落
标题
加粗
斜体
下划线
列表
引用
链接
```

产物：

```text
文章原文正文可编辑
文章见解文可编辑
问题见解文可编辑
自动保存
顶部路径基础版
```

验收：

```text
回答标题可以进入正文
正文能保存
刷新后内容仍在
可以打开文章见解
可以打开问题见解
文章见解不显示衍生问题栏
```

## 9. 阶段 6：衍生问题与跳转

目标：

```text
完成衍生问题栏、衍生问题新建、跳转到问题见解或首选回答、返回原正文
```

任务：

```text
实现 derived questions data functions
实现 listDerivedQuestions
实现 addDerivedQuestion RPC 调用
实现 removeDerivedQuestionLink
实现 jumps data functions
实现 resolveJumpToInsight
实现 resolveJumpToPreferredArticle
实现衍生问题侧边栏
实现新建衍生问题相似提示
实现跳转选择弹窗
实现无法跳转提示
实现跳转深度限制
实现返回原正文
完善顶部路径
```

产物：

```text
衍生问题栏
衍生问题新建与复用
衍生问题统计显示
跳转选择
衍生跳转页
返回原正文
```

验收：

```text
文章原文正文能添加衍生问题
问题见解文能添加衍生问题
文章见解文不能添加衍生问题
全局已有问题会被复用
衍生问题显示回答数和正文数
可以跳转到问题见解
可以跳转到首选回答
无回答时提示无法跳转
衍生跳转后不再显示衍生问题栏
```

## 10. 阶段 7：富文本能力增强和图片上传

目标：

```text
把正文编辑器提升到可长期使用的富文本水平
```

任务：

```text
补充文字颜色
补充背景高亮
补充字体
补充字号
补充表格
补充分割线
补充清除格式
实现浮动工具栏
实现选中文本创建衍生问题
实现图片上传到 Storage
实现 assets 记录
实现图片 signed URL
实现粘贴 HTML 清理
实现 base64 图片转存
```

产物：

```text
完整富文本工具栏
图片上传
表格编辑
HTML 清理
浮动工具栏
```

验收：

```text
网页粘贴能保留基础格式
Word 粘贴能保留主要结构
图片上传后能显示
刷新后图片仍可显示
正文不长期保存 base64 图片
选中文本可以创建衍生问题
```

## 11. 阶段 8：流程图

目标：

```text
完成所有可编辑正文的流程图创建、编辑、保存和全屏
```

任务：

```text
实现 flowcharts data functions
实现 listFlowcharts
实现 createFlowchart
实现 saveFlowchart
实现 deleteFlowchart
实现流程图面板
实现流程图列表
接入 @xyflow/react
实现新增节点
实现节点文字编辑
实现节点拖拽
实现创建连线
实现删除节点和连线
实现流程图自动保存
实现全屏模式
```

产物：

```text
流程图侧边面板
流程图列表
流程图编辑画布
流程图自动保存
流程图全屏
```

验收：

```text
文章原文正文能创建流程图
文章见解文能创建流程图
问题见解文能创建流程图
不同正文流程图互相独立
刷新后流程图仍存在
删除流程图需要确认
```

## 12. 阶段 9：删除、清理、部署与验收

目标：

```text
补齐危险操作、服务端清理、上线部署和完整验收
```

任务：

```text
实现确认弹窗组件
实现 delete-question Netlify Function
实现 delete-article Netlify Function
实现 Storage 文件清理
实现问题删除入口
实现文章删除入口
实现流程图删除确认
实现衍生问题删除确认
配置 Netlify 项目
配置 Netlify 环境变量
配置 Supabase Auth Redirect URLs
部署 preview
部署 production
按 09 文档完整验收
```

产物：

```text
删除确认
服务端删除函数
Storage 清理
Netlify 线上站点
完整验收记录
```

验收：

```text
所有删除都有确认
删除问题不会误删其他问题
删除文章不会误删衍生问题本体
线上登录可用
线上数据读写可用
线上图片上传可用
```

## 13. 每阶段通用完成标准

每个阶段完成后都要：

```text
npm run build 成功
没有明显 TypeScript 错误
核心路径手动验证
不提交 .env.local
不暴露 service role key
新文档或实现与现有设计一致
```

如果阶段涉及数据库：

```text
确认 RLS 不被绕过
确认 user_id 一致性
确认唯一约束工作
```

如果阶段涉及删除：

```text
确认有二次确认
确认删除范围符合设计
```

## 14. 第一版可以暂缓的功能

为了尽快做出可用版本，以下可以放到第一版之后：

```text
外链图片一键转存
正文历史版本
多人协作
全文高级搜索
中文分词搜索
流程图自动布局
流程图节点分组
流程图和正文段落强绑定
流程图问题节点跳转
数据一键导出
数据恢复导入
移动端 App 打包
```

这些功能要预留设计空间，但不要阻塞第一版主链路。

## 15. 开发风险排序

风险从高到低：

```text
富文本粘贴和图片处理
Storage 权限和文件清理
衍生跳转路径状态
RLS 和 user_id 一致性
流程图面板和保存
删除级联
Netlify Functions 鉴权
```

应对策略：

```text
富文本先做基础能力，再增强粘贴
图片先支持本地上传，再支持复杂粘贴
跳转状态先做简单路径，再恢复滚动位置
删除先在测试数据中验证，再接生产数据
RLS 每次新表都单独验证
```

## 16. 建议的开发节奏

可以按这个节奏推进：

```text
第 1 轮：阶段 0-2，项目能登录
第 2 轮：阶段 3-4，问题和标题能管理
第 3 轮：阶段 5，正文能写能保存
第 4 轮：阶段 6，衍生问题和跳转跑通
第 5 轮：阶段 7，富文本和图片完善
第 6 轮：阶段 8，流程图完成
第 7 轮：阶段 9，删除、部署、验收
```

## 17. 最小可用版本定义

如果要尽快拥有一个可用版本，最小可用范围是：

```text
登录
问题库
回答标题
文章正文
问题见解文
文章见解文
衍生问题
跳转到见解文
跳转到首选回答
基础富文本
自动保存
```

可以暂缓：

```text
复杂粘贴
图片转存
流程图
删除 Storage 清理
部署 production
```

但正式第一版必须补齐：

```text
流程图
删除确认
图片上传
线上部署
```

## 18. 代码实现顺序建议

更细的代码顺序：

```text
1. src/lib/supabase/client.ts
2. src/lib/query-client.ts
3. src/types/domain.ts
4. src/data/auth.ts
5. src/hooks/use-auth.ts
6. AppShell
7. LoginView
8. src/data/questions.ts
9. QuestionsView
10. src/data/articles.ts
11. ArticlesView
12. src/data/documents.ts
13. RichTextEditor 基础版
14. DocumentView
15. Navigation store
16. src/data/derived-questions.ts
17. DerivedQuestionsPanel
18. src/data/jumps.ts
19. JumpTargetDialog
20. src/data/assets.ts
21. 图片上传
22. RichTextEditor 完整工具栏
23. src/data/flowcharts.ts
24. FlowchartPanel
25. ConfirmDialog
26. delete-question Function
27. delete-article Function
28. 部署配置和验收
```

## 19. 每个功能的首个测试数据建议

建议第一批手动测试数据：

```text
问题 A：社会运转的规律是什么？
回答 A1：社会系统如何自组织
回答 A2：制度为什么会稳定存在
衍生问题 B：什么是自组织？
衍生问题 C：涌现是什么意思？
问题 B 的见解文 B+
文章 A1 的见解文 A1+
文章 A1 的流程图：自组织论证结构
问题 A 的流程图：社会运转框架
```

这组数据能覆盖：

```text
问题
标题
正文
见解
衍生问题
跳转
首选回答
流程图
删除
```

## 20. 当前实施路线总结

第一版实施路线可以概括为：

```text
先把 Supabase 和登录打通
再做问题和回答标题
再做正文和见解文
再做衍生问题和跳转
再强化富文本和图片
再加入流程图
最后补删除、部署和完整验收
```

这样推进的好处：

```text
每一步都有可运行产物
核心数据模型尽早被验证
复杂体验逐步叠加
避免一开始陷入富文本和流程图细节
```
