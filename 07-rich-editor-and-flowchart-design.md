# 富文本编辑器与流程图设计 v0.1

本文档记录 `note-remeber` Web 端第一版的富文本编辑器和流程图编辑器设计。

本文档基于：

```text
01-web-product-spec.md
04-web-frontend-design.md
05-supabase-database-sql-design.md
06-web-data-api-design.md
```

这两个模块是产品体验的核心：

```text
富文本编辑器：保存文章原文、问题见解、文章见解
流程图编辑器：辅助用户一边阅读一边梳理结构和关系
```

## 1. 总体目标

富文本编辑器目标：

```text
接近 Word 的正文编辑体验
尽量保留复制文章的原格式
支持图片、链接、表格、字体、字号、颜色、高亮
支持用户继续写自己的内容
支持自动保存
支持从选中文本快速创建衍生问题
```

流程图编辑器目标：

```text
可以在正文旁边打开
可以边看正文边画结构
支持节点、连线、文字编辑
支持拉伸、全屏、自动保存
每个正文都有独立流程图
```

## 2. 富文本编辑器适用范围

三类正文都使用同一个富文本编辑器组件：

```text
文章原文正文 article_body
文章见解文 article_insight
问题见解文 question_insight
```

差异由页面功能控制：

```text
article_body：显示衍生问题栏、文章见解入口、流程图入口
article_insight：只显示流程图入口，不显示衍生问题栏
question_insight：显示衍生问题栏、跳转首选文章、流程图入口
```

富文本编辑器本身不关心正文类型，只接收：

```text
documentId
initialContentJson
initialContentHtml
onSave
onCreateDerivedQuestion
readMode
```

## 3. 富文本技术方案

第一版采用：

```text
Tiptap
ProseMirror
React
DOMPurify
Supabase Storage
```

已安装 Tiptap 相关能力：

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

可能需要自定义扩展：

```text
FontSize：字号
ImageWithAsset：带 asset_id 的图片节点
Callout：后续可选，用于提示块
```

## 4. 富文本内容保存格式

数据库 `documents` 表保存三份内容：

```text
content_json：Tiptap / ProseMirror 原始文档结构
content_html：HTML 展示内容
plain_text：纯文本内容
```

保存原因：

```text
content_json：再次编辑时最可靠
content_html：展示、导出、搜索预览更方便
plain_text：搜索、统计、判断正文是否为空
```

保存时同时计算：

```text
word_count
content_version
updated_at
```

正文为空判断：

```text
plain_text 去掉空白后长度为 0
```

## 5. 编辑器工具栏设计

### 5.1 固定工具栏

固定工具栏放在正文标题区下方，正文编辑区上方。

建议包含：

```text
撤销
重做
标题级别
字体
字号
加粗
斜体
下划线
删除线
文字颜色
背景高亮
左对齐
居中
右对齐
有序列表
无序列表
引用
链接
图片
表格
分割线
清除格式
```

交互要求：

```text
按钮使用图标
所有图标按钮都有 tooltip
当前格式状态要高亮
字号和字体使用下拉菜单
颜色和高亮使用色板
危险或不可逆操作需要确认
```

### 5.2 浮动工具栏

用户选中文字时，出现浮动工具栏。

包含：

```text
加粗
斜体
下划线
高亮
链接
新建衍生问题
```

“新建衍生问题”规则：

```text
只在允许衍生问题的正文类型中显示
article_body 显示
question_insight 显示
article_insight 不显示
衍生跳转模式不显示
```

点击后：

```text
读取选中文本
预填问题：什么是“选中文本”？
打开衍生问题新建输入框
输入框下方显示相似问题
```

## 6. 粘贴设计

粘贴是核心体验。

默认模式：

```text
保留原格式
```

需要尽量保留：

```text
标题层级
段落
加粗
斜体
下划线
删除线
字号
字体
文字颜色
背景高亮
列表
引用
链接
图片
表格
基础排版结构
```

### 6.1 网页粘贴

用户从网页复制文章时，浏览器剪贴板通常包含：

```text
text/html
text/plain
图片文件或图片外链
```

处理策略：

```text
优先读取 text/html
清理危险 HTML
保留常见语义标签和样式
交给 Tiptap 解析
```

