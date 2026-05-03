# Web 数据访问层与 API 设计 v0.1

本文档记录 `note-remeber` Web 端第一版的数据访问层设计。

本文档回答的问题是：

```text
前端每个页面怎么读数据
每个用户动作怎么写数据
哪些操作直接调用 Supabase
哪些操作调用 Supabase RPC
哪些操作调用 Netlify Functions
前端如何缓存、刷新和处理错误
```

本文档基于：

```text
03-web-backend-design.md
04-web-frontend-design.md
05-supabase-database-sql-design.md
```

## 1. 总体设计原则

第一版数据访问层遵循：

```text
前端不在组件里直接散写 Supabase 查询
所有数据库调用集中到 data access functions
页面组件只调用 hooks 或 service functions
复杂原子操作优先走 Supabase RPC
需要 service role key 的操作走 Netlify Functions
查询结果用 React Query 缓存
局部 UI 状态用 Zustand 或组件状态
```

推荐分层：

```text
UI Components
  -> Feature Hooks
  -> Data Access Layer
  -> Supabase Client / RPC / Netlify Functions
```

## 2. 前端目录建议

后续实现时建议目录：

```text
app/
  layout.tsx
  page.tsx

src/
  lib/
    supabase/
      client.ts
      auth.ts
    query-client.ts
    text.ts
    errors.ts

  data/
    questions.ts
    articles.ts
    documents.ts
    derived-questions.ts
    flowcharts.ts
    assets.ts
    jumps.ts
    deletes.ts

  hooks/
    use-auth.ts
    use-questions.ts
    use-articles.ts
    use-document.ts
    use-derived-questions.ts
    use-flowcharts.ts
    use-navigation-state.ts

  components/
    app-shell/
    questions/
    articles/
    editor/
    derived-questions/
    flowcharts/
    dialogs/

  types/
    database.ts
    domain.ts
```

说明：

```text
data/：只负责请求和数据转换
hooks/：封装 React Query 和页面状态
components/：只负责 UI 和交互
types/：统一类型
```

## 3. Supabase Client 设计

### 3.1 浏览器客户端

文件：

```text
src/lib/supabase/client.ts
```

职责：

```text
读取 NEXT_PUBLIC_SUPABASE_URL
读取 NEXT_PUBLIC_SUPABASE_ANON_KEY
创建浏览器 Supabase client
```

使用范围：

```text
登录
普通 CRUD
RPC
Storage 上传和读取
```

### 3.2 服务端客户端

Netlify Functions 中需要单独创建服务端 Supabase client。

使用：

```text
SUPABASE_SERVICE_ROLE_KEY
```

职责：

```text
删除 Storage 文件
导出数据
清理孤儿资源
```

service role key 不允许进入浏览器代码。

## 4. 查询 Key 设计

React Query key 统一设计，方便刷新。

建议：

```text
['auth', 'user']
['questions', search, filter]
['question', questionId]
['question-stats', questionId]
['articles', questionId, search]
['article-overview', questionId]
['document', documentId]
['document-by-article', articleId, documentType]
['question-insight', questionId]
['derived-questions', documentId, search]
['flowcharts', documentId]
['assets', documentId]
['jump-target', questionId, jumpTarget]
```

刷新规则：

```text
新建问题 -> invalidate ['questions']
更新问题标题 -> invalidate ['questions'], ['question', id]
删除问题 -> invalidate ['questions']
新建文章 -> invalidate ['articles', questionId], ['questions']
保存正文 -> invalidate ['articles', questionId], ['questions'], ['document', id]
新增衍生问题 -> invalidate ['derived-questions', documentId], ['questions']
删除衍生问题 -> invalidate ['derived-questions', documentId]
设置首选回答 -> invalidate ['articles', questionId]
保存流程图 -> invalidate ['flowcharts', documentId], ['document', documentId]
```

## 5. Auth 数据访问

### 5.1 获取当前用户

操作：

```text
getCurrentUser()
```

调用：

```text
supabase.auth.getUser()
```

返回：

```text
user | null
```

### 5.2 邮箱验证码登录

操作：

```text
signInWithEmail(email)
```

调用：

```text
supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: window.location.origin
  }
})
```

### 5.3 退出登录

操作：

```text
signOut()
```

调用：

```text
supabase.auth.signOut()
```

## 6. 问题库数据访问

### 6.1 获取问题列表

操作：

```text
listQuestions({ search, filter })
```

