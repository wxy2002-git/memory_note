"use client";

import { ArrowLeft, BookOpen, Check, Download, FileJson, FileText, GitBranch, Lightbulb } from "lucide-react";
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ensureArticleDocument } from "@/data/articles";
import { uploadImageAsset } from "@/data/assets";
import { getPreferredArticleContext, resolveQuestionJump } from "@/data/derived-questions";
import { getReadableError } from "@/data/errors";
import { useAddDerivedQuestion } from "@/hooks/use-derived-questions";
import { useDocument, useSaveDocument } from "@/hooks/use-document";
import { useNavigationState } from "@/hooks/use-navigation-state";
import { DerivedQuestionsPanel } from "@/components/derived-questions/derived-questions-panel";
import { RichTextEditor } from "@/components/editor/rich-text-editor-enhanced";
import { FlowchartPanel } from "@/components/flowcharts/flowchart-panel";
import { downloadTextFile, safeDownloadName } from "@/lib/download";
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

type SidePanelKind = "derived" | "flowchart";

function clampWidth(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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

function htmlToMarkdownishText(html: string, plainText: string) {
  if (!html.trim()) {
    return plainText;
  }

  return html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createWordHtml(title: string, bodyHtml: string) {
  const escapedTitle = escapeHtml(title);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapedTitle}</title>
  <style>
    body {
      font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      line-height: 1.7;
      color: #111827;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    td,
    th {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
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
  const addDerivedQuestion = useAddDerivedQuestion(documentId);
  const openAnswers = useNavigationState((state) => state.openAnswers);
  const openDocument = useNavigationState((state) => state.openDocument);
  const [derivedToast, setDerivedToast] = useState<string | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<SidePanelKind | null>(null);
  const [derivedPanelWidth, setDerivedPanelWidth] = useState(360);
  const [flowchartPanelWidth, setFlowchartPanelWidth] = useState(640);
  const derivedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function showToast(message: string) {
    setDerivedToast(message);
    if (derivedToastTimer.current) {
      clearTimeout(derivedToastTimer.current);
    }
    derivedToastTimer.current = setTimeout(() => setDerivedToast(null), 2800);
  }

  function handleCreateDerivedFromSelection(selectedText: string) {
    const title = selectedText.trim()
      ? `什么是"${selectedText.slice(0, 60)}"${selectedText.length > 60 ? "..." : ""}？`
      : "";
    if (!title) return;
    addDerivedQuestion.mutate(title, {
      onSuccess: () => showToast("已添加到衍生问题"),
      onError: () => showToast("添加衍生问题失败，请重试")
    });
  }

  function toggleSidePanel(panel: SidePanelKind) {
    setActiveSidePanel((currentPanel) => (currentPanel === panel ? null : panel));
  }

  function startPanelResize(event: ReactPointerEvent<HTMLDivElement>, panel: SidePanelKind) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = panel === "derived" ? derivedPanelWidth : flowchartPanelWidth;
    const minWidth = panel === "derived" ? 300 : 420;
    const maxWidth = Math.max(minWidth, window.innerWidth - 96);

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = clampWidth(startWidth + startX - moveEvent.clientX, minWidth, maxWidth);

      if (panel === "derived") {
        setDerivedPanelWidth(nextWidth);
        return;
      }

      setFlowchartPanelWidth(nextWidth);
    }

    function stopResize() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
  }

  const canShowDerivedPanel = !derivedJump && (documentType === "article_body" || documentType === "question_insight");
  const canShowDerivedBubble = !derivedJump && (documentType === "article_body" || documentType === "question_insight");
  const activePanelWidth = activeSidePanel === "derived" ? derivedPanelWidth : flowchartPanelWidth;
  const workspaceStyle = activeSidePanel
    ? ({
        "--document-side-panel-width": `${activePanelWidth}px`
      } as CSSProperties)
    : undefined;

  function exportDocument(format: "html" | "markdown" | "json" | "word") {
    if (!document.data) {
      return;
    }

    const baseName = safeDownloadName(title);

    if (format === "html") {
      downloadTextFile(`${baseName}.html`, document.data.contentHtml, "text/html");
      return;
    }

    if (format === "word") {
      downloadTextFile(
        `${baseName}.doc`,
        createWordHtml(title, document.data.contentHtml),
        "application/msword"
      );
      return;
    }

    if (format === "markdown") {
      downloadTextFile(
        `${baseName}.md`,
        htmlToMarkdownishText(document.data.contentHtml, document.data.plainText),
        "text/markdown"
      );
      return;
    }

    downloadTextFile(
      `${baseName}.json`,
      JSON.stringify(
        {
          title,
          documentType,
          questionTitle,
          articleTitle,
          contentJson: document.data.contentJson,
          contentHtml: document.data.contentHtml,
          plainText: document.data.plainText,
          wordCount: document.data.wordCount,
          updatedAt: document.data.updatedAt
        },
        null,
        2
      ),
      "application/json"
    );
  }

  return (
    <section className={`document-layout ${activeSidePanel ? "with-side-panel" : ""}`} style={workspaceStyle}>
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
          {document.data ? (
            <div className="export-actions" aria-label="导出正文">
              <button className="secondary-button" type="button" onClick={() => exportDocument("markdown")}>
                <Download size={16} />
                Markdown
              </button>
              <button className="secondary-button icon-only" type="button" onClick={() => exportDocument("html")} aria-label="导出 HTML" title="导出 HTML">
                <FileText size={16} />
              </button>
              <button className="secondary-button icon-only" type="button" onClick={() => exportDocument("word")} aria-label="导出 Word" title="导出 Word">
                <FileText size={16} />
              </button>
              <button className="secondary-button icon-only" type="button" onClick={() => exportDocument("json")} aria-label="导出 JSON" title="导出 JSON">
                <FileJson size={16} />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {document.isLoading ? <p className="state-text">正在读取正文...</p> : null}
      {document.error ? <p className="form-error">{getReadableError(document.error)}</p> : null}
      {saveDocument.error ? <p className="form-error">{getReadableError(saveDocument.error)}</p> : null}
      {derivedToast ? (
        <p className="toast-message">
          <Check size={14} /> {derivedToast}
        </p>
      ) : null}
      {addDerivedQuestion.error ? <p className="form-error">{getReadableError(addDerivedQuestion.error)}</p> : null}

      {document.data ? (
        <>
        <div className="document-workspace">
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
              showDerivedQuestionEntry={canShowDerivedBubble}
              onCreateDerivedQuestion={handleCreateDerivedFromSelection}
            />
          </div>
        </div>
        <div className="document-side-dock" aria-label="正文侧边工具">
          {canShowDerivedPanel ? (
            <button
              className={`tool-button dock-button ${activeSidePanel === "derived" ? "active" : ""}`}
              type="button"
              onClick={() => toggleSidePanel("derived")}
              aria-label="打开衍生问题"
              title="衍生问题"
            >
              <Lightbulb size={17} />
            </button>
          ) : null}
          <button
            className={`tool-button dock-button ${activeSidePanel === "flowchart" ? "active" : ""}`}
            type="button"
            onClick={() => toggleSidePanel("flowchart")}
            aria-label="打开流程图"
            title="流程图"
          >
            <GitBranch size={17} />
          </button>
        </div>
        {activeSidePanel === "derived" && canShowDerivedPanel ? (
          <aside className="document-floating-panel derived-dock-panel" style={{ width: derivedPanelWidth }}>
            <div
              className="floating-panel-resize-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label="调整衍生问题面板宽度"
              onPointerDown={(event) => startPanelResize(event, "derived")}
            />
            <DerivedQuestionsPanel
              documentId={document.data.id}
              onClose={() => setActiveSidePanel(null)}
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
          </aside>
        ) : null}
        {activeSidePanel === "flowchart" ? (
          <aside className="document-floating-panel flowchart-dock-panel" style={{ width: flowchartPanelWidth }}>
            <div
              className="floating-panel-resize-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label="调整流程图面板宽度"
              onPointerDown={(event) => startPanelResize(event, "flowchart")}
            />
            <FlowchartPanel documentId={document.data.id} onClose={() => setActiveSidePanel(null)} />
          </aside>
        ) : null}
        </>
      ) : null}
    </section>
  );
}