需要移除：

```text
script
style 中危险内容
iframe
onclick 等事件属性
隐藏元素
广告类无关结构
```

### 6.2 Word 粘贴

Word 粘贴通常包含大量 `mso-*` 样式。

第一版策略：

```text
保留主要结构
保留基础文字样式
保留列表和表格
清理过多无用样式
```

接受限制：

```text
无法 100% 还原 Word 复杂排版
目标是阅读结构可用，而不是像素级一致
```

### 6.3 纯文本粘贴

后续可提供：

```text
Ctrl + Shift + V：纯文本粘贴
工具栏菜单：粘贴为纯文本
```

第一版可以先支持浏览器默认纯文本粘贴。

## 7. HTML 清理策略

展示或粘贴 HTML 时需要清理。

使用：

```text
DOMPurify
```

允许标签方向：

```text
p
h1-h6
strong
em
u
s
span
blockquote
ul
ol
li
a
img
table
thead
tbody
tr
th
td
hr
br
pre
code
```

允许属性方向：

```text
href
src
alt
title
target
rel
style 的安全子集
data-asset-id
data-storage-path
colspan
rowspan
```

链接规则：

```text
外链默认 target="_blank"
外链必须 rel="noopener noreferrer"
拒绝 javascript: URL
```

图片规则：

```text
允许 https 图片
允许 Supabase Storage 图片
不长期保存 base64 图片
```

## 8. 图片处理设计

正文图片来源：

```text
本地上传
拖拽图片
粘贴截图
粘贴网页图片
```

### 8.1 本地上传和粘贴图片

处理流程：

```text
1. 用户插入或粘贴图片
2. 前端生成 assetId
3. 上传到 Supabase Storage
4. 创建 assets 记录
5. 将图片节点插入正文
6. 图片节点带 assetId 和 storagePath
7. 保存正文
```

图片节点建议属性：

```text
src
alt
title
dataAssetId
dataStoragePath
width
height
```

### 8.2 base64 图片

粘贴截图时可能出现 base64。

规则：

```text
临时允许编辑器接收
立即上传到 Storage
上传成功后替换为 Storage 引用
保存正文前尽量不保留 base64
```

如果上传失败：

```text
显示图片上传失败
允许重试
不自动丢失用户编辑内容
```

### 8.3 网页外链图片

第一版可以先保留外链图片。

后续增强：

```text
一键转存外链图片到 Storage
粘贴时自动转存
检测失效图片
```

### 8.4 图片显示和编辑

支持：

```text
查看图片
调整图片宽度
删除图片
编辑 alt 文本
```

后续可选：

```text
图片说明文字
图片居中/左/右对齐
```

## 9. 表格设计

第一版表格需要支持：

```text
插入表格
新增行
新增列
删除行
删除列
删除表格
单元格编辑
表头
```

粘贴网页或 Word 表格时：

```text
尽量保留行列结构
保留基础加粗和对齐
不追求复杂边框完全一致
```

表格在窄屏下：

```text
允许横向滚动
不能撑破页面布局
```

## 10. 字体和字号设计

字体：

```text
默认使用系统字体
支持选择常见字体
```

建议字体选项：

```text
系统默认
宋体
黑体
微软雅黑
Arial
Times New Roman
Georgia
Courier New
```

字号：

```text
12
14
16
18
20
24
28
32
```

实现说明：

```text
FontFamily 可用 Tiptap 扩展
FontSize 需要自定义 TextStyle mark 属性
```

## 11. 自动保存设计

正文自动保存策略：

```text
用户输入 -> 标记 dirty
停止输入 800ms - 1500ms -> 保存
保存中 -> 标记 saving
保存成功 -> 标记 saved
保存失败 -> 标记 error
```

页面切换前：

```text
如果 dirty，先尝试保存
保存失败，提示是否仍要离开
```

浏览器关闭前：

```text
如果 dirty，尝试触发同步保存或提示用户
```

保存失败时：

```text
保留本地编辑器内容
显示重试按钮
不覆盖数据库旧内容
```

第一版不做多人实时协同。

## 12. 正文版本策略

数据库有：

```text
content_version
```

第一版：