直接 Supabase 查询：

```text
questions + question_stats
```

推荐查询：

```text
from questions
select id, title, sort_order, created_at, updated_at
按 updated_at desc 排序
search 存在时 title ilike %search%
```

然后读取 `question_stats` 视图或通过嵌套查询补充：

```text
answer_count
non_empty_body_count
has_question_insight
```

返回领域模型：

```text
QuestionListItem
  id
  title
  answerCount
  nonEmptyBodyCount
  hasQuestionInsight
  questionInsightIsEmpty
  updatedAt
```

### 6.2 搜索相似问题

操作：

```text
searchSimilarQuestions(input)
```

直接 Supabase 查询：

```text
questions.title ilike %input%
limit 10
```

用途：

```text
新建问题时提示相似问题
新建衍生问题时提示相似问题
```

### 6.3 创建问题

操作：

```text
createQuestion(title)
```

直接 Supabase insert：

```text
insert into questions(user_id, title)
```

用户 id 来自当前 auth user。

错误处理：

```text
唯一约束冲突 -> 显示已存在该问题
空标题 -> 显示标题不能为空
```

创建成功后：

```text
invalidate ['questions']
进入该问题回答标题页
```

### 6.4 更新问题标题

操作：

```text
updateQuestionTitle(questionId, title)
```

直接 Supabase update：

```text
update questions set title = title where id = questionId
```

错误处理：

```text
唯一约束冲突 -> 显示已存在同名问题
```

### 6.5 删除问题

操作：

```text
deleteQuestion(questionId)
```

调用 Netlify Function：

```text
POST /.netlify/functions/delete-question
```

原因：

```text
需要同时删除数据库记录和 Storage 文件
需要 service role key
```

请求：

```json
{
  "questionId": "uuid"
}
```

返回：

```json
{
  "ok": true,
  "deletedAssetCount": 3,
  "warnings": []
}
```

前端行为：

```text
弹确认框
确认后调用
成功后回到问题库
刷新问题列表
失败则显示错误
```

## 7. 回答标题数据访问

### 7.1 获取回答标题列表

操作：

```text
listArticles(questionId, { search })
```

查询：

```text
article_overview where question_id = questionId
search 存在时 title ilike %search%
order by sort_order asc, updated_at desc
```

返回：

```text
ArticleListItem
  id
  questionId
  title
  sourceUrl
  isPreferred
  bodyDocumentId
  bodyIsEmpty
  insightDocumentId
  hasArticleInsight
  articleInsightIsEmpty
  flowchartCount
  derivedQuestionCount
  updatedAt
```

### 7.2 搜索相似回答标题

操作：

```text
searchSimilarArticles(questionId, input)
```

查询：

```text
answer_articles where question_id = questionId and title ilike %input%
limit 10
```

### 7.3 创建回答标题

操作：

```text
createArticle(questionId, title)
```

直接 Supabase insert：

```text
insert into answer_articles(user_id, question_id, title)
```

创建成功后：

```text
调用 ensure_article_document(articleId, 'article_body')
刷新回答标题列表
可直接进入正文页
```

说明：

```text
创建标题后立即创建空 article_body，方便后续统一进入正文编辑页
```

### 7.4 更新回答标题

操作：

```text
updateArticleTitle(articleId, title)
```

直接 Supabase update。

错误：

```text
唯一约束冲突 -> 显示该问题下已有同名标题
```

### 7.5 更新来源链接

操作：

```text
updateArticleSourceUrl(articleId, sourceUrl)
```

直接 Supabase update。

### 7.6 设置首选回答

操作：

```text
setPreferredAnswer(questionId, articleId)
```

调用 RPC：

```text
set_preferred_answer(questionId, articleId)
```

原因：

```text
需要在同一事务内取消其他首选，再设置目标首选
```

### 7.7 删除回答标题

操作：

```text
deleteArticle(articleId)
```

调用 Netlify Function：

```text
POST /.netlify/functions/delete-article
```

请求：

```json
{
  "articleId": "uuid"
}
```

成功后：

```text
刷新回答标题列表
刷新问题统计
如果当前在该正文页，返回回答标题页
```

## 8. 正文数据访问

### 8.1 确保文章正文存在

操作：

```text
ensureArticleBody(articleId)
```

调用 RPC：

```text
ensure_article_document(articleId, 'article_body')
```

返回：

```text
documentId
```

### 8.2 确保文章见解文存在

