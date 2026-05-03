create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create or replace function public.normalize_title(input text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(input, '')), '[[:space:]]+', '', 'g'));
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create index if not exists questions_user_updated_idx
on public.questions (user_id, updated_at desc);

create index if not exists questions_title_trgm_idx
on public.questions using gin (title gin_trgm_ops);

create index if not exists answer_articles_user_question_idx
on public.answer_articles (user_id, question_id, sort_order, updated_at desc);

create index if not exists answer_articles_title_trgm_idx
on public.answer_articles using gin (title gin_trgm_ops);

create unique index if not exists answer_articles_one_preferred_per_question_idx
on public.answer_articles (question_id)
where is_preferred = true;

create unique index if not exists documents_one_question_insight_idx
on public.documents (question_id)
where document_type = 'question_insight';

create unique index if not exists documents_one_article_body_idx
on public.documents (article_id)
where document_type = 'article_body';

create unique index if not exists documents_one_article_insight_idx
on public.documents (article_id)
where document_type = 'article_insight';

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

create index if not exists derived_question_links_source_idx
on public.derived_question_links (user_id, source_document_id, sort_order, created_at);

create index if not exists derived_question_links_target_idx
on public.derived_question_links (user_id, derived_question_id);

create index if not exists flowcharts_document_idx
on public.flowcharts (user_id, document_id, sort_order, updated_at desc);

create index if not exists assets_document_idx
on public.assets (user_id, document_id, created_at);

create index if not exists assets_storage_path_idx
on public.assets (bucket, storage_path);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

drop trigger if exists answer_articles_set_updated_at on public.answer_articles;
create trigger answer_articles_set_updated_at
before update on public.answer_articles
for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists derived_question_links_set_updated_at on public.derived_question_links;
create trigger derived_question_links_set_updated_at
before update on public.derived_question_links
for each row execute function public.set_updated_at();

drop trigger if exists flowcharts_set_updated_at on public.flowcharts;
create trigger flowcharts_set_updated_at
before update on public.flowcharts
for each row execute function public.set_updated_at();

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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
for each row execute function public.validate_answer_article_user();

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
for each row execute function public.validate_document_user();

create or replace function public.validate_derived_question_link_user()
returns trigger
language plpgsql
as $$
declare
  source_user_id uuid;
  source_type text;
  target_user_id uuid;
begin
  select user_id, document_type into source_user_id, source_type
  from public.documents
  where id = new.source_document_id;

  select user_id into target_user_id
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
for each row execute function public.validate_derived_question_link_user();

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
for each row execute function public.validate_flowchart_user();

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
for each row execute function public.validate_asset_user();

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
left join public.answer_articles a on a.question_id = q.id
left join public.documents body
  on body.article_id = a.id
  and body.document_type = 'article_body'
left join public.documents insight
  on insight.question_id = q.id
  and insight.document_type = 'question_insight'
group by q.id, q.user_id, q.updated_at, insight.id, insight.plain_text, insight.updated_at;

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
left join public.documents article_docs on article_docs.article_id = a.id
left join public.flowcharts f on f.document_id = article_docs.id
left join public.derived_question_links dql on dql.source_document_id = body.id
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
left join public.flowcharts f on f.document_id = d.id
left join public.derived_question_links dql on dql.source_document_id = d.id
group by d.id, d.user_id, d.document_type, d.question_id, d.article_id, d.word_count, d.plain_text, d.updated_at;

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.answer_articles enable row level security;
alter table public.documents enable row level security;
alter table public.derived_question_links enable row level security;
alter table public.flowcharts enable row level security;
alter table public.assets enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select to authenticated
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "questions_select_own" on public.questions;
create policy "questions_select_own"
on public.questions for select to authenticated
using (user_id = auth.uid());

drop policy if exists "questions_insert_own" on public.questions;
create policy "questions_insert_own"
on public.questions for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "questions_update_own" on public.questions;
create policy "questions_update_own"
on public.questions for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "questions_delete_own" on public.questions;
create policy "questions_delete_own"
on public.questions for delete to authenticated
using (user_id = auth.uid());

