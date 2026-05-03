"use client";

import { ArrowLeft, Check, ExternalLink, FilePlus2, FileText, Lightbulb, Plus, Search, Star, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  useArticles,
  useCreateArticle,
  useDeleteArticle,
  useEnsureQuestionInsight,
  useQuestionDetail,
  useSetPreferredAnswer,
  useSimilarArticles,
  useUpdateArticleSourceUrl,
  useUpdateArticleTitle
} from "@/hooks/use-articles";
import { useNavigationState } from "@/hooks/use-navigation-state";
import { getReadableError } from "@/data/errors";
import { ensureArticleDocument } from "@/data/articles";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { ArticleListItem } from "@/types/domain";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "未知时间";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function NewArticlePanel({ questionId }: { questionId: string }) {
  const [title, setTitle] = useState("");
  const createArticle = useCreateArticle(questionId);
  const similarArticles = useSimilarArticles(questionId, title);
  const normalizedTitle = title.trim();
  const exactMatch = useMemo(
    () => similarArticles.data?.some((article) => article.title.trim() === normalizedTitle),
    [normalizedTitle, similarArticles.data]
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalizedTitle || exactMatch) {
      return;
    }

    createArticle.mutate(normalizedTitle, {
      onSuccess: () => setTitle("")
    });
  }

  return (
    <section className="create-panel" aria-labelledby="new-article-title">
      <div>
        <p className="eyebrow">新建回答</p>
        <h2 id="new-article-title">给这个问题添加一篇文章</h2>
      </div>
      <form className="create-form" onSubmit={handleSubmit}>
        <input
          aria-label="新回答标题"
          placeholder="例如：社会系统如何自组织"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="primary-button compact" type="submit" disabled={!normalizedTitle || exactMatch || createArticle.isPending}>
          <Plus size={16} />
          新建
        </button>
      </form>

      {normalizedTitle ? (
        <div className="similar-box">
          <div className="similar-header">
            <span>相似标题</span>
            {similarArticles.isFetching ? <small>查询中</small> : null}
          </div>
          {exactMatch ? <p className="form-error">该问题下已有同名回答标题。</p> : null}
          {similarArticles.data?.length ? (
            <ul>
              {similarArticles.data.slice(0, 5).map((article) => (
                <li key={article.id}>
                  <span>{article.title}</span>
                  <small>
                    {article.bodyIsEmpty ? "空正文" : "有正文"} · 流程图 {article.flowchartCount}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="form-hint">没有找到相似标题。</p>
          )}
        </div>
      ) : null}

      {createArticle.error ? <p className="form-error">{getReadableError(createArticle.error)}</p> : null}
    </section>
  );
}

function ArticleRow({ article, questionTitle }: { article: ArticleListItem; questionTitle?: string }) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [draftTitle, setDraftTitle] = useState(article.title);
  const [draftUrl, setDraftUrl] = useState(article.sourceUrl ?? "");
  const updateTitle = useUpdateArticleTitle(article.questionId);
  const updateSource = useUpdateArticleSourceUrl(article.questionId);
  const setPreferred = useSetPreferredAnswer(article.questionId);
  const deleteArticle = useDeleteArticle(article.questionId);
  const openDocument = useNavigationState((state) => state.openDocument);

  function saveTitle() {
    const nextTitle = draftTitle.trim();

    if (!nextTitle || nextTitle === article.title) {
      setDraftTitle(article.title);
      setIsEditingTitle(false);
      return;
    }

    updateTitle.mutate(
      { articleId: article.id, title: nextTitle },
      {
        onSuccess: () => setIsEditingTitle(false)
      }
    );
  }

  function saveSource() {
    if (draftUrl.trim() === (article.sourceUrl ?? "")) {
      return;
    }

    updateSource.mutate({ articleId: article.id, sourceUrl: draftUrl });
  }

  async function openArticleBody() {
    const documentId = article.bodyDocumentId ?? (await ensureArticleDocument(article.id, "article_body"));
    openDocument({
      documentId,
      documentType: "article_body",
      title: article.title,
      questionId: article.questionId,
      questionTitle,
      articleId: article.id,
      articleTitle: article.title
    });
  }

  async function openArticleInsight() {
    const documentId = article.insightDocumentId ?? (await ensureArticleDocument(article.id, "article_insight"));
    openDocument({
      documentId,
      documentType: "article_insight",
      title: `${article.title} · 文章见解`,
      questionId: article.questionId,
      questionTitle,
      articleId: article.id,
      articleTitle: article.title
    });
  }

  return (
    <>
      <article className="article-row">
      <button
        className={`star-button ${article.isPreferred ? "active" : ""}`}
        type="button"
        onClick={() => setPreferred.mutate(article.id)}
        aria-label={article.isPreferred ? "已设为首选回答" : "设为首选回答"}
        title={article.isPreferred ? "已设为首选回答" : "设为首选回答"}
      >
        <Star size={17} fill={article.isPreferred ? "currentColor" : "none"} />
      </button>

      <div className="article-main">
        {isEditingTitle ? (
          <div className="inline-edit">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveTitle();
                if (event.key === "Escape") {
                  setDraftTitle(article.title);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
            />
            <button type="button" className="icon-button" onClick={saveTitle} aria-label="保存回答标题">
              <Check size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                setDraftTitle(article.title);
                setIsEditingTitle(false);
              }}
              aria-label="取消编辑"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button className="question-title-button" type="button" onClick={() => void openArticleBody()}>
            {article.title}
          </button>
        )}
        <div className="article-source">
          <input
            aria-label="来源链接"
            placeholder="来源链接，可选"
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
            onBlur={saveSource}
          />
          {article.sourceUrl ? (
            <a href={article.sourceUrl} target="_blank" rel="noreferrer" aria-label="打开来源链接">
              <ExternalLink size={15} />
            </a>
          ) : null}
        </div>
        {updateTitle.error ? <p className="form-error">{getReadableError(updateTitle.error)}</p> : null}
        {updateSource.error ? <p className="form-error">{getReadableError(updateSource.error)}</p> : null}
        {setPreferred.error ? <p className="form-error">{getReadableError(setPreferred.error)}</p> : null}
        {deleteArticle.error ? <p className="form-error">{getReadableError(deleteArticle.error)}</p> : null}
      </div>

      <div className="article-badges">
        <span className={article.bodyIsEmpty ? "badge draft" : "badge ready"}>{article.bodyIsEmpty ? "空正文" : "有正文"}</span>
        <span className={article.hasArticleInsight && !article.articleInsightIsEmpty ? "badge ready" : "badge muted"}>
          {article.hasArticleInsight && !article.articleInsightIsEmpty ? "有见解" : "无见解"}
        </span>
        <span className="badge muted">流程图 {article.flowchartCount}</span>
        <span className="badge muted">衍生 {article.derivedQuestionCount}</span>
        <span className="badge muted">{formatDate(article.updatedAt)}</span>
      </div>

      <div className="row-actions">
        <button className="secondary-button" type="button" onClick={() => void openArticleBody()}>
          <FileText size={15} />
          正文
        </button>
        <button className="secondary-button" type="button" onClick={() => void openArticleInsight()}>
          <Lightbulb size={15} />
          见解
        </button>
        <button className="secondary-button" type="button" onClick={() => setIsEditingTitle(true)}>
          编辑
        </button>
        <button className="icon-button danger-icon-button" type="button" onClick={() => setIsConfirmingDelete(true)} aria-label="删除回答" title="删除回答">
          <Trash2 size={15} />
        </button>
      </div>
      </article>
      {isConfirmingDelete ? (
        <ConfirmDialog
          title="删除这篇回答？"
          message={`会同时删除「${article.title}」的正文、文章见解、流程图和图片文件，不会删除衍生问题本体。`}
          isPending={deleteArticle.isPending}
          onCancel={() => setIsConfirmingDelete(false)}
          onConfirm={() =>
            deleteArticle.mutate(article.id, {
              onSuccess: () => setIsConfirmingDelete(false)
            })
          }
        />
      ) : null}
    </>
  );
}

