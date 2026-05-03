# Supabase 数据库 SQL 设计 v0.1

本文档记录 `note-remeber` Web 端第一版的 Supabase 数据库 SQL 设计。

本文档的目标是把后端设计落到接近可执行的 SQL 层，包括：

```text
扩展
辅助函数
表结构
约束
索引
触发器
统计视图
RLS 权限策略
RPC 函数
Storage bucket 与权限策略
```

注意：本文档仍然是设计文档。正式执行前，应先在 Supabase 新项目中确认环境，然后拆分为迁移脚本执行。

## 1. SQL 设计原则

第一版数据库设计遵循：

```text
所有业务数据都带 user_id
所有业务表开启 RLS
用户只能访问自己的数据
完全重名由数据库唯一约束兜底
模糊相似由前端搜索提示处理
复杂原子操作使用 RPC
Storage 文件与数据库记录分开保存
删除数据库记录不会自动删除 Storage 文件
```

核心数据模型：

```text
profiles
questions
answer_articles
documents
derived_question_links
flowcharts
assets
```

## 2. 扩展

建议启用：

```sql
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
```

用途：

```text
pgcrypto：生成 uuid
pg_trgm：后续支持更好的模糊搜索索引
```

## 3. 辅助函数

### 3.1 标题标准化函数

用于生成 `title_key`，防止完全重名。

规则：

```text
去掉首尾空格
移除所有空白字符
英文转小写
```

SQL：

```sql
create or replace function public.normalize_title(input text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(input, '')), '[[:space:]]+', '', 'g'));
$$;
```

示例：

```text
" 发动机 的 原理是什么 " -> "发动机的原理是什么"
```

### 3.2 更新时间触发器函数

SQL：

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

### 3.3 新用户 profile 初始化函数

用户注册后自动创建 profile。

SQL：

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email))
  on conflict (id) do nothing;

  return new;
end;
$$;
```

## 4. 表结构

### 4.1 profiles

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

触发器：

```sql
drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();
```

Auth 触发器：

```sql
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
```

### 4.2 questions

```sql
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  title_key text generated always as (public.normalize_title(title)) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint questions_title_not_blank check (length(public.normalize_title(title)) > 0),
  constraint questions_user_title_key_unique unique (user_id, title_key)
);
```

索引：

```sql
create index if not exists questions_user_updated_idx
on public.questions (user_id, updated_at desc);

create index if not exists questions_title_trgm_idx
on public.questions using gin (title gin_trgm_ops);
```

触发器：

```sql
drop trigger if exists questions_set_updated_at on public.questions;

create trigger questions_set_updated_at
before update on public.questions
for each row
execute function public.set_updated_at();
```

### 4.3 answer_articles

```sql
create table if not exists public.answer_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  title text not null,
  title_key text generated always as (public.normalize_title(title)) stored,
  source_url text,
  sort_order integer not null default 0,
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint answer_articles_title_not_blank check (length(public.normalize_title(title)) > 0),
  constraint answer_articles_question_title_key_unique unique (question_id, title_key)
);
```

索引：

```sql
create index if not exists answer_articles_user_question_idx
on public.answer_articles (user_id, question_id, sort_order, updated_at desc);

create index if not exists answer_articles_title_trgm_idx
on public.answer_articles using gin (title gin_trgm_ops);

create unique index if not exists answer_articles_one_preferred_per_question_idx
on public.answer_articles (question_id)
where is_preferred = true;
```

触发器：

```sql
drop trigger if exists answer_articles_set_updated_at on public.answer_articles;