操作：

```text
ensureArticleInsight(articleId)
```

调用 RPC：

```text
ensure_article_document(articleId, 'article_insight')
```

返回：

```text
documentId
```

### 8.3 确保问题见解文存在

操作：

```text
ensureQuestionInsight(questionId)
```

调用 RPC：

```text
ensure_question_insight(questionId)
```

返回：

```text
documentId
```

### 8.4 获取正文

操作：

```text
getDocument(documentId)
```

直接 Supabase 查询：

```text
documents where id = documentId
```

返回：

```text
DocumentDetail
  id
  documentType
  questionId
  articleId
  contentJson
  contentHtml
  plainText
  wordCount
  contentVersion
  updatedAt
```

### 8.5 保存正文

操作：

```text
saveDocument(documentId, content)
```

content 包含：

```text
contentJson
contentHtml
plainText
wordCount
contentVersion
```

直接 Supabase update：

```text
update documents
set content_json, content_html, plain_text, word_count, content_version = content_version + 1
where id = documentId
```

前端策略：

```text
debounce 自动保存
保存时标记 saving
成功标记 saved
失败标记 error
```

保存成功后刷新：

```text
document
article_overview
question_stats
derived_questions
```

### 8.6 正文并发策略

第一版不做多人实时协同。

但可以用 `content_version` 做简单保护：

```text
保存时带上本地 content_version
如果数据库版本不同，提示内容可能已在其他设备修改
```

第一版可先简化为最后写入覆盖。

后续再做：

```text
版本冲突提示
历史版本
实时协同
```

## 9. 衍生问题数据访问

### 9.1 获取正文衍生问题列表

操作：

```text
listDerivedQuestions(documentId, { search })
```

查询：

```text
derived_question_links
join questions
join question_stats
where source_document_id = documentId
```

搜索：

```text
questions.title ilike %search%
```

返回：

```text
DerivedQuestionItem
  linkId
  questionId
  title
  answerCount
  nonEmptyBodyCount
  hasQuestionInsight
  questionInsightIsEmpty
  selectedText
  note
  sortOrder
```

### 9.2 新建或关联衍生问题

操作：

```text
addDerivedQuestion(documentId, title, selectedText?, note?)
```

调用 RPC：

```text
add_derived_question(documentId, title, selectedText, note)
```

原因：

```text
需要查找或创建全局问题
需要创建 derived_question_links
需要防止当前正文重复关联
```

成功后：

```text
刷新当前正文衍生问题列表
刷新问题库
刷新问题统计
```

### 9.3 删除当前正文里的衍生问题

操作：

```text
removeDerivedQuestionLink(linkId)
```

直接 Supabase delete：

```text
delete from derived_question_links where id = linkId
```

注意：

```text
只删除关联
不删除 questions 本体
```

### 9.4 更新衍生问题备注

操作：

```text
updateDerivedQuestionNote(linkId, note)
```

直接 Supabase update。

## 10. 跳转数据访问

### 10.1 解析跳转到问题见解

操作：

```text
resolveJumpToInsight(questionId)
```

调用 RPC：

```text
resolve_question_jump(questionId, 'insight')
```

返回：

```text
status = ok
documentId
```

如果见解文不存在，RPC 会创建空文档。

### 10.2 解析跳转到首选回答

操作：

```text
resolveJumpToPreferredArticle(questionId)
```

调用 RPC：

```text
resolve_question_jump(questionId, 'preferred_article')
```

返回：

```text
ok：返回 articleId 和 documentId
no_non_empty_body：已有标题但无非空正文
no_answer_article：没有回答文章
```

前端处理：

```text
ok -> 进入目标正文
no_non_empty_body -> 显示无法跳转提示
no_answer_article -> 显示无法跳转提示
```

### 10.3 跳转状态不是后端数据

以下内容只放前端状态：

```text
顶部路径
originDocumentId
originScrollPosition
derivedJumpDepth
```

数据库不保存临时跳转路径。

## 11. 流程图数据访问

### 11.1 获取流程图列表

操作：

```text
listFlowcharts(documentId)
```

直接 Supabase 查询：

```text
flowcharts where document_id = documentId
order by sort_order asc, updated_at desc
```

### 11.2 创建流程图

操作：

```text
createFlowchart(documentId, title)
```

直接 Supabase insert：

```text
insert into flowcharts(user_id, document_id, title, nodes, edges, viewport)
```

