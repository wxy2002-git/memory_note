import { requireSupabaseBrowserClient } from "@/lib/supabase/client";
import type { QuestionListItem } from "@/types/domain";

type QuestionRow = {
  id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type QuestionStatsRow = {
  question_id: string;
  answer_count: number | string | null;
  non_empty_body_count: number | string | null;
  has_question_insight: boolean | null;
  question_insight_is_empty: boolean | null;
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

export async function listQuestions(search: string): Promise<QuestionListItem[]> {
  const supabase = requireSupabaseBrowserClient();
  let query = supabase
    .from("questions")
    .select("id,title,sort_order,created_at,updated_at")
    .order("updated_at", { ascending: false });

  const trimmed = search.trim();

  if (trimmed) {
    query = query.ilike("title", `%${trimmed}%`);
  }

  const { data: questionRows, error } = await query;

  if (error) {
    throw error;
  }

  const questions = (questionRows ?? []) as QuestionRow[];

  if (questions.length === 0) {
    return [];
  }

  const ids = questions.map((question) => question.id);
  const { data: statsRows, error: statsError } = await supabase
    .from("question_stats")
    .select("question_id,answer_count,non_empty_body_count,has_question_insight,question_insight_is_empty")
    .in("question_id", ids);

  if (statsError) {
    throw statsError;
  }

  const statsByQuestion = new Map(
    ((statsRows ?? []) as QuestionStatsRow[]).map((row) => [row.question_id, row])
  );

  return questions.map((question) => {
    const stats = statsByQuestion.get(question.id);

    return {
      id: question.id,
      title: question.title,
      answerCount: toCount(stats?.answer_count),
      nonEmptyBodyCount: toCount(stats?.non_empty_body_count),
      hasQuestionInsight: Boolean(stats?.has_question_insight),
      questionInsightIsEmpty: stats?.question_insight_is_empty ?? true,
      updatedAt: question.updated_at
    };
  });
}

export async function searchSimilarQuestions(input: string): Promise<QuestionListItem[]> {
  const trimmed = input.trim();

  if (!trimmed) {
    return [];
  }

  return listQuestions(trimmed);
}

export async function createQuestion(title: string): Promise<string> {
  const supabase = requireSupabaseBrowserClient();
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error("问题标题不能为空。");
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
    .from("questions")
    .insert({
      user_id: user.id,
      title: normalizedTitle
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return (data as { id: string }).id;
}

export async function updateQuestionTitle(questionId: string, title: string) {
  const supabase = requireSupabaseBrowserClient();
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error("问题标题不能为空。");
  }

  const { error } = await supabase
    .from("questions")
    .update({ title: normalizedTitle })
    .eq("id", questionId);

  if (error) {
    throw error;
  }
}
