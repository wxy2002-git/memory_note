import { requireSupabaseBrowserClient } from "@/lib/supabase/client";

type DeleteApiResult = {
  deleted?: boolean;
  error?: string;
};

async function getAccessToken() {
  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const token = data.session?.access_token;

  if (!token) {
    throw new Error("请先登录。");
  }

  return token;
}

async function callDeleteFunction(path: string, body: Record<string, string>) {
  const token = await getAccessToken();
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  let result: DeleteApiResult = {};

  try {
    result = (await response.json()) as DeleteApiResult;
  } catch {
    result = {};
  }

  if (!response.ok) {
    throw new Error(result.error || "删除失败，请稍后重试。");
  }

  if (!result.deleted) {
    throw new Error("删除请求未完成，请稍后重试。");
  }
}

export async function deleteQuestion(questionId: string) {
  await callDeleteFunction("/api/delete-question", { questionId });
}

export async function deleteArticle(articleId: string) {
  await callDeleteFunction("/api/delete-article", { articleId });
}