export function ArticlesView({ questionId }: { questionId: string }) {
  const [search, setSearch] = useState("");
  const openQuestions = useNavigationState((state) => state.openQuestions);
  const question = useQuestionDetail(questionId);
  const articles = useArticles(questionId, search);
  const ensureInsight = useEnsureQuestionInsight(questionId);
  const openDocument = useNavigationState((state) => state.openDocument);

  return (
    <section className="questions-layout">
      <div className="page-heading">
        <div>
          <p className="eyebrow">回答标题页</p>
          <h1>{question.data?.title ?? "正在读取问题..."}</h1>
          <p>
            回答 {question.data?.answerCount ?? 0} · 正文 {question.data?.nonEmptyBodyCount ?? 0}
          </p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" type="button" onClick={openQuestions}>
            <ArrowLeft size={16} />
            问题库
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() =>
              ensureInsight.mutate(undefined, {
                onSuccess: (documentId) => {
                  openDocument({
                    documentId,
                    documentType: "question_insight",
                    title: `${question.data?.title ?? "问题"} · 问题见解`,
                    questionId,
                    questionTitle: question.data?.title
                  });
                }
              })
            }
            disabled={ensureInsight.isPending}
          >
            <FilePlus2 size={16} />
            打开问题见解
          </button>
        </div>
      </div>

      {question.error ? <p className="form-error">{getReadableError(question.error)}</p> : null}
      {ensureInsight.error ? <p className="form-error">{getReadableError(ensureInsight.error)}</p> : null}

      <div className="questions-grid">
        <div className="list-panel">
          <div className="list-toolbar">
            <div className="search-input">
              <Search size={17} />
              <input
                aria-label="搜索回答标题"
                placeholder="搜索回答标题..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {articles.isLoading ? <p className="state-text">正在读取回答标题...</p> : null}
          {articles.error ? <p className="form-error">{getReadableError(articles.error)}</p> : null}
          {!articles.isLoading && !articles.data?.length ? (
            <div className="empty-state">
              <h2>这个问题还没有回答文章</h2>
              <p>先添加一篇文章标题，后续就可以进入正文保存原文和自己的见解。</p>
            </div>
          ) : null}

          <div className="article-list">
            {articles.data?.map((article) => (
              <ArticleRow key={article.id} article={article} questionTitle={question.data?.title} />
            ))}
          </div>
        </div>

        <NewArticlePanel questionId={questionId} />
      </div>
    </section>
  );
}