```text
每次保存 content_version + 1
最后写入者覆盖
```

后续增强：

```text
多设备冲突检测
历史版本
恢复旧版本
自动快照
```

## 13. 编辑器空状态

文章原文正文：

```text
粘贴文章内容，或开始输入
```

文章见解文：

```text
写下你对这篇文章的总结、结构和评价
```

问题见解文：

```text
写下你对这个问题的阶段性理解
```

空状态文字只作为 placeholder，不占用正文内容。

## 14. 流程图适用范围

所有可编辑正文都可以有流程图：

```text
文章原文正文
文章见解文
问题见解文
```

每个正文可以有多个流程图。

示例：

```text
A1 原文正文
- 文章论证结构图
- 概念关系图

A1+ 文章见解文
- 我的总结结构图

A+ 问题见解文
- 问题整体框架图
```

流程图绑定到：

```text
document_id
```

## 15. 流程图技术方案

采用：

```text
@xyflow/react
```

数据库保存：

```text
nodes jsonb
edges jsonb
viewport jsonb
title text
```

保存的数据与前端画布结构一致，避免复杂转换。

## 16. 流程图面板布局

点击正文侧边工具栏的流程图图标后，打开流程图面板。

默认形态：

```text
右侧中等宽度面板
覆盖在正文右侧
可拖拽调整宽度
可全屏
可关闭
```

面板包含：

```text
顶部栏：流程图标题、保存状态、全屏、关闭
左侧小栏：流程图列表、新建流程图
工具栏：添加节点、添加说明、适配画布、删除选中
画布区：节点和连线
```

默认宽度建议：

```text
480px - 640px
```

全屏模式：

```text
覆盖应用主体区域
顶部导航仍可见或以压缩形式保留
Esc 可以退出全屏
```

窄屏：

```text
流程图面板默认全屏
```

## 17. 流程图节点设计

第一版节点类型保持简单。

支持节点：

```text
普通节点
重点节点
问题节点
结论节点
```

节点字段：

```text
id
type
position
data.label
data.note
data.color
data.size
```

节点颜色：

```text
普通：白色
重点：浅黄色
问题：浅蓝色
结论：浅绿色
```

节点操作：

```text
双击编辑文字
拖拽移动
选中后删除
修改颜色
修改类型
复制节点
```

第一版可先实现：

```text
新增普通节点
编辑节点文字
拖拽节点
删除节点
```

## 18. 流程图连线设计

连线字段：

```text
id
source
target
type
label
animated
data
```

连线类型：

```text
普通关系
因果关系
递进关系
对比关系
```

第一版可先实现：

```text
拖拽创建连线
删除连线
编辑连线文字
```

连线样式：

```text
默认有箭头
选中时高亮
```

## 19. 流程图创建流程

用户点击流程图图标：

```text
如果当前正文没有流程图 -> 显示空状态和新建按钮
如果已有流程图 -> 打开最近编辑的流程图
```

点击新建：

```text
创建 flowcharts 记录
默认标题：未命名流程图
nodes = []
edges = []
viewport = {}
```

新建后：

```text
进入画布
提示可以添加节点
```

## 20. 流程图保存策略

流程图自动保存：

```text
节点移动
节点文字修改
新增连线
删除节点
删除连线
修改标题
画布缩放或移动
```

保存策略：

```text
debounce 500ms - 1000ms
保存 nodes、edges、viewport、title
显示保存状态
```

保存状态：

```text
dirty
saving
saved
error
```

保存失败：

```text
保留本地画布状态
显示重试按钮
```

## 21. 流程图删除设计

删除流程图前必须确认：

```text
确认删除这个流程图吗？
取消 / 确认
```

删除后：

```text
删除 flowcharts 记录
从流程图列表移除
如果还有其他流程图，打开下一张
如果没有，显示空状态
```

删除流程图不会影响正文内容。

删除正文时，数据库会级联删除该正文下的流程图。

## 22. 正文与流程图联动

第一版不做强绑定。

也就是说：

```text
流程图节点不直接绑定正文段落
正文滚动不会自动定位流程图节点
```

但可以提供轻联动：

```text
从选中文本创建流程图节点
```

交互：

