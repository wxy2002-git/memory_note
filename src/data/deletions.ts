import { requireSupabaseBrowserClient } from "@/lib/supabase/client";

type DeleteApiResult = {
  deleted?: boolean;
  error?: string;
};

type AssetRow = {
  bucket: string;
  storage_path: string;
};

type DocumentIdRow = {
  id: string;
};

type ArticleIdRow = {
  id: string;
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

  if (response.status === 404) {
    return false;
  }

  let result: DeleteApiResult = {};

  try {
    result = (await response.json()) as DeleteApiResult;
  } catch {
    result = {};
  }

  if (!response.ok) {
    throw new Error(result.error || "删除失败，请稍后重试。");
  }

  return true;
}

async function getCurrentUserId() {
  const supabase = requireSupabaseBrowserClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("请先登录。");
  }

  return user.id;
}

async function selectDocumentIdsForQuestion(questionId: string) {
  const supabase = requireSupabaseBrowserClient();
  const { data: articleRows, error: articlesError } = await supabase
    .from("answer_articles")
    .select("id")
    .eq("question_id", questionId);

  if (articlesError) {
    throw articlesError;
  }

  const articleIds = ((articleRows ?? []) as ArticleIdRow[]).map((row) => row.id);
  const documentIds = new Set<string>();

  const { data: questionDocumentRows, error: questionDocumentsError } = await supabase
    .from("documents")
    .select("id")
    .eq("question_id", questionId);

  if (questionDocumentsError) {
    throw questionDocumentsError;
  }

  for (const row of (questionDocumentRows ?? []) as DocumentIdRow[]) {
    documentIds.add(row.id);
  }

  if (articleIds.length > 0) {
    const { data: articleDocumentRows, error: articleDocumentsError } = await supabase
      .from("documents")
      .select("id")
      .in("article_id", articleIds);

    if (articleDocumentsError) {
      throw articleDocumentsError;
    }

    for (const row of (articleDocumentRows ?? []) as DocumentIdRow[]) {
      documentIds.add(row.id);
    }
  }

  return [...documentIds];
}

async function selectDocumentIdsForArticle(articleId: string) {
  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase.from("documents").select("id").eq("article_id", articleId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as DocumentIdRow[]).map((row) => row.id);
}

async function removeStorageAssets(documentIds: string[]) {
  if (documentIds.length === 0) {
    return;
  }

  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("assets")
    .select("bucket,storage_path")
    .in("document_id", documentIds);

  if (error) {
    throw error;
  }

  const pathsByBucket = new Map<string, string[]>();

  for (const asset of (data ?? []) as AssetRow[]) {
    if (!asset.bucket || !asset.storage_path) {
      continue;
    }

    pathsByBucket.set(asset.bucket, [...(pathsByBucket.get(asset.bucket) ?? []), asset.storage_path]);
  }

  for (const [bucket, paths] of pathsByBucket) {
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths);

    if (removeError) {
      throw removeError;
    }
  }
}

async function deleteQuestionInBrowser(questionId: string) {
  const supabase = requireSupabaseBrowserClient();
  const userId = await getCurrentUserId();
  const documentIds = await selectDocumentIdsForQuestion(questionId);

  await removeStorageAssets(documentIds);

  const { error } = await supabase.from("questions").delete().eq("id", questionId).eq("user_id", userId);

  if (error) {
    throw error;
  }
}

async function deleteArticleInBrowser(articleId: string) {
  const supabase = requireSupabaseBrowserClient();
  const userId = await getCurrentUserId();
  const documentIds = await selectDocumentIdsForArticle(articleId);

  await removeStorageAssets(documentIds);

  const { error } = await supabase.from("answer_articles").delete().eq("id", articleId).eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function deleteQuestion(questionId: string) {
  const handledByFunction = await callDeleteFunction("/api/delete-question", { questionId });

  if (!handledByFunction) {
    await deleteQuestionInBrowser(questionId);
  }
}

export async function deleteArticle(articleId: string) {
  const handledByFunction = await callDeleteFunction("/api/delete-article", { articleId });

  if (!handledByFunction) {
    await deleteArticleInBrowser(articleId);
  }
}