create trigger answer_articles_set_updated_at
before update on public.answer_articles
for each row
execute function public.set_updated_at();
```

### 4.4 documents

所有正文统一存到 `documents`。

正文类型：

```text
article_body
article_insight
question_insight
```

SQL：

```sql
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  question_id uuid references public.questions(id) on delete cascade,
  article_id uuid references public.answer_articles(id) on delete cascade,
  content_json jsonb not null default '{}'::jsonb,
  content_html text not null default '',
  plain_text text not null default '',
  word_count integer not null default 0,
  content_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint documents_type_check check (
    document_type in ('article_body', 'article_insight', 'question_insight')
  ),
  constraint documents_owner_target_check check (
    (
      document_type = 'question_insight'
      and question_id is not null
      and article_id is null
    )
    or
    (
      document_type in ('article_body', 'article_insight')
      and article_id is not null
      and question_id is null
    )
  ),
  constraint documents_word_count_not_negative check (word_count >= 0),
  constraint documents_content_version_positive check (content_version >= 1)
);
```

唯一性索引：

```sql
create unique index if not exists documents_one_question_insight_idx
on public.documents (question_id)
where document_type = 'question_insight';

create unique index if not exists documents_one_article_body_idx
on public.documents (article_id)
where document_type = 'article_body';

create unique index if not exists documents_one_article_insight_idx
on public.documents (article_id)
where document_type = 'article_insight';
```

查询索引：

```sql
create index if not exists documents_user_updated_idx
on public.documents (user_id, updated_at desc);

create index if not exists documents_question_idx
on public.documents (question_id)
where question_id is not null;

create index if not exists documents_article_idx
on public.documents (article_id)
where article_id is not null;

create index if not exists documents_plain_text_trgm_idx
on public.documents using gin (plain_text gin_trgm_ops);
```

触发器：

```sql
drop trigger if exists documents_set_updated_at on public.documents;

create trigger documents_set_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();
```

### 4.5 derived_question_links

```sql
create table if not exists public.derived_question_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_document_id uuid not null references public.documents(id) on delete cascade,
  derived_question_id uuid not null references public.questions(id) on delete cascade,
  selected_text text,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint derived_question_links_unique unique (source_document_id, derived_question_id)
);
```

索引：

```sql
create index if not exists derived_question_links_source_idx
on public.derived_question_links (user_id, source_document_id, sort_order, created_at);

create index if not exists derived_question_links_target_idx
on public.derived_question_links (user_id, derived_question_id);
```

触发器：

```sql
drop trigger if exists derived_question_links_set_updated_at on public.derived_question_links;

create trigger derived_question_links_set_updated_at
before update on public.derived_question_links
for each row
execute function public.set_updated_at();
```

### 4.6 flowcharts

```sql
create table if not exists public.flowcharts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  title text not null default '未命名流程图',
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  viewport jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint flowcharts_title_not_blank check (length(public.normalize_title(title)) > 0)
);
```

索引：

```sql
create index if not exists flowcharts_document_idx
on public.flowcharts (user_id, document_id, sort_order, updated_at desc);
```

触发器：

```sql
drop trigger if exists flowcharts_set_updated_at on public.flowcharts;

create trigger flowcharts_set_updated_at
before update on public.flowcharts
for each row
execute function public.set_updated_at();
```

### 4.7 assets

```sql
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  asset_type text not null,
  bucket text not null default 'note-assets',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null default 0,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint assets_type_check check (asset_type in ('image', 'attachment')),
  constraint assets_size_not_negative check (size_bytes >= 0),
  constraint assets_storage_path_not_blank check (length(btrim(storage_path)) > 0),
  constraint assets_unique_storage_path unique (bucket, storage_path)
);
```

索引：

```sql
create index if not exists assets_document_idx
on public.assets (user_id, document_id, created_at);

create index if not exists assets_storage_path_idx
on public.assets (bucket, storage_path);
```

触发器：

```sql
drop trigger if exists assets_set_updated_at on public.assets;

create trigger assets_set_updated_at
before update on public.assets
for each row
execute function public.set_updated_at();
```

## 5. user_id 一致性校验触发器

RLS 可以控制当前用户，但还需要避免用户把自己的记录关联到别人的父级记录。

### 5.1 校验回答文章所属问题

```sql
create or replace function public.validate_answer_article_user()
returns trigger
language plpgsql
as $$
declare
  parent_user_id uuid;
