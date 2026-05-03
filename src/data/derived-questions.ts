import { getArticleContext } from "@/data/articles";
import { requireSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DerivedQuestionItem, JumpResult } from "@/types/domain";

type LinkRow = {
  id: string;
  derived_question_id: string;
  selected_text: string | null;
  note: string | null;
  sort_order: number;
};

type QuestionRow = {
  id: string;
  title: string;
};

type QuestionStatsRow = {
  question_id: string;
  answer_count: number | string | null;
  non_empty_body_count: number | string | null;
  has_question_insight: boolean | null;
  question_insight_is_empty: boolean | null;
};

type JumpRow = {
  status: "ok" | "no_non_empty_body" | "no_answer_article";
  question_id: string;
  article_id: string | null;
  document_id: string | null;
  reason: string | null;
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

export async function listDerivedQuestions(documentId: string, search: string): Promise<DerivedQuestionItem[]> {
  const supabase = requireSupabaseBrowserClient();
  const { data: linkRows, error } = await supabase
    .from("derived_question_links")
    .select("id,derived_question_id,selected_text,note,sort_order")
    .eq("source_document_id", documentId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const links = (linkRows ?? []) as unknown as LinkRow[];

  if (links.length === 0) {
    return [];
  }

  const questionIds = links.map((link) => link.derived_question_id);
  const [{ data: questionRows, error: questionError }, { data: statsRows, error: statsError }] =
    await Promise.all([
      supabase.from("questions").select("id,title").in("id", questionIds),
      supabase
        .from("question_stats")
        .select("question_id,answer_count,non_empty_body_count,has_question_insight,question_insight_is_empty")
        .in("question_id", questionIds)
    ]);

  if (questionError) {
    throw questionError;
  }

  if (statsError) {
    throw statsError;
  }

  const questionsById = new Map(((questionRows ?? []) as unknown as QuestionRow[]).map((row) => [row.id, row]));
  const statsById = new Map(((statsRows ?? []) as unknown as QuestionStatsRow[]).map((row) => [row.question_id, row]));
  const trimmedSearch = search.trim();

  return links
    .map((link) => {
      const question = questionsById.get(link.derived_question_id);
      const stats = statsById.get(link.derived_question_id);

      if (!question) {
        return null;
      }

      return {
        linkId: link.id,
        questionId: question.id,
        title: question.title,
        answerCount: toCount(stats?.answer_count),
        nonEmptyBodyCount: toCount(stats?.non_empty_body_count),
        hasQuestionInsight: Boolean(stats?.has_question_insight),
        questionInsightIsEmpty: stats?.question_insight_is_empty ?? true,
        selectedText: link.selected_text,
        note: link.note,
        sortOrder: link.sort_order
      };
    })
    .filter((item): item is DerivedQuestionItem => Boolean(item))
    .filter((item) => (trimmedSearch ? item.title.includes(trimmedSearch) : true));
}

export async function addDerivedQuestion(documentId: string, title: string) {
  const supabase = requireSupabaseBrowserClient();
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error("衍生问题不能为空。");
  }

  const { data, error } = await supabase.rpc("add_derived_question", {
    p_source_document_id: documentId,
    p_title: normalizedTitle,
    p_selected_text: null,
    p_note: null
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function removeDerivedQuestionLink(linkId: string) {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.from("derived_question_links").delete().eq("id", linkId);

  if (error) {
    throw error;
  }
}

export async function resolveQuestionJump(questionId: string, jumpTarget: "insight" | "preferred_article"): Promise<JumpResult> {
  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("resolve_question_jump", {
    p_target_question_id: questionId,
    p_jump_target: jumpTarget
  });

  if (error) {
    throw error;
  }

  const row = ((data ?? []) as unknown as JumpRow[])[0];

  if (!row) {
    throw new Error("无法解析跳转目标。");
  }

  if (row.status === "ok" && row.document_id) {
    return {
      status: "ok",
      questionId: row.question_id,
      articleId: row.article_id,
      documentId: row.document_id,
      reason: null
    };
  }

  return {
    status: row.status === "no_non_empty_body" ? "no_non_empty_body" : "no_answer_article",
    questionId: row.question_id,
    articleId: null,
    documentId: null,
    reason: row.reason ?? "该问题还没有可跳转的内容。"
  };
}

export async function getPreferredArticleContext(articleId: string) {
  return getArticleContext(articleId);
}