```text
选中正文中的一段话
点击浮动工具栏：创建流程图节点
如果流程图面板未打开，先打开面板
把选中文本作为节点标题
```

这个功能可以放到第二阶段。

## 23. 衍生问题与流程图联动

后续可选：

```text
把衍生问题添加为流程图问题节点
流程图节点关联问题 id
点击流程图问题节点跳转到问题见解或首选回答
```

第一版先不做，避免复杂度过高。

## 24. 快捷键设计

富文本编辑器：

```text
Ctrl + B：加粗
Ctrl + I：斜体
Ctrl + U：下划线
Ctrl + K：插入链接
Ctrl + Z：撤销
Ctrl + Shift + Z：重做
Ctrl + S：立即保存
```

流程图：

```text
Delete：删除选中节点或连线
Ctrl + S：立即保存
Esc：退出全屏或取消选中
```

## 25. 性能设计

富文本：

```text
长文章编辑时避免每次输入都全量重渲染页面
保存使用 debounce
图片上传异步处理
大图上传前可考虑压缩
```

流程图：

```text
节点和连线较多时保持画布局部更新
拖拽过程中不频繁写数据库
拖拽结束后保存
```

第一版性能目标：

```text
几万字文章可编辑
几十到一两百个流程图节点可操作
```

## 26. 风险和限制

富文本粘贴风险：

```text
不同网站 HTML 差异很大
Word 样式非常复杂
100% 保持原格式不现实
```

第一版目标是：

```text
保留主要阅读结构和常见格式
不做像素级还原
```

图片风险：

```text
外链图片可能失效
base64 图片会让正文数据过大
```

处理：

```text
本地图片上传 Storage
base64 图片尽快转存
外链图片后续支持一键转存
```

流程图风险：

```text
节点太多时画布会变复杂
用户可能需要整理工具
```

后续增强：

```text
自动布局
节点分组
搜索节点
小地图
```

## 27. 实现优先级

建议先实现富文本，再实现流程图。

### 27.1 富文本优先级

```text
1. Tiptap 基础编辑器
2. 标题、段落、列表、引用
3. 加粗、斜体、下划线、删除线
4. 链接
5. 图片上传到 Storage
6. 表格
7. 文字颜色和高亮
8. 字体和字号
9. 自动保存
10. 浮动工具栏
11. 选中文本创建衍生问题
12. 粘贴 HTML 清理优化
```

### 27.2 流程图优先级

```text
1. 流程图面板打开和关闭
2. 流程图列表
3. 新建流程图
4. 普通节点创建和编辑
5. 节点拖拽
6. 连线创建
7. 删除节点和连线
8. 自动保存
9. 全屏
10. 节点类型和颜色
11. 连线标签
12. 从选中文本创建节点
```

## 28. 验收清单

富文本验收：

```text
可以输入和保存正文
刷新后正文内容还在
加粗、斜体、下划线可用
标题和列表可用
链接可插入和打开
图片可上传并显示
表格可插入和编辑
粘贴网页文章能保留基础格式
粘贴 Word 内容能保留主要结构
正文自动保存状态准确
保存失败不会丢失当前编辑内容
文章见解文不显示衍生问题按钮
文章原文正文可从选中文本创建衍生问题
```

流程图验收：

```text
每类正文都能打开流程图面板
可以新建流程图
可以编辑流程图标题
可以新增节点
可以编辑节点文字
可以拖拽节点
可以创建连线
可以删除节点和连线
可以全屏编辑
刷新后流程图数据还在
删除流程图需要确认
删除流程图不影响正文
不同正文的流程图互相独立
```

## 29. 当前设计总结

富文本和流程图模块的边界：

```text
富文本负责保存文章和用户理解
流程图负责辅助理解结构
图片资源放 Storage
正文结构放 documents.content_json
正文展示放 documents.content_html
正文搜索和统计放 documents.plain_text
流程图画布放 flowcharts.nodes / edges / viewport
```

第一版先做到：

```text
富文本稳定可写
复制文章基本保留格式
图片能上传
流程图能画、能保存、能全屏
```

后续再增强：

```text
外链图片转存
历史版本
流程图自动布局
正文段落与流程图节点联动
衍生问题与流程图节点联动
```