begin
  select user_id into parent_user_id
  from public.questions
  where id = new.question_id;

  if parent_user_id is null or parent_user_id <> new.user_id then
    raise exception 'question_id does not belong to this user';
  end if;

  return new;
end;
$$;

drop trigger if exists answer_articles_validate_user on public.answer_articles;

create trigger answer_articles_validate_user
before insert or update on public.answer_articles
for each row
execute function public.validate_answer_article_user();
```

### 5.2 校验正文所属对象

```sql
create or replace function public.validate_document_user()
returns trigger
language plpgsql
as $$
declare
  parent_user_id uuid;
begin
  if new.question_id is not null then
    select user_id into parent_user_id
    from public.questions
    where id = new.question_id;
  end if;

  if new.article_id is not null then
    select user_id into parent_user_id
    from public.answer_articles
    where id = new.article_id;
  end if;

  if parent_user_id is null or parent_user_id <> new.user_id then
    raise exception 'document parent does not belong to this user';
  end if;

  return new;
end;
$$;

drop trigger if exists documents_validate_user on public.documents;

create trigger documents_validate_user
before insert or update on public.documents
for each row
execute function public.validate_document_user();
```

### 5.3 校验衍生问题关系

```sql
create or replace function public.validate_derived_question_link_user()
returns trigger
language plpgsql
as $$
declare
  source_user_id uuid;
  source_type text;
  target_user_id uuid;
begin
  select user_id, document_type
  into source_user_id, source_type
  from public.documents
  where id = new.source_document_id;

  select user_id
  into target_user_id
  from public.questions
  where id = new.derived_question_id;

  if source_user_id is null or target_user_id is null then
    raise exception 'source document or derived question does not exist';
  end if;

  if source_user_id <> new.user_id or target_user_id <> new.user_id then
    raise exception 'derived question link does not belong to this user';
  end if;

  if source_type not in ('article_body', 'question_insight') then
    raise exception 'this document type cannot have derived questions';
  end if;

  return new;
end;
$$;

drop trigger if exists derived_question_links_validate_user on public.derived_question_links;

create trigger derived_question_links_validate_user
before insert or update on public.derived_question_links
for each row
execute function public.validate_derived_question_link_user();
```

### 5.4 校验流程图所属正文

```sql
create or replace function public.validate_flowchart_user()
returns trigger
language plpgsql
as $$
declare
  parent_user_id uuid;
begin
  select user_id into parent_user_id
  from public.documents
  where id = new.document_id;

  if parent_user_id is null or parent_user_id <> new.user_id then
    raise exception 'flowchart document does not belong to this user';
  end if;

  return new;
end;
$$;

drop trigger if exists flowcharts_validate_user on public.flowcharts;

create trigger flowcharts_validate_user
before insert or update on public.flowcharts
for each row
execute function public.validate_flowchart_user();
```

### 5.5 校验资源文件所属正文和路径

```sql
create or replace function public.validate_asset_user()
returns trigger
language plpgsql
as $$
declare
  parent_user_id uuid;
begin
  if new.document_id is not null then
    select user_id into parent_user_id
    from public.documents
    where id = new.document_id;

    if parent_user_id is null or parent_user_id <> new.user_id then
      raise exception 'asset document does not belong to this user';
    end if;
  end if;

  if new.storage_path not like new.user_id::text || '/%' then
    raise exception 'asset storage_path must start with user_id';
  end if;

  return new;
end;
$$;

drop trigger if exists assets_validate_user on public.assets;

create trigger assets_validate_user
before insert or update on public.assets
for each row
execute function public.validate_asset_user();
```

## 6. 统计视图

### 6.1 question_stats

用于问题库首页和衍生问题栏。

```sql
create or replace view public.question_stats
with (security_invoker = true)
as
select
  q.id as question_id,
  q.user_id,
  count(distinct a.id) as answer_count,
  count(distinct body.id) filter (
    where length(btrim(coalesce(body.plain_text, ''))) > 0
  ) as non_empty_body_count,
  insight.id is not null as has_question_insight,
  coalesce(length(btrim(insight.plain_text)), 0) = 0 as question_insight_is_empty,
  greatest(
    q.updated_at,
    coalesce(max(a.updated_at), q.updated_at),
    coalesce(max(body.updated_at), q.updated_at),
    coalesce(insight.updated_at, q.updated_at)
  ) as updated_at
