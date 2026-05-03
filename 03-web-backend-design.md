# Web 端后端设计方案 v0.1

本文档记录 `note-remeber` Web 端第一版的后端架构、数据库模型、权限策略、文件存储、删除规则、跳转逻辑和上线配置方案。

本文档只做后端设计，不直接创建 Supabase 表，也不直接部署 Netlify。后续可以基于本文档继续生成 SQL 迁移文件、RLS 策略和实际业务代码。

## 1. 后端总体结论

第一版后端建议采用：

```text
Netlify：托管 Web 前端，必要时承载少量 Serverless Functions
Supabase Auth：用户登录
Supabase Postgres：业务数据库
Supabase Storage：正文图片、粘贴图片、附件和流程图相关资源
Supabase RLS：数据权限隔离
```

也就是：

```text
浏览器 Web App
  -> Supabase Auth
  -> Supabase Postgres
  -> Supabase Storage
  -> Netlify Functions（仅用于少量需要服务端密钥的操作）
```

第一版不建议自建服务器。

原因：

```text
没有现成服务器环境
需要尽量使用免费资源
产品早期更需要快速跑通
Supabase 已经覆盖数据库、登录、权限和文件存储
Netlify 已经覆盖 Web 托管和函数能力
```

## 2. 后端职责划分

### 2.1 浏览器前端负责

```text
页面交互
正文编辑
流程图编辑
模糊搜索请求
普通数据增删改查
自动保存
跳转路径状态
衍生跳转深度限制
富文本 HTML 清理和展示
```

### 2.2 Supabase 负责

```text
用户登录
问题数据
文章标题数据
正文数据
见解文数据
衍生问题关系
流程图数据
图片和文件存储
数据权限隔离
唯一性约束
基础统计视图
```

### 2.3 Netlify Functions 负责

第一版大多数操作可以让前端直接访问 Supabase。

但以下操作建议放到 Netlify Functions：

```text
删除问题时清理关联 Storage 文件
删除文章时清理关联 Storage 文件
批量导出数据
后续复杂导入文章
后续需要 service role key 的管理操作
```

Netlify Functions 中可以使用 Supabase service role key，但这个 key 绝不能暴露给浏览器。

## 3. 环境变量设计

### 3.1 前端可公开环境变量

这些变量可以放在 `.env.local` 和 Netlify 环境变量中：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=note-assets
```

用途：

```text
NEXT_PUBLIC_SUPABASE_URL：Supabase 项目地址
NEXT_PUBLIC_SUPABASE_ANON_KEY：浏览器端 Supabase 匿名公钥
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET：默认文件存储桶名称
```

### 3.2 服务端私密环境变量

这些变量只能放在 Netlify 后台，不能放进前端代码：

```text
SUPABASE_SERVICE_ROLE_KEY=
```

用途：

```text
Netlify Functions 中执行受控的服务端清理、导出、维护操作
```

规则：

```text
anon key 可以放到前端
service role key 绝不能放到前端
```

## 4. 用户和权限模型

第一版虽然主要是个人使用，但数据库设计按多用户隔离来做。

用户由 Supabase Auth 管理。

每张业务表都需要有：

```text
user_id
```

所有业务表开启 Row Level Security。

基础权限规则：

```text
用户只能读取自己的数据
用户只能创建自己的数据
用户只能修改自己的数据
用户只能删除自己的数据
```

核心 RLS 判断：

```text
user_id = auth.uid()
```

不提供公开访问。

## 5. 数据库总体结构

第一版建议使用以下表：

```text
profiles
questions
answer_articles
documents
derived_question_links
flowcharts
assets
```

建议增加以下视图：

```text
question_stats
article_overview
document_overview
```

关系概览：

```text
auth.users
  -> profiles
  -> questions
       -> documents（问题见解文）
       -> answer_articles
            -> documents（文章原文正文）
            -> documents（文章见解文）

documents
  -> derived_question_links
       -> questions（衍生问题本体）

documents
  -> flowcharts