默认：

```text
nodes = []
edges = []
viewport = {}
```

### 11.3 保存流程图

操作：

```text
saveFlowchart(flowchartId, { title, nodes, edges, viewport })
```

直接 Supabase update。

策略：

```text
debounce 自动保存
保存状态显示在流程图面板
```

### 11.4 删除流程图

操作：

```text
deleteFlowchart(flowchartId)
```

直接 Supabase delete。

需要前端确认。

## 12. 资源文件数据访问

### 12.1 上传图片

操作：

```text
uploadDocumentImage(documentId, file)
```

步骤：

```text
1. 获取当前 user_id
2. 生成 assetId
3. 生成 storagePath = {userId}/{documentId}/{assetId}-{safeFileName}
4. supabase.storage.from(bucket).upload(storagePath, file)
5. insert assets 记录
6. 返回图片引用
```

返回：

```text
Asset
  id
  bucket
  storagePath
  mimeType
  sizeBytes
```

### 12.2 获取图片 URL

操作：

```text
getAssetUrl(asset)
```

第一版推荐：

```text
createSignedUrl(storagePath, expiresIn)
```

缓存策略：

```text
签名 URL 可以在前端短期缓存
过期后重新生成
```

### 12.3 删除资源文件记录

单独删除某个正文图片时：

```text
1. 删除 Storage 文件
2. 删除 assets 记录
3. 从正文 content 中移除图片节点
```

这个操作如果由用户明确删除单张图片，可以前端直接做。

问题/文章级联删除时，统一走 Netlify Function。

## 13. Netlify Functions API

### 13.1 通用认证

前端调用 Function 时需要带当前 Supabase access token。

请求头：

```text
Authorization: Bearer {access_token}
Content-Type: application/json
```

Function 里：

```text
1. 读取 Authorization
2. 用 Supabase auth.getUser(token) 验证用户
3. 得到 user.id
4. 使用 service role client 执行受控操作
5. 所有删除查询都必须限定 user_id
```

### 13.2 delete-question

路径：

```text
POST /.netlify/functions/delete-question
```

请求：

```json
{
  "questionId": "uuid"
}
```

流程：

```text
1. 验证用户
2. 查询 question 是否属于该用户
3. 查询该问题相关 documents
4. 查询这些 documents 相关 assets
5. 删除 questions 记录
6. 数据库 cascade 删除关联数据
7. 删除 Storage 文件
8. 返回结果
```

返回：

```json
{
  "ok": true,
  "deletedAssetCount": 5,
  "warnings": []
}
```

错误：

```text
401：未登录
403：无权限
404：问题不存在
500：删除失败
```

### 13.3 delete-article

路径：

```text
POST /.netlify/functions/delete-article
```

请求：

```json
{
  "articleId": "uuid"
}
```

流程：

```text
1. 验证用户
2. 查询 article 是否属于该用户
3. 查询该文章相关 documents
4. 查询这些 documents 相关 assets
5. 删除 answer_articles 记录
6. 数据库 cascade 删除关联数据
7. 删除 Storage 文件
8. 返回结果
```

### 13.4 cleanup-orphan-assets

后续功能。

用途：

```text
清理数据库里不存在但 Storage 中残留的文件
```

第一版可以暂不实现。

### 13.5 export-user-data

后续功能。

用途：

```text
导出当前用户所有数据
```

第一版可以暂不实现，但保留设计。

## 14. 页面动作到数据调用映射

### 14.1 问题库首页

```text
打开页面 -> listQuestions
搜索输入 -> listQuestions(search)
新建问题输入 -> searchSimilarQuestions
确认新建 -> createQuestion
编辑标题 -> updateQuestionTitle
删除问题 -> deleteQuestion Function
点击问题 -> listArticles(questionId)
```

### 14.2 回答标题页

```text
打开页面 -> listArticles(questionId)
搜索标题 -> listArticles(questionId, search)
新建标题输入 -> searchSimilarArticles
确认新建 -> createArticle + ensureArticleBody
编辑标题 -> updateArticleTitle
编辑来源 -> updateArticleSourceUrl
设置首选 -> setPreferredAnswer RPC
打开问题见解 -> ensureQuestionInsight
打开文章正文 -> ensureArticleBody
打开文章见解 -> ensureArticleInsight
删除文章 -> deleteArticle Function
```

### 14.3 文章原文正文页