from public.questions q
left join public.answer_articles a
  on a.question_id = q.id
left join public.documents body
  on body.article_id = a.id
  and body.document_type = 'article_body'
left join public.documents insight
  on insight.question_id = q.id
  and insight.document_type = 'question_insight'
group by q.id, q.user_id, q.updated_at, insight.id, insight.plain_text, insight.updated_at;
```

### 6.2 article_overview

用于回答标题页。

```sql
create or replace view public.article_overview
with (security_invoker = true)
as
select
  a.id as article_id,
  a.user_id,
  a.question_id,
  a.title,
  a.source_url,
  a.sort_order,
  a.is_preferred,
  body.id as body_document_id,
  coalesce(length(btrim(body.plain_text)), 0) = 0 as body_is_empty,
  insight.id as insight_document_id,
  insight.id is not null as has_article_insight,
  coalesce(length(btrim(insight.plain_text)), 0) = 0 as article_insight_is_empty,
  count(distinct f.id) as flowchart_count,
  count(distinct dql.id) as derived_question_count,
  greatest(
    a.updated_at,
    coalesce(body.updated_at, a.updated_at),
    coalesce(insight.updated_at, a.updated_at),
    coalesce(max(f.updated_at), a.updated_at),
    coalesce(max(dql.updated_at), a.updated_at)
  ) as updated_at
from public.answer_articles a
left join public.documents body
  on body.article_id = a.id
  and body.document_type = 'article_body'
left join public.documents insight
  on insight.article_id = a.id
  and insight.document_type = 'article_insight'
left join public.documents article_docs
  on article_docs.article_id = a.id
left join public.flowcharts f
  on f.document_id = article_docs.id
left join public.derived_question_links dql
  on dql.source_document_id = body.id
group by
  a.id,
  a.user_id,
  a.question_id,
  a.title,
  a.source_url,
  a.sort_order,
  a.is_preferred,
  a.updated_at,
  body.id,
  body.plain_text,
  body.updated_at,
  insight.id,
  insight.plain_text,
  insight.updated_at;
```

### 6.3 document_overview

用于正文页状态展示。

```sql
create or replace view public.document_overview
with (security_invoker = true)
as
select
  d.id as document_id,
  d.user_id,
  d.document_type,
  d.question_id,
  d.article_id,
  d.word_count,
  coalesce(length(btrim(d.plain_text)), 0) = 0 as is_empty,
  count(distinct f.id) as flowchart_count,
  count(distinct dql.id) as derived_question_count,
  greatest(
    d.updated_at,
    coalesce(max(f.updated_at), d.updated_at),
    coalesce(max(dql.updated_at), d.updated_at)
  ) as updated_at
from public.documents d
left join public.flowcharts f
  on f.document_id = d.id
left join public.derived_question_links dql
  on dql.source_document_id = d.id
group by d.id, d.user_id, d.document_type, d.question_id, d.article_id, d.word_count, d.plain_text, d.updated_at;
```

## 7. RLS 权限策略

### 7.1 开启 RLS

```sql
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.answer_articles enable row level security;
alter table public.documents enable row level security;
alter table public.derived_question_links enable row level security;
alter table public.flowcharts enable row level security;
alter table public.assets enable row level security;
```

### 7.2 profiles 策略

```sql
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());
```

### 7.3 通用业务表策略

以下表均使用 `user_id = auth.uid()`：

```text
questions
answer_articles
documents
derived_question_links
flowcharts
assets
```

SQL：

```sql
create policy "questions_select_own"
on public.questions
for select
to authenticated
using (user_id = auth.uid());

create policy "questions_insert_own"
on public.questions
for insert
to authenticated
with check (user_id = auth.uid());