documents
  -> assets
```

## 6. 表设计

### 6.1 profiles

用于保存用户基本资料。

Supabase Auth 已经管理登录账号，`profiles` 只保存应用内显示信息。

字段设计：

```text
id：uuid，主键，等于 auth.users.id
display_name：text，可空
created_at：timestamptz
updated_at：timestamptz
```

说明：

```text
id 同时也是 user_id
每个 auth user 对应一条 profile
第一版可以很简单，甚至可以暂时不展示资料页
```

### 6.2 questions

问题库表。

字段设计：

```text
id：uuid，主键
user_id：uuid，用户 id
title：text，问题标题
title_key：text，标准化后的标题，用于防完全重名
sort_order：integer，排序
created_at：timestamptz
updated_at：timestamptz
```

`title_key` 由前端或数据库生成，规则建议：

```text
去掉首尾空格
移除所有空白字符
英文转小写
```

示例：

```text
" 发动机 的 原理是什么 " -> "发动机的原理是什么"
```

唯一性规则：

```text
同一个 user_id 下，title_key 不能重复
```

用途：

```text
防止完全重名问题
支持问题库首页
支持衍生问题复用已有问题
支持问题删除时级联清理问题下内容
```

### 6.3 answer_articles

回答文章标题表。

每个问题下面可以有多个回答文章。

字段设计：

```text
id：uuid，主键
user_id：uuid，用户 id
question_id：uuid，所属问题
title：text，文章标题
title_key：text，标准化后的标题
source_url：text，可空，来源链接
sort_order：integer，排序
is_preferred：boolean，是否为当前问题首选回答
created_at：timestamptz
updated_at：timestamptz
```

唯一性规则：

```text
同一个 question_id 下，title_key 不能重复
```

首选回答规则：

```text
同一个 question_id 下最多只能有一个 is_preferred = true 的回答文章
```

实现方式：

```text
数据库增加 partial unique index
设置首选回答时，先把同问题下其他文章 is_preferred 改为 false，再把目标文章改为 true
```

删除规则：

```text
删除问题时，级联删除该问题下所有 answer_articles
删除 answer_article 时，级联删除它的文章原文正文、文章见解文、流程图、图片引用和衍生问题引用
```

### 6.4 documents

正文内容表。

所有可编辑正文都存到这一张表。

正文类型包括：

```text
article_body：文章原文正文
article_insight：文章见解文
question_insight：问题见解文
```

字段设计：

```text
id：uuid，主键
user_id：uuid，用户 id
document_type：text，正文类型
question_id：uuid，可空，问题见解文所属问题
article_id：uuid，可空，文章正文或文章见解文所属文章
content_json：jsonb，富文本编辑器原始结构
content_html：text，富文本 HTML
plain_text：text，纯文本内容
word_count：integer，纯文本字数
content_version：integer，内容版本
created_at：timestamptz
updated_at：timestamptz
```

约束规则：

```text
document_type = question_insight 时，question_id 必填，article_id 为空
document_type = article_body 时，article_id 必填，question_id 为空
document_type = article_insight 时，article_id 必填，question_id 为空
```

唯一性规则：

```text
每个 question_id 最多一篇 question_insight
每个 article_id 最多一篇 article_body
每个 article_id 最多一篇 article_insight
```

内容保存规则：

```text
content_json：作为再次编辑的源数据
content_html：作为展示和导出的便利数据
plain_text：用于搜索、统计和判断是否为空
```

正文是否为空的判断：

```text
plain_text 去掉空白后长度为 0，视为空正文
```

注意：

```text
正文里不能长期保存 base64 图片
粘贴图片要上传到 Storage
content_json / content_html 里保存图片资源引用
```

### 6.5 derived_question_links

衍生问题关系表。

它表示：

```text
某篇正文里记录了某个衍生问题
```

字段设计：

```text
id：uuid，主键
user_id：uuid，用户 id
source_document_id：uuid，产生衍生问题的正文
derived_question_id：uuid，衍生问题本体
selected_text：text，可空，当时选中的原文或关键词
note：text，可空，记录这个衍生问题的补充说明
sort_order：integer，排序
created_at：timestamptz
updated_at：timestamptz
```

唯一性规则：

```text
同一个 source_document_id 下，不能重复关联同一个 derived_question_id
```

允许作为衍生问题来源的正文类型：

```text
article_body
question_insight
```

不允许作为衍生问题来源的正文类型：

```text
article_insight
```

删除规则：

```text
删除正文 -> 删除该正文下的 derived_question_links
删除衍生问题本体 -> 删除所有指向它的 derived_question_links
删除正文里的某个衍生问题 -> 只删除 derived_question_links 记录，不删除 questions 记录
```

### 6.6 flowcharts

流程图表。

所有可编辑正文都可以拥有流程图。

可拥有流程图的正文类型：

```text
article_body
article_insight
question_insight
```

字段设计：

```text
id：uuid，主键
user_id：uuid，用户 id
document_id：uuid，所属正文
title：text，流程图标题
nodes：jsonb，节点数据
edges：jsonb，连线数据
viewport：jsonb，画布位置和缩放
sort_order：integer，排序
created_at：timestamptz
updated_at：timestamptz
```

数据来源：

```text
@xyflow/react 的 nodes、edges、viewport
```

删除规则：

```text
删除正文 -> 级联删除该正文下的流程图
```

### 6.7 assets

资源文件表。

用于记录正文中的图片、粘贴图片、附件和后续可能的媒体资源。

字段设计：

```text
id：uuid，主键
user_id：uuid，用户 id
document_id：uuid，所属正文，可空
asset_type：text，资源类型，例如 image、attachment
bucket：text，Storage bucket 名称
storage_path：text，Storage 路径
file_name：text，原始文件名
mime_type：text，MIME 类型
size_bytes：integer，文件大小
width：integer，可空，图片宽度
height：integer，可空，图片高度
created_at：timestamptz
updated_at：timestamptz
```

`storage_path` 建议格式：

```text
{user_id}/{document_id}/{asset_id}-{safe_file_name}
```

示例：

```text
9f.../c1.../a7...-image.png
```

规则：

```text
图片文件放 Storage
数据库只保存路径和元信息
正文内容中引用 asset_id 或 storage_path
```

## 7. 视图设计

### 7.1 question_stats

问题统计视图。

用于问题库首页、衍生问题栏等位置显示：

```text
回答数量
非空正文数量
```

字段建议：

```text
question_id
user_id
answer_count
non_empty_body_count
has_question_insight
question_insight_is_empty
updated_at
```

统计规则：

```text
answer_count = answer_articles 数量
non_empty_body_count = document_type 为 article_body 且 plain_text 非空的数量
```

注意：

```text
非空正文数量只统计回答文章的原文正文
不统计文章见解文
不统计问题见解文
```

### 7.2 article_overview

回答标题页使用。

字段建议：

```text
article_id
question_id
user_id
title
source_url
sort_order
is_preferred
body_is_empty
has_article_insight
article_insight_is_empty
flowchart_count
derived_question_count
updated_at
```

用途：

```text
显示每篇文章是否有正文
显示是否有文章见解
显示是否有流程图
显示是否为首选回答
```

### 7.3 document_overview

正文页面使用。

字段建议：

```text
document_id
user_id
document_type
question_id
article_id
plain_text
word_count
is_empty
flowchart_count
derived_question_count
updated_at
```

用途：

```text
判断正文是否为空
显示流程图数量
显示衍生问题数量
```

## 8. 搜索与防重名设计

### 8.1 搜索方式

第一版采用字查询 / 模糊查询。

规则：

```text
title ilike %输入内容%
```

适用位置：

```text
问题库搜索
新建问题时相似问题提示
回答标题搜索
新建回答标题时相似标题提示
正文侧边栏衍生问题搜索
新建衍生问题时相似问题提示
```

### 8.2 搜索性能

第一版数据量不大时，`ilike` 足够。

后续数据多了，可以启用：

```text
pg_trgm 扩展
GIN trigram index
```

建议索引：

```text
questions.title
answer_articles.title
documents.plain_text
```

### 8.3 防重名

完全重名由数据库唯一约束兜底。

问题：

```text
unique(user_id, title_key)
```

回答标题：

```text
unique(question_id, title_key)
```

衍生问题关系：

```text
unique(source_document_id, derived_question_id)
```

模糊相似不禁止创建，只显示提醒。

完全重复禁止创建。

## 9. 新建衍生问题流程

正文中新建衍生问题时，不能直接盲目创建新问题。

推荐流程：

```text
1. 用户输入问题标题
2. 前端实时搜索 questions.title
3. 显示相似问题
4. 用户选择已有问题，或继续创建新问题
5. 后端根据 title_key 再判断是否已有完全相同问题
6. 如果已有问题，复用已有 question
7. 如果没有问题，创建新 question
8. 创建 derived_question_links
9. 返回该问题的 question_stats
```

为了避免并发重复，最终以后端唯一约束为准。

建议后续实现一个 Supabase RPC：

```text
add_derived_question(source_document_id, title, selected_text, note)
```

它负责原子化完成：

```text
查找或创建 question
创建 derived_question_links
返回问题统计
```

## 10. 正文保存设计

正文使用 Tiptap 富文本编辑器。

保存时同时写入：

```text
content_json
content_html
plain_text
word_count
updated_at
```

推荐策略：

```text
用户输入后 debounce 自动保存
间隔 800ms - 1500ms
页面关闭前尝试保存未提交内容
保存成功后显示已保存状态
保存失败后显示重试状态
```

正文 HTML 展示前需要清理。

前端使用：

```text
dompurify
```

图片处理规则：

```text
粘贴 base64 图片 -> 上传 Storage -> 创建 assets 记录 -> 替换正文中的图片引用
插入本地图片 -> 上传 Storage -> 创建 assets 记录 -> 插入图片节点
从网页复制外链图片 -> 第一版可以保留外链，后续支持转存
```

重要规则：

```text
不要把大图片长期以 base64 形式存进 content_json 或 content_html
```

## 11. Storage 设计

Storage bucket 建议：

```text
note-assets
```

建议设为私有 bucket。

路径规则：

```text
{user_id}/{document_id}/{asset_id}-{file_name}
```

读取规则：

```text
用户打开正文
-> 读取正文内容
-> 找到正文引用的 assets
-> 为 Storage 私有文件生成可访问 URL
-> 渲染图片
```

第一版可以选择两种实现：

```text
方案 A：前端用 Supabase Storage createSignedUrl 生成短期签名 URL
方案 B：Storage RLS 允许用户读取自己路径下文件，前端直接读取
```

推荐方案：

```text
私有 bucket + 用户路径隔离 + signed URL
```

删除文件注意：

```text
删除数据库记录不会自动删除 Storage 文件
```

所以删除问题和文章时，需要额外清理 Storage。

## 12. 删除设计

所有删除操作前端都必须弹确认框。

后端删除分两层：

```text
数据库级联删除
Storage 文件清理
```

### 12.1 删除问题

用户点击删除问题后：

```text
1. 前端弹确认框
2. 调用 Netlify Function delete-question
3. Function 验证用户身份
4. Function 查询该问题下所有 documents
5. Function 查询这些 documents 下的 assets
6. Function 删除 questions 记录
7. 数据库通过 cascade 删除回答标题、正文、流程图、衍生问题引用、assets 记录
8. Function 删除 Storage 中对应文件
9. 返回删除结果
```

数据库删除范围：

```text
问题本身
问题见解文
回答标题
文章原文正文
文章见解文
流程图
assets 记录
衍生问题引用
```

不会删除：

```text
这些正文里引用过的其他衍生问题本体
```

如果问题 A 被其他正文作为衍生问题引用，那么删除问题 A 本身时，那些引用也会被删除。

### 12.2 删除回答标题

用户点击删除回答标题后：

```text
1. 前端弹确认框
2. 调用 Netlify Function delete-article
3. Function 验证用户身份
4. Function 查询该文章下 documents
5. Function 查询这些 documents 下的 assets
6. Function 删除 answer_articles 记录
7. 数据库 cascade 删除正文、见解文、流程图、assets 记录、衍生问题引用
8. Function 删除 Storage 文件
9. 返回删除结果
```

不会删除：

```text
该文章正文里记录过的衍生问题本体
```

### 12.3 删除正文里的衍生问题

只需要删除：

```text
derived_question_links
```

不会删除：

```text
questions
answer_articles
documents
flowcharts
assets
```

这个操作可以直接由前端调用 Supabase 完成，不需要 Netlify Function。

### 12.4 Storage 清理失败处理

如果数据库删除成功，但 Storage 文件删除失败：

```text
用户数据在应用中已经不可见
Function 返回 warning
后续可提供清理孤儿文件功能
```

第一版可以先记录失败路径，后续增加：

```text
orphan_asset_cleanup
```

## 13. 衍生问题跳转后端逻辑

衍生问题跳转目标有两个：

```text
问题见解文
首选回答文章
```

### 13.1 跳转到问题见解文

后端查询：

```text
documents where document_type = question_insight and question_id = target_question_id
```

如果不存在：

```text
创建一篇空 question_insight
```

返回：

```text
document_id
is_empty
question_id
```

前端展示：

```text
如果为空，提示暂无见解或内容较少
提供跳转到首选回答文章按钮
```

### 13.2 跳转到首选回答文章

后端查询顺序：

```text
1. 查找 target_question_id 下 is_preferred = true 的 answer_article
2. 检查该 article 的 article_body 是否非空
3. 如果可用，返回该 article_body document
4. 如果不可用，查找排序最靠前且 article_body 非空的回答文章
5. 如果找到，返回该 article_body document
6. 如果只有标题但没有非空正文，返回 NO_NON_EMPTY_BODY
7. 如果没有回答标题，返回 NO_ANSWER_ARTICLE
```

返回结构建议：

```text
status: ok | no_non_empty_body | no_answer_article
question_id
article_id
document_id
reason
```

建议后续实现一个 Supabase RPC：

```text
resolve_question_jump(target_question_id, jump_target)
```

其中：

```text
jump_target = insight | preferred_article
```

### 13.3 跳转深度限制

跳转深度限制主要由前端控制。

后端只负责返回目标内容。

前端需要维护：

```text
isDerivedJump
derivedJumpDepth
originQuestionId
originArticleId
originDocumentId
targetQuestionId
```

规则：

```text
derivedJumpDepth = 0 时，可以显示衍生问题栏
derivedJumpDepth = 1 时，不再显示衍生问题栏
```

在同一个衍生目标中切换：

```text
问题见解文 <-> 首选回答文章
```

不增加跳转深度。

## 14. 顶部路径和返回逻辑

顶部导航路径属于前端运行状态，不需要长期存入数据库。

建议前端状态结构：

```text
path_items:
  - type: questions_home
  - type: answer_list
    question_id
  - type: article_body
    question_id
    article_id
    document_id
  - type: derived_insight
    target_question_id
    document_id
  - type: derived_preferred_article
    target_question_id
    article_id
    document_id