drop policy if exists "answer_articles_select_own" on public.answer_articles;
create policy "answer_articles_select_own"
on public.answer_articles for select to authenticated
using (user_id = auth.uid());

drop policy if exists "answer_articles_insert_own" on public.answer_articles;
create policy "answer_articles_insert_own"
on public.answer_articles for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "answer_articles_update_own" on public.answer_articles;
create policy "answer_articles_update_own"
on public.answer_articles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "answer_articles_delete_own" on public.answer_articles;
create policy "answer_articles_delete_own"
on public.answer_articles for delete to authenticated
using (user_id = auth.uid());

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own"
on public.documents for select to authenticated
using (user_id = auth.uid());

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own"
on public.documents for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own"
on public.documents for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own"
on public.documents for delete to authenticated
using (user_id = auth.uid());

drop policy if exists "derived_question_links_select_own" on public.derived_question_links;
create policy "derived_question_links_select_own"
on public.derived_question_links for select to authenticated
using (user_id = auth.uid());

drop policy if exists "derived_question_links_insert_own" on public.derived_question_links;
create policy "derived_question_links_insert_own"
on public.derived_question_links for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "derived_question_links_update_own" on public.derived_question_links;
create policy "derived_question_links_update_own"
on public.derived_question_links for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "derived_question_links_delete_own" on public.derived_question_links;
create policy "derived_question_links_delete_own"
on public.derived_question_links for delete to authenticated
using (user_id = auth.uid());

drop policy if exists "flowcharts_select_own" on public.flowcharts;
create policy "flowcharts_select_own"
on public.flowcharts for select to authenticated
using (user_id = auth.uid());

drop policy if exists "flowcharts_insert_own" on public.flowcharts;
create policy "flowcharts_insert_own"
on public.flowcharts for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "flowcharts_update_own" on public.flowcharts;
create policy "flowcharts_update_own"
on public.flowcharts for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "flowcharts_delete_own" on public.flowcharts;
create policy "flowcharts_delete_own"
on public.flowcharts for delete to authenticated
using (user_id = auth.uid());

drop policy if exists "assets_select_own" on public.assets;
create policy "assets_select_own"
on public.assets for select to authenticated
using (user_id = auth.uid());

drop policy if exists "assets_insert_own" on public.assets;
create policy "assets_insert_own"
on public.assets for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "assets_update_own" on public.assets;
create policy "assets_update_own"
on public.assets for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "assets_delete_own" on public.assets;
create policy "assets_delete_own"
on public.assets for delete to authenticated
using (user_id = auth.uid());

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

create or replace function public.ensure_question_insight(p_question_id uuid)
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
    select 1 from public.questions
    where id = p_question_id and user_id = v_user_id
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
    values (v_user_id, 'question_insight', p_question_id, '{}'::jsonb, '', '', 0)
    returning id into v_document_id;
  end if;

  return v_document_id;
end;
$$;

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
    select 1 from public.answer_articles
    where id = p_article_id and user_id = v_user_id
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
    values (v_user_id, p_document_type, p_article_id, '{}'::jsonb, '', '', 0)
    returning id into v_document_id;
  end if;

  return v_document_id;
end;
$$;

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
  where id = p_source_document_id and user_id = v_user_id;

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
  values (v_user_id, p_source_document_id, v_question_id, p_selected_text, p_note)
  on conflict (source_document_id, derived_question_id)
  do update set updated_at = now()
  returning id into v_link_id;

  question_id := v_question_id;
  link_id := v_link_id;
  return next;
end;
$$;

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
    select 1 from public.questions
    where id = p_target_question_id and user_id = v_user_id
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

  select a.id, d.id into article_id, document_id
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

  select a.id, d.id into article_id, document_id
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
  where question_id = p_target_question_id and user_id = v_user_id;

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

insert into storage.buckets (id, name, public)
values ('note-assets', 'note-assets', false)
on conflict (id) do update set public = false;

drop policy if exists "note_assets_select_own" on storage.objects;
create policy "note_assets_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "note_assets_insert_own" on storage.objects;
create policy "note_assets_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "note_assets_update_own" on storage.objects;
create policy "note_assets_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "note_assets_delete_own" on storage.objects;
create policy "note_assets_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

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