create policy "questions_update_own"
on public.questions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "questions_delete_own"
on public.questions
for delete
to authenticated
using (user_id = auth.uid());
```

```sql
create policy "answer_articles_select_own"
on public.answer_articles
for select
to authenticated
using (user_id = auth.uid());

create policy "answer_articles_insert_own"
on public.answer_articles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "answer_articles_update_own"
on public.answer_articles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "answer_articles_delete_own"
on public.answer_articles
for delete
to authenticated
using (user_id = auth.uid());
```

```sql
create policy "documents_select_own"
on public.documents
for select
to authenticated
using (user_id = auth.uid());

create policy "documents_insert_own"
on public.documents
for insert
to authenticated
with check (user_id = auth.uid());

create policy "documents_update_own"
on public.documents
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "documents_delete_own"
on public.documents
for delete
to authenticated
using (user_id = auth.uid());
```

```sql
create policy "derived_question_links_select_own"
on public.derived_question_links
for select
to authenticated
using (user_id = auth.uid());

create policy "derived_question_links_insert_own"
on public.derived_question_links
for insert
to authenticated
with check (user_id = auth.uid());

create policy "derived_question_links_update_own"
on public.derived_question_links
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "derived_question_links_delete_own"
on public.derived_question_links
for delete
to authenticated
using (user_id = auth.uid());
```

```sql
create policy "flowcharts_select_own"
on public.flowcharts
for select
to authenticated
using (user_id = auth.uid());

create policy "flowcharts_insert_own"
on public.flowcharts
for insert
to authenticated
with check (user_id = auth.uid());

create policy "flowcharts_update_own"
on public.flowcharts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "flowcharts_delete_own"
on public.flowcharts
for delete
to authenticated
using (user_id = auth.uid());
```

```sql
create policy "assets_select_own"
on public.assets
for select
to authenticated
using (user_id = auth.uid());

create policy "assets_insert_own"
on public.assets
for insert
to authenticated
with check (user_id = auth.uid());