```text
打开正文 -> getDocument
编辑正文 -> saveDocument debounce
粘贴图片 -> uploadDocumentImage
打开衍生问题栏 -> listDerivedQuestions
新建衍生问题输入 -> searchSimilarQuestions
确认衍生问题 -> addDerivedQuestion RPC
删除衍生问题 -> removeDerivedQuestionLink
点击衍生问题见解 -> resolveJumpToInsight RPC
点击衍生问题首选文 -> resolveJumpToPreferredArticle RPC
打开文章见解 -> ensureArticleInsight
打开流程图 -> listFlowcharts
```

### 14.4 问题见解文页

```text
打开见解文 -> ensureQuestionInsight + getDocument
编辑见解 -> saveDocument debounce
打开衍生问题栏 -> listDerivedQuestions
新增衍生问题 -> addDerivedQuestion RPC
跳转首选文章 -> resolveJumpToPreferredArticle RPC
打开流程图 -> listFlowcharts
```

### 14.5 文章见解文页

```text
打开见解文 -> ensureArticleInsight + getDocument
编辑见解 -> saveDocument debounce
打开流程图 -> listFlowcharts
返回文章原文 -> ensureArticleBody
```

### 14.6 流程图面板

```text
打开面板 -> listFlowcharts(documentId)
新建流程图 -> createFlowchart
编辑流程图 -> saveFlowchart debounce
删除流程图 -> deleteFlowchart
```

## 15. 错误处理设计

### 15.1 数据库约束错误

常见错误：

```text
questions_user_title_key_unique
answer_articles_question_title_key_unique
answer_articles_one_preferred_per_question_idx
derived_question_links_unique
```

前端转换为：

```text
已存在同名问题
该问题下已有同名回答标题
该正文已有关联的衍生问题
```

### 15.2 权限错误

Supabase RLS 拒绝时：

```text
显示：没有权限访问该内容，或内容不存在
```

不要暴露具体数据库细节。

### 15.3 网络错误

显示：

```text
网络异常，请稍后重试
```

保存失败时保留本地编辑内容。

### 15.4 Function 错误

统一返回：

```json
{
  "ok": false,
  "code": "ERROR_CODE",
  "message": "用户可读错误信息"
}
```

前端只显示 `message`。

## 16. 数据类型设计

领域类型建议：

```text
QuestionListItem
ArticleListItem
DocumentDetail
DerivedQuestionItem
FlowchartItem
AssetItem
JumpResult
SaveStatus
```

### 16.1 JumpResult

```ts
type JumpResult =
  | {
      status: "ok";
      questionId: string;
      articleId: string | null;
      documentId: string;
      reason: null;
    }
  | {
      status: "no_non_empty_body" | "no_answer_article";
      questionId: string;
      articleId: null;
      documentId: null;
      reason: string;
    };
```

### 16.2 SaveStatus

```ts
type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
```

## 17. 实现优先级

建议按这个顺序实现数据访问层：

```text
1. Supabase client
2. Auth functions
3. questions data functions
4. articles data functions
5. documents ensure/get/save functions
6. derived questions list/add/remove functions
7. jump resolve functions
8. flowcharts functions
9. assets upload functions
10. delete-question Function
11. delete-article Function
```

## 18. 最小验收清单

数据访问层完成后，需要验证：

```text
未登录不能读取业务数据
登录后能创建问题
同名问题创建失败并显示友好提示
问题列表能显示回答数和正文数
能创建回答标题
同问题下同名标题创建失败
能创建并打开文章正文
正文保存后 article_overview 状态更新
能创建问题见解文
能创建文章见解文
文章见解文不允许添加衍生问题
文章正文能添加衍生问题
新增衍生问题能复用已有全局问题
衍生问题能显示回答数和正文数
跳转首选回答能返回正确 document
没有回答时返回无法跳转原因
删除衍生问题只删除关联
删除文章会清理数据库关联
删除问题会清理数据库关联
图片能上传到用户自己的 Storage 路径
```

## 19. 当前设计总结

第一版数据访问层可以概括为：

```text
普通 CRUD 直接走 Supabase
复杂原子操作走 RPC
带服务端密钥和 Storage 批量清理的操作走 Netlify Functions
React Query 负责缓存和刷新
Zustand 负责导航和临时 UI 状态
组件不直接写数据库查询
```

这套边界能让后续代码更稳：

```text
页面清楚
请求清楚
权限清楚
错误清楚
后续重构也更容易
```
