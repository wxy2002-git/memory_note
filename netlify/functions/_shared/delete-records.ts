import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
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

type OwnedRow = {
  id: string;
  user_id: string;
};

type JsonBody = {
  questionId?: unknown;
  articleId?: unknown;
};

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export async function readIdFromRequest(req: Request, fieldName: "questionId" | "articleId") {
  let body: JsonBody;

  try {
    body = (await req.json()) as JsonBody;
  } catch {
    throw new HttpError(400, "请求体不是有效 JSON。");
  }

  const value = body[fieldName];

  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `缺少 ${fieldName}。`);
  }

  return value.trim();
}

export function getAdminClient() {
  const supabaseUrl = Netlify.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new HttpError(500, "服务端缺少 Supabase URL 或 service role key。");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function requireAuthenticatedUser(admin: SupabaseClient, req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    throw new HttpError(401, "请先登录。");
  }

  const { data, error } = await admin.auth.getUser(match[1]);

  if (error || !data.user) {
    throw new HttpError(401, "登录状态已失效，请重新登录。");
  }

  return data.user;
}

async function selectOwnedRow(admin: SupabaseClient, table: "questions" | "answer_articles", id: string) {
  const { data, error } = await admin.from(table).select("id,user_id").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data as OwnedRow | null;
}

async function selectDocumentIdsForQuestion(admin: SupabaseClient, questionId: string) {
  const { data: articleRows, error: articlesError } = await admin
    .from("answer_articles")
    .select("id")
    .eq("question_id", questionId);

  if (articlesError) {
    throw articlesError;
  }

  const articleIds = ((articleRows ?? []) as ArticleIdRow[]).map((row) => row.id);
  const documentIds = new Set<string>();

  const { data: questionDocumentRows, error: questionDocumentsError } = await admin
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
    const { data: articleDocumentRows, error: articleDocumentsError } = await admin
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

async function selectDocumentIdsForArticle(admin: SupabaseClient, articleId: string) {
  const { data, error } = await admin.from("documents").select("id").eq("article_id", articleId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as DocumentIdRow[]).map((row) => row.id);
}

async function selectAssetsForDocuments(admin: SupabaseClient, documentIds: string[]) {
  if (documentIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from("assets")
    .select("bucket,storage_path")
    .in("document_id", documentIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as AssetRow[];
}

async function removeStorageAssets(admin: SupabaseClient, assets: AssetRow[]) {
  const pathsByBucket = new Map<string, string[]>();

  for (const asset of assets) {
    if (!asset.bucket || !asset.storage_path) {
      continue;
    }

    pathsByBucket.set(asset.bucket, [...(pathsByBucket.get(asset.bucket) ?? []), asset.storage_path]);
  }

  for (const [bucket, paths] of pathsByBucket) {
    const { error } = await admin.storage.from(bucket).remove(paths);

    if (error) {
      throw error;
    }
  }
}

export async function deleteQuestionCascade(admin: SupabaseClient, questionId: string, userId: string) {
  const question = await selectOwnedRow(admin, "questions", questionId);

  if (!question || question.user_id !== userId) {
    throw new HttpError(404, "没有找到这个问题。");
  }

  const documentIds = await selectDocumentIdsForQuestion(admin, questionId);
  const assets = await selectAssetsForDocuments(admin, documentIds);

  await removeStorageAssets(admin, assets);

  const { error } = await admin.from("questions").delete().eq("id", questionId).eq("user_id", userId);

  if (error) {
    throw error;
  }

  return {
    deleted: true,
    assetCount: assets.length
  };
}

export async function deleteArticleCascade(admin: SupabaseClient, articleId: string, userId: string) {
  const article = await selectOwnedRow(admin, "answer_articles", articleId);

  if (!article || article.user_id !== userId) {
    throw new HttpError(404, "没有找到这篇回答。");
  }

  const documentIds = await selectDocumentIdsForArticle(admin, articleId);
  const assets = await selectAssetsForDocuments(admin, documentIds);

  await removeStorageAssets(admin, assets);

  const { error } = await admin.from("answer_articles").delete().eq("id", articleId).eq("user_id", userId);

  if (error) {
    throw error;
  }

  return {
    deleted: true,
    assetCount: assets.length
  };
}