create policy "assets_update_own"
on public.assets
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "assets_delete_own"
on public.assets
for delete
to authenticated
using (user_id = auth.uid());
```

## 8. RPC 函数

### 8.1 设置首选回答

```sql
create or replace function public.set_preferred_answer(
  p_question_id uuid,
  p_article_id uuid
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid;
  v_exists boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select exists (
    select 1
    from public.answer_articles
    where id = p_article_id
      and question_id = p_question_id
      and user_id = v_user_id
  ) into v_exists;

  if not v_exists then
    raise exception 'article does not belong to this question or user';
  end if;

  update public.answer_articles
  set is_preferred = false
  where question_id = p_question_id
    and user_id = v_user_id;

  update public.answer_articles
  set is_preferred = true
  where id = p_article_id
    and user_id = v_user_id;
end;
$$;
```

### 8.2 确保问题见解文存在

```sql
create or replace function public.ensure_question_insight(
  p_question_id uuid
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_user_id uuid;
  v_document_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.questions
    where id = p_question_id
      and user_id = v_user_id
  ) then
    raise exception 'question does not belong to this user';
  end if;

  select id into v_document_id
  from public.documents
  where question_id = p_question_id
    and document_type = 'question_insight'
    and user_id = v_user_id;

  if v_document_id is null then
    insert into public.documents (
      user_id,
      document_type,
      question_id,
      content_json,
      content_html,
      plain_text,
      word_count
    )
    values (
      v_user_id,
      'question_insight',
      p_question_id,
      '{}'::jsonb,
      '',
      '',
      0
    )
    returning id into v_document_id;
  end if;

  return v_document_id;
end;
$$;
```

### 8.3 确保文章正文或文章见解文存在

```sql
create or replace function public.ensure_article_document(
  p_article_id uuid,
  p_document_type text
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_user_id uuid;
  v_document_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_document_type not in ('article_body', 'article_insight') then
    raise exception 'invalid article document type';
  end if;

  if not exists (
    select 1
    from public.answer_articles
    where id = p_article_id
      and user_id = v_user_id
  ) then
    raise exception 'article does not belong to this user';
  end if;

  select id into v_document_id
  from public.documents
  where article_id = p_article_id
    and document_type = p_document_type
    and user_id = v_user_id;

  if v_document_id is null then
    insert into public.documents (
      user_id,
      document_type,
      article_id,
      content_json,
      content_html,
      plain_text,
      word_count
    )
    values (
      v_user_id,
      p_document_type,
      p_article_id,
      '{}'::jsonb,
      '',
      '',
      0
    )
    returning id into v_document_id;
  end if;

  return v_document_id;
end;
$$;
```

### 8.4 添加衍生问题

```sql
create or replace function public.add_derived_question(
  p_source_document_id uuid,
  p_title text,
  p_selected_text text default null,
  p_note text default null
)
returns table (
  question_id uuid,
  link_id uuid
)
language plpgsql
security invoker
as $$
declare
  v_user_id uuid;
  v_source_type text;
  v_question_id uuid;
  v_link_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if length(public.normalize_title(p_title)) = 0 then
    raise exception 'question title cannot be blank';
  end if;

  select document_type into v_source_type
  from public.documents
  where id = p_source_document_id
    and user_id = v_user_id;

  if v_source_type is null then
    raise exception 'source document does not belong to this user';
  end if;

  if v_source_type not in ('article_body', 'question_insight') then
    raise exception 'this document type cannot have derived questions';
  end if;

  insert into public.questions (user_id, title)
  values (v_user_id, p_title)
  on conflict (user_id, title_key)
  do update set updated_at = public.questions.updated_at
  returning id into v_question_id;

  insert into public.derived_question_links (
    user_id,
    source_document_id,
    derived_question_id,
    selected_text,
    note
  )
  values (
    v_user_id,
    p_source_document_id,
    v_question_id,
    p_selected_text,
    p_note
  )
  on conflict (source_document_id, derived_question_id)
  do update set updated_at = now()
  returning id into v_link_id;

  question_id := v_question_id;
  link_id := v_link_id;
  return next;
end;
$$;
```

### 8.5 解析衍生问题跳转目标

```sql
create or replace function public.resolve_question_jump(
  p_target_question_id uuid,
  p_jump_target text
)
returns table (
  status text,
  question_id uuid,
  article_id uuid,
  document_id uuid,
  reason text
)
language plpgsql
security invoker
as $$
declare
  v_user_id uuid;
  v_article_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.questions
    where id = p_target_question_id
      and user_id = v_user_id
  ) then
    raise exception 'target question does not belong to this user';
  end if;

  if p_jump_target = 'insight' then
    status := 'ok';
    question_id := p_target_question_id;
    article_id := null;
    document_id := public.ensure_question_insight(p_target_question_id);
    reason := null;
    return next;
    return;
  end if;

  if p_jump_target <> 'preferred_article' then
    raise exception 'invalid jump target';
  end if;

  select a.id, d.id
  into article_id, document_id
  from public.answer_articles a
  join public.documents d
    on d.article_id = a.id
    and d.document_type = 'article_body'
  where a.question_id = p_target_question_id
    and a.user_id = v_user_id
    and a.is_preferred = true
    and length(btrim(coalesce(d.plain_text, ''))) > 0
  limit 1;

  if document_id is not null then
    status := 'ok';
    question_id := p_target_question_id;
    reason := null;
    return next;
    return;
  end if;

  select a.id, d.id
  into article_id, document_id
  from public.answer_articles a
  join public.documents d
    on d.article_id = a.id
    and d.document_type = 'article_body'
  where a.question_id = p_target_question_id
    and a.user_id = v_user_id
    and length(btrim(coalesce(d.plain_text, ''))) > 0
  order by a.sort_order asc, a.created_at asc
  limit 1;

  if document_id is not null then
    status := 'ok';
    question_id := p_target_question_id;
    reason := null;
    return next;
    return;
  end if;

  select count(*) into v_article_count
  from public.answer_articles
  where question_id = p_target_question_id
    and user_id = v_user_id;

  question_id := p_target_question_id;
  article_id := null;
  document_id := null;

  if v_article_count > 0 then
    status := 'no_non_empty_body';
    reason := '该问题已有回答标题，但还没有非空正文。';
  else
    status := 'no_answer_article';
    reason := '该问题还没有回答文章。';
  end if;

  return next;
end;
$$;
```

## 9. Storage bucket 与权限

### 9.1 创建 bucket

```sql
insert into storage.buckets (id, name, public)
values ('note-assets', 'note-assets', false)
on conflict (id)
do update set public = false;
```

### 9.2 Storage 路径规则

所有对象路径必须以当前用户 id 开头：

```text
{user_id}/{document_id}/{asset_id}-{safe_file_name}
```

示例：

```text
9f1.../d32.../a88...-image.png
```

### 9.3 Storage RLS 策略

```sql
create policy "note_assets_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "note_assets_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "note_assets_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "note_assets_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

## 10. 权限授予

Supabase 通常会默认处理基础权限，但迁移脚本中可以显式授予：

```sql
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.answer_articles to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.derived_question_links to authenticated;
grant select, insert, update, delete on public.flowcharts to authenticated;
grant select, insert, update, delete on public.assets to authenticated;

grant select on public.question_stats to authenticated;
grant select on public.article_overview to authenticated;
grant select on public.document_overview to authenticated;

grant execute on function public.set_preferred_answer(uuid, uuid) to authenticated;
grant execute on function public.ensure_question_insight(uuid) to authenticated;
grant execute on function public.ensure_article_document(uuid, text) to authenticated;
grant execute on function public.add_derived_question(uuid, text, text, text) to authenticated;
grant execute on function public.resolve_question_jump(uuid, text) to authenticated;
```

## 11. 删除行为总结

数据库级联删除：

```text
删除 question
-> 删除该问题的问题见解文
-> 删除该问题下 answer_articles
-> 删除这些文章的 documents
-> 删除这些 documents 的 derived_question_links
-> 删除这些 documents 的 flowcharts
-> 删除这些 documents 的 assets 记录
```

删除 answer_article：

```text
-> 删除文章原文正文
-> 删除文章见解文
-> 删除相关 derived_question_links
-> 删除相关 flowcharts
-> 删除相关 assets 记录
```

删除正文里的衍生问题：

```text
只删除 derived_question_links
不删除 questions 本体
```

重要提醒：

```text
数据库 cascade 不会删除 Supabase Storage 文件。
Storage 文件清理需要 Netlify Function 或后续清理任务处理。
```

## 12. 执行顺序建议

正式落库时建议按这个顺序：

```text
1. extensions
2. helper functions
3. tables
4. indexes
5. updated_at triggers
6. user consistency triggers
7. auth user trigger
8. views
9. enable RLS
10. RLS policies
11. RPC functions
12. Storage bucket
13. Storage policies
14. grants
```

## 13. 最小验证用例

执行 SQL 后，需要验证：

```text
用户注册后自动生成 profile
用户 A 创建问题后，用户 B 看不到
同一用户不能创建完全重名问题
同一问题下不能创建完全重名标题
同一问题只能有一个首选回答
article_insight 不能作为衍生问题来源
article_body 可以作为衍生问题来源
question_insight 可以作为衍生问题来源
删除文章会删除对应正文和流程图记录
删除正文衍生问题只删除关联
resolve_question_jump 能正确返回无法跳转原因
Storage 只能访问自己 user_id 路径下文件
```

## 14. 当前 SQL 设计总结

这套 SQL 设计已经覆盖第一版 Web 产品需要的核心后端能力：

```text
登录用户数据隔离
问题库
回答标题
富文本正文
问题见解文
文章见解文
衍生问题关系
流程图
图片资源记录
模糊搜索索引
防完全重名
首选回答唯一性
跳转目标解析
Storage 私有文件权限
级联删除
```

下一步可以基于本文档继续生成：

```text
Supabase 迁移 SQL 文件
前端数据访问层设计
Netlify Functions 删除清理设计
```
