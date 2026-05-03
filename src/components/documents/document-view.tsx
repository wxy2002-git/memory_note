"use client";

import { ArrowLeft, BookOpen, FileText, Lightbulb } from "lucide-react";
import { ensureArticleDocument } from "@/data/articles";
import { uploadImageAsset } from "@/data/assets";
import { getPreferredArticleContext, resolveQuestionJump } from "@/data/derived-questions";
import { getReadableError } from "@/data/errors";
import { useDocument, useSaveDocument } from "@/hooks/use-document";
import { useNavigationState } from "@/hooks/use-navigation-state";
import { DerivedQuestionsPanel } from "@/components/derived-questions/derived-questions-panel";
import { RichTextEditor } from "@/components/editor/rich-text-editor-enhanced";
import { FlowchartPanel } from "@/components/flowcharts/flowchart-panel";
import type { DocumentType } from "@/types/domain";

type DocumentViewProps = {
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

function getPlaceholder(documentType: DocumentType) {
  if (documentType === "question_insight") {
    return "写下你对这个问题的阶段性理解...";
  }

  if (documentType === "article_insight") {
    return "写下你对这篇文章的总结、结构和评价...";
  }

  return "粘贴文章内容，或开始输入...";
}

function getDocumentLabel(documentType: DocumentType) {
  if (documentType === "question_insight") {
    return "问题见解文";
  }

  if (documentType === "article_insight") {
    return "文章见解文";
  }

  return "文章原文正文";
}

export function DocumentView({
  documentId,
  documentType,
  title,
  questionId,
  questionTitle,
  articleId,
  articleTitle,
  derivedJump,
  originDocumentId,
  originDocumentType,
  originTitle,
  originQuestionId,
  originQuestionTitle,
  originArticleId,
  originArticleTitle
}: DocumentViewProps) {
  const document = useDocument(documentId);
  const saveDocument = useSaveDocument(documentId);
  const openAnswers = useNavigationState((state) => state.openAnswers);
  const openDocument = useNavigationState((state) => state.openDocument);

  async function openArticleInsight() {
    if (!articleId) {
      return;
    }

    const nextDocumentId = await ensureArticleDocument(articleId, "article_insight");
    openDocument({
      documentId: nextDocumentId,
      documentType: "article_insight",
      title: `${articleTitle ?? title} · 文章见解`,
      questionId,
      questionTitle,
      articleId,
      articleTitle: articleTitle ?? title,
      derivedJump,
      originDocumentId,
      originDocumentType,
      originTitle,
      originQuestionId,
      originQuestionTitle,
      originArticleId,
      originArticleTitle
    });
  }

  async function openArticleBody() {
    if (!articleId) {
      return;
    }

    const nextDocumentId = await ensureArticleDocument(articleId, "article_body");
    openDocument({
      documentId: nextDocumentId,
      documentType: "article_body",
      title: articleTitle ?? title,
      questionId,
      questionTitle,
      articleId,
      articleTitle: articleTitle ?? title,
      derivedJump,
      originDocumentId,
      originDocumentType,
      originTitle,
      originQuestionId,
      originQuestionTitle,
      originArticleId,
      originArticleTitle
    });
  }

  function returnOriginDocument() {
    if (!originDocumentId || !originDocumentType || !originTitle) {
      return;
    }

    openDocument({
      documentId: originDocumentId,
      documentType: originDocumentType,
      title: originTitle,
      questionId: originQuestionId,
      questionTitle: originQuestionTitle,
      articleId: originArticleId,
      articleTitle: originArticleTitle
    });
  }

  async function openPreferredArticleFromQuestion() {
    if (!questionId) {
      return;
    }

    const result = await resolveQuestionJump(questionId, "preferred_article");

    if (result.status !== "ok" || !result.articleId) {
      window.alert(result.reason);
      return;
    }

    const article = await getPreferredArticleContext(result.articleId);

    openDocument({
      documentId: result.documentId,
      documentType: "article_body",
      title: article.title,
      questionId: article.questionId,
      questionTitle: article.questionTitle,
      articleId: article.id,
      articleTitle: article.title,
      derivedJump,
      originDocumentId,
      originDocumentType,
      originTitle,
      originQuestionId,
      originQuestionTitle,
      originArticleId,
      originArticleTitle
    });
  }

  const canShowDerivedPanel = !derivedJump && (documentType === "article_body" || documentType === "question_insight");

  return (
    <section className="document-layout">
      <div className="document-heading">
        <div>
          <p className="eyebrow">{getDocumentLabel(documentType)}</p>
          <h1>{title}</h1>
          <p>
            {questionTitle ? `所属问题：${questionTitle}` : "问题见解"}
            {articleTitle && documentType !== "article_body" ? ` · 原文：${articleTitle}` : ""}
          </p>
        </div>
        <div className="heading-actions">
          {derivedJump && originDocumentId ? (
            <button className="secondary-button" type="button" onClick={returnOriginDocument}>
              <ArrowLeft size={16} />
              返回原正文
            </button>
          ) : null}
          {questionId ? (
            <button className="secondary-button" type="button" onClick={() => openAnswers(questionId, questionTitle)}>
              <ArrowLeft size={16} />
              回答
            </button>
          ) : null}
          {documentType === "article_body" ? (
            <button className="primary-button" type="button" onClick={() => void openArticleInsight()}>
              <Lightbulb size={16} />
              文章见解
            </button>
          ) : null}
          {documentType === "article_insight" ? (
            <button className="primary-button" type="button" onClick={() => void openArticleBody()}>
              <FileText size={16} />
              返回原文
            </button>
          ) : null}
          {documentType === "question_insight" ? (
            <button className="primary-button" type="button" onClick={() => void openPreferredArticleFromQuestion()}>
              <BookOpen size={16} />
              跳转首选回答
            </button>
          ) : null}
        </div>
      </div>

      {document.isLoading ? <p className="state-text">正在读取正文...</p> : null}
      {document.error ? <p className="form-error">{getReadableError(document.error)}</p> : null}
      {saveDocument.error ? <p className="form-error">{getReadableError(saveDocument.error)}</p> : null}

      {document.data ? (
        <div className={canShowDerivedPanel ? "document-workspace with-side-panel" : "document-workspace"}>
          <div className="document-main-stack">
            <RichTextEditor
              key={document.data.id}
              initialContentJson={document.data.contentJson}
              initialVersion={document.data.contentVersion}
            placeholder={getPlaceholder(documentType)}
            onImageUpload={(file) => uploadImageAsset(document.data.id, file)}
            onSave={(input) =>
              saveDocument.mutateAsync({
                  ...input
                })
              }
            />
            <FlowchartPanel documentId={document.data.id} />
          </div>
          {canShowDerivedPanel ? (
            <DerivedQuestionsPanel
              documentId={document.data.id}
              origin={{
                documentId,
                documentType,
                title,
                questionId,
                questionTitle,
                articleId,
                articleTitle
              }}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
