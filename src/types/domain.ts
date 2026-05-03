export type AuthUser = {
  id: string;
  email: string | null;
};

export type QuestionListItem = {
  id: string;
  title: string;
  answerCount: number;
  nonEmptyBodyCount: number;
  hasQuestionInsight: boolean;
  questionInsightIsEmpty: boolean;
  updatedAt: string;
};

export type QuestionDetail = {
  id: string;
  title: string;
  answerCount: number;
  nonEmptyBodyCount: number;
  hasQuestionInsight: boolean;
  questionInsightIsEmpty: boolean;
  updatedAt: string;
};

export type ArticleListItem = {
  id: string;
  questionId: string;
  title: string;
  sourceUrl: string | null;
  isPreferred: boolean;
  bodyDocumentId: string | null;
  bodyIsEmpty: boolean;
  insightDocumentId: string | null;
  hasArticleInsight: boolean;
  articleInsightIsEmpty: boolean;
  flowchartCount: number;
  derivedQuestionCount: number;
  updatedAt: string;
};

export type DocumentType = "article_body" | "article_insight" | "question_insight";

export type DocumentDetail = {
  id: string;
  documentType: DocumentType;
  questionId: string | null;
  articleId: string | null;
  contentJson: Record<string, unknown>;
  contentHtml: string;
  plainText: string;
  wordCount: number;
  contentVersion: number;
  updatedAt: string;
};

export type DerivedQuestionItem = {
  linkId: string;
  questionId: string;
  title: string;
  answerCount: number;
  nonEmptyBodyCount: number;
  hasQuestionInsight: boolean;
  questionInsightIsEmpty: boolean;
  selectedText: string | null;
  note: string | null;
  sortOrder: number;
};

export type JumpResult =
  | {
      status: "ok";
      questionId: string;
      articleId: string | null;
      documentId: string;
      reason: null;
    }
  | {
      status: "no_non_empty_body" | "no_answer_article";
      questionId: string;
      articleId: null;
      documentId: null;
      reason: string;
    };

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type FlowchartListItem = {
  id: string;
  documentId: string;
  title: string;
  nodes: unknown[];
  edges: unknown[];
  viewport: Record<string, unknown>;
  sortOrder: number;
  updatedAt: string;
};

export type AppView =
  | { name: "questions" }
  | { name: "answers"; questionId: string; questionTitle?: string }
  | {
      name: "document";
      documentId: string;
      documentType: DocumentType;
      title: string;
      questionId?: string;
      questionTitle?: string;
      articleId?: string;
      articleTitle?: string;
      derivedJump?: boolean;
      originDocumentId?: string;
      originDocumentType?: DocumentType;
      originTitle?: string;
      originQuestionId?: string;
      originQuestionTitle?: string;
      originArticleId?: string;
      originArticleTitle?: string;
    };

export type SupabaseConfigStatus =
  | { configured: true; siteUrl: string; storageBucket: string }
  | { configured: false; missing: string[]; siteUrl: string; storageBucket: string };
