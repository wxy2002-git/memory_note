import { requireSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ArticleListItem, QuestionDetail } from "@/types/domain";
import { listQuestions } from "@/data/questions";

type ArticleOverviewRow = {
  article_id: string;
  question_id: string;
  title: string;
  source_url: string | null;
  sort_order: number;
  is_preferred: boolean;
  body_document_id: string | null;
  body_is_empty: boolean | null;
  insight_document_id: string | null;
  has_article_insight: boolean | null;
  article_insight_is_empty: boolean | null;
  flowchart_count: number | string | null;
  derived_question_count: number | string | null;
  updated_at: string;
};

function toCount(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseInt(value, 10) || 0;
  }

  return 0;
}

export async function getQuestionDetail(questionId: string): Promise<QuestionDetail> {
  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id,title,updated_at")
    .eq("id", questionId)
    .single();

  if (error) {
    throw error;
  }

  const matches = await listQuestions((data as { title: string }).title);
  const matched = matches.find((question) => question.id === questionId);

  return {
    id: (data as { id: string }).id,
    title: (data as { title: string }).title,
    answerCount: matched?.answerCount ?? 0,
    nonEmptyBodyCount: matched?.nonEmptyBodyCount ?? 0,
    hasQuestionInsight: matched?.hasQuestionInsight ?? false,
    questionInsightIsEmpty: matched?.questionInsightIsEmpty ?? true,
    updatedAt: (data as { updated_at: string }).updated_at
  };
}

export async function getArticleContext(articleId: string): Promise<{
  id: string;
  title: string;
  questionId: string;
  questionTitle: string;
}> {
  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("answer_articles")
    .select("id,title,question_id")
    .eq("id", articleId)
    .single();

  if (error) {
    throw error;
  }

  const row = data as unknown as {
    id: string;
    title: string;
    question_id: string;
  };
  const question = await getQuestionDetail(row.question_id);

  return {
    id: row.id,
    title: row.title,
    questionId: row.question_id,
    questionTitle: question.title
  };
}

export async function listArticles(questionId: string, search: string): Promise<ArticleListItem[]> {
  const supabase = requireSupabaseBrowserClient();
  let query = supabase
    .from("article_overview")
    .select(
      [
        "article_id",
        "question_id",
        "title",
        "source_url",
        "sort_order",
        "is_preferred",
        "body_document_id",
        "body_is_empty",
        "insight_document_id",
        "has_article_insight",
        "article_insight_is_empty",
        "flowchart_count",
        "derived_question_count",
        "updated_at"
      ].join(",")
    )
    .eq("question_id", questionId)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  const trimmed = search.trim();

  if (trimmed) {
    query = query.ilike("title", `%${trimmed}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as ArticleOverviewRow[]).map((row) => ({
    id: row.article_id,
    questionId: row.question_id,
    title: row.title,
    sourceUrl: row.source_url,
    isPreferred: row.is_preferred,
    bodyDocumentId: row.body_document_id,
    bodyIsEmpty: row.body_is_empty ?? true,
    insightDocumentId: row.insight_document_id,
    hasArticleInsight: Boolean(row.has_article_insight),
    articleInsightIsEmpty: row.article_insight_is_empty ?? true,
    flowchartCount: toCount(row.flowchart_count),
    derivedQuestionCount: toCount(row.derived_question_count),
    updatedAt: row.updated_at
  }));
}

export async function searchSimilarArticles(questionId: string, input: string): Promise<ArticleListItem[]> {
  const trimmed = input.trim();

  if (!trimmed) {
    return [];
  }

  return listArticles(questionId, trimmed);
}

export async function ensureArticleDocument(articleId: string, documentType: "article_body" | "article_insight") {
  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("ensure_article_document", {
    p_article_id: articleId,
    p_document_type: documentType
  });

  if (error) {
    throw error;
  }

  return data as string;
}

export async function ensureQuestionInsight(questionId: string) {
  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("ensure_question_insight", {
    p_question_id: questionId
  });

  if (error) {
    throw error;
  }

  return data as string;
}

export async function createArticle(questionId: string, title: string): Promise<string> {
  const supabase = requireSupabaseBrowserClient();
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error("回答标题不能为空。");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("请先登录。");
  }

  const { data, error } = await supabase
    .from("answer_articles")
    .insert({
      user_id: user.id,
      question_id: questionId,
      title: normalizedTitle
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  const articleId = (data as { id: string }).id;
  await ensureArticleDocument(articleId, "article_body");

  return articleId;
}

export async function updateArticleTitle(articleId: string, title: string) {
  const supabase = requireSupabaseBrowserClient();
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error("回答标题不能为空。");
  }

  const { error } = await supabase
    .from("answer_articles")
    .update({ title: normalizedTitle })
    .eq("id", articleId);

  if (error) {
    throw error;
  }
}

export async function updateArticleSourceUrl(articleId: string, sourceUrl: string) {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase
    .from("answer_articles")
    .update({ source_url: sourceUrl.trim() || null })
    .eq("id", articleId);

  if (error) {
    throw error;
  }
}

export async function setPreferredAnswer(questionId: string, articleId: string) {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.rpc("set_preferred_answer", {
    p_question_id: questionId,
    p_article_id: articleId
  });

  if (error) {
    throw error;
  }
}