```

返回原正文时，前端需要记录：

```text
origin_document_id
origin_scroll_position
```

滚动位置可以先放在浏览器状态或 sessionStorage。

第一版不需要存数据库。

## 15. RLS 权限策略设计

所有业务表都开启 RLS。

基础策略：

```text
select：user_id = auth.uid()
insert：user_id = auth.uid()
update：user_id = auth.uid()
delete：user_id = auth.uid()
```

需要注意：

```text
不能让用户写入别人的 question_id
不能让用户把自己的 document 关联到别人的 article
不能让用户把 derived_question_links 指向别人的 question
```

因此除了表级 RLS，还需要在插入和更新时校验外键所属用户。

实现方式可以是：

```text
RLS with check
数据库 trigger 校验 user_id 一致
或者所有复杂写入通过 RPC
```

第一版推荐：

```text
普通表直接 RLS
复杂操作用 RPC 或 Netlify Function
```

## 16. Storage 权限策略设计

Storage bucket：

```text
note-assets
```

路径必须以用户 id 开头：

```text
{auth.uid()}/...
```

Storage 权限：

```text
用户只能上传到自己 user_id 开头的路径
用户只能读取自己 user_id 开头的路径
用户只能删除自己 user_id 开头的路径
```

服务端清理：

```text
Netlify Functions 使用 service role key 删除 Storage 文件
```

## 17. 推荐的后端函数

后续实现时，建议增加这些数据库 RPC 或 Netlify Functions。

### 17.1 Supabase RPC

```text
set_preferred_answer(question_id, article_id)
```

作用：

```text
同一事务内清空其他首选回答，再设置目标回答为首选
```

```text
add_derived_question(source_document_id, title, selected_text, note)
```

作用：

```text
复用或创建问题
创建衍生问题关系
返回 question_stats
```

```text
resolve_question_jump(target_question_id, jump_target)
```

作用：

```text
计算衍生问题跳转目标
返回 document_id 或无法跳转原因
```

### 17.2 Netlify Functions

```text
delete-question
delete-article
export-user-data
cleanup-orphan-assets
```

第一版最值得先做：

```text
delete-question
delete-article
```

原因：

```text
它们需要同时处理数据库和 Storage 文件
```

## 18. 数据备份与导出

这个产品会保存大量个人知识内容，备份很重要。

第一版可以先不做自动备份，但设计上应该预留导出能力。

建议导出内容：

```text
questions
answer_articles
documents
derived_question_links
flowcharts
assets 元信息
Storage 文件下载包
```

导出格式：

```text
JSON 数据包
HTML 正文包
图片文件夹
```

后续可以做：

```text
一键导出全部数据
按问题导出
按文章导出
```

## 19. 上线配置清单

真正上线前需要完成：

```text
1. 创建 Supabase 项目
2. 创建数据库表
3. 创建索引和唯一约束
4. 创建统计视图
5. 开启 RLS
6. 编写 RLS policy
7. 创建 Storage bucket：note-assets
8. 配置 Storage policy
9. 创建 Netlify 项目
10. 配置 Netlify 环境变量
11. 配置 Supabase Auth 回调地址
12. 本地 .env.local 配置 Supabase URL 和 anon key
13. 运行本地开发环境测试登录和 CRUD
14. 部署到 Netlify 预览环境
15. 部署到 Netlify 生产环境
```

## 20. 第一版后端实现优先级

建议按以下顺序实现：

```text
1. Supabase Auth 登录
2. questions 表和问题库 CRUD
3. answer_articles 表和回答标题 CRUD
4. documents 表和三类正文保存
5. question_stats / article_overview 视图
6. derived_question_links 表和衍生问题栏
7. 首选回答逻辑
8. 衍生问题跳转逻辑
9. flowcharts 表和流程图保存
10. assets 表和 Storage 图片上传
11. 删除问题和删除文章的清理函数
12. 数据导出
```

## 21. 当前后端方案总结

第一版后端可以概括为：

```text
Supabase 做主后端
Netlify 做部署和少量服务端函数
Postgres 保存结构化数据和富文本内容
Storage 保存图片和文件
RLS 保证每个用户只能访问自己的数据
视图负责统计
RPC 负责复杂原子操作
Functions 负责带服务端密钥的清理和导出
```

这套设计满足当前产品要求：

```text
问题库
回答标题
富文本正文
文章见解文
问题见解文
衍生问题
衍生跳转
首选回答
流程图
图片存储
模糊搜索
防重名
删除清理
上线互联网
```
