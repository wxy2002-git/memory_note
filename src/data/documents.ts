import { requireSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DocumentDetail, DocumentType } from "@/types/domain";

type DocumentRow = {
  id: string;
  document_type: DocumentType;
  question_id: string | null;
  article_id: string | null;
  content_json: Record<string, unknown> | null;
  content_html: string | null;
  plain_text: string | null;
  word_count: number | null;
  content_version: number | null;
  updated_at: string;
};

export type SaveDocumentInput = {
  documentId: string;
  contentJson: Record<string, unknown>;
  contentHtml: string;
  plainText: string;
  wordCount: number;
  nextContentVersion: number;
};

function mapDocument(row: DocumentRow): DocumentDetail {
  return {
    id: row.id,
    documentType: row.document_type,
    questionId: row.question_id,
    articleId: row.article_id,
    contentJson: row.content_json ?? {},
    contentHtml: row.content_html ?? "",
    plainText: row.plain_text ?? "",
    wordCount: row.word_count ?? 0,
    contentVersion: row.content_version ?? 1,
    updatedAt: row.updated_at
  };
}

export async function getDocument(documentId: string): Promise<DocumentDetail> {
  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      [
        "id",
        "document_type",
        "question_id",
        "article_id",
        "content_json",
        "content_html",
        "plain_text",
        "word_count",
        "content_version",
        "updated_at"
      ].join(",")
    )
    .eq("id", documentId)
    .single();

  if (error) {
    throw error;
  }

  return mapDocument(data as unknown as DocumentRow);
}

export async function saveDocument(input: SaveDocumentInput) {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase
    .from("documents")
    .update({
      content_json: input.contentJson,
      content_html: input.contentHtml,
      plain_text: input.plainText,
      word_count: input.wordCount,
      content_version: input.nextContentVersion
    })
    .eq("id", input.documentId);

  if (error) {
    throw error;
  }
}
