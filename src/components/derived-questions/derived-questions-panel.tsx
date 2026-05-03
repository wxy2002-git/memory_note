"use client";

import { ArrowRight, BookOpen, Lightbulb, Plus, Search, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { getPreferredArticleContext } from "@/data/derived-questions";
import { getReadableError } from "@/data/errors";
import {
  useAddDerivedQuestion,
  useDerivedQuestions,
  useRemoveDerivedQuestion,
  useResolveQuestionJump
} from "@/hooks/use-derived-questions";
import { useNavigationState } from "@/hooks/use-navigation-state";
import { useSimilarQuestions } from "@/hooks/use-questions";
import type { DerivedQuestionItem, DocumentType } from "@/types/domain";

type DerivedQuestionsPanelProps = {
  documentId: string;
  origin: {
    documentId: string;
    documentType: DocumentType;
    title: string;
    questionId?: string;
    questionTitle?: string;
    articleId?: string;
    articleTitle?: string;
  };
};

export function DerivedQuestionsPanel({ documentId, origin }: DerivedQuestionsPanelProps) {
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [selected, setSelected] = useState<DerivedQuestionItem | null>(null);
  const [jumpMessage, setJumpMessage] = useState<string | null>(null);
  const derivedQuestions = useDerivedQuestions(documentId, search);
  const addDerived = useAddDerivedQuestion(documentId);
  const removeDerived = useRemoveDerivedQuestion(documentId);
  const resolveJump = useResolveQuestionJump();
  const similarQuestions = useSimilarQuestions(newTitle);
  const openDocument = useNavigationState((state) => state.openDocument);
  const normalizedTitle = newTitle.trim();
  const exactMatchInPanel = useMemo(
    () => derivedQuestions.data?.some((item) => item.title.trim() === normalizedTitle),
    [derivedQuestions.data, normalizedTitle]
  );

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalizedTitle || exactMatchInPanel) {
      return;
    }

    addDerived.mutate(normalizedTitle, {
      onSuccess: () => {
        setNewTitle("");
      }
    });
  }

  function handleRemove(item: DerivedQuestionItem) {
    if (!window.confirm("确认从当前正文移除这个衍生问题吗？")) {
      return;
    }

    removeDerived.mutate(item.linkId);
  }

  function openInsight(item: DerivedQuestionItem) {
    setJumpMessage(null);
    resolveJump.mutate(
      { questionId: item.questionId, jumpTarget: "insight" },
      {
        onSuccess: (result) => {
          if (result.status !== "ok") {
            setJumpMessage(result.reason);
            return;
          }

          openDocument({
            documentId: result.documentId,
            documentType: "question_insight",
            title: `${item.title} · 问题见解`,
            questionId: item.questionId,
            questionTitle: item.title,
            derivedJump: true,
            originDocumentId: origin.documentId,
            originDocumentType: origin.documentType,
            originTitle: origin.title,
            originQuestionId: origin.questionId,
            originQuestionTitle: origin.questionTitle,
            originArticleId: origin.articleId,
            originArticleTitle: origin.articleTitle
          });
        },
        onError: (error) => {
          setJumpMessage(getReadableError(error));
        }
      }
    );
  }

  function openPreferredArticle(item: DerivedQuestionItem) {
    setJumpMessage(null);
    resolveJump.mutate(
      { questionId: item.questionId, jumpTarget: "preferred_article" },
      {
        onSuccess: async (result) => {
          if (result.status !== "ok" || !result.articleId) {
            setJumpMessage(result.reason);
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
            derivedJump: true,
            originDocumentId: origin.documentId,
            originDocumentType: origin.documentType,
            originTitle: origin.title,
            originQuestionId: origin.questionId,
            originQuestionTitle: origin.questionTitle,
            originArticleId: origin.articleId,
            originArticleTitle: origin.articleTitle
          });
        },
        onError: (error) => {
          setJumpMessage(getReadableError(error));
        }
      }
    );
  }

  return (
    <aside className="derived-panel" aria-label="衍生问题">
      <div className="derived-header">
        <div>
          <p className="eyebrow">衍生问题</p>
          <h2>阅读中冒出来的问题</h2>
        </div>
      </div>

      <div className="search-input compact-search">
        <Search size={16} />
        <input
          aria-label="搜索当前正文衍生问题"
          placeholder="搜索当前正文..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <form className="derived-create" onSubmit={handleAdd}>
        <input
          aria-label="新建衍生问题"
          placeholder="新建衍生问题..."
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
        />
        <button
          type="submit"
          className="icon-button"
          disabled={!normalizedTitle || Boolean(exactMatchInPanel) || addDerived.isPending}
          aria-label="添加衍生问题"
        >
          <Plus size={16} />
        </button>
      </form>

      {normalizedTitle ? (
        <div className="similar-box slim">
          <div className="similar-header">
            <span>全局相似问题</span>
            {similarQuestions.isFetching ? <small>查询中</small> : null}
          </div>
          {exactMatchInPanel ? <p className="form-error">当前正文已记录这个衍生问题。</p> : null}
          {similarQuestions.data?.length ? (
            <ul>
              {similarQuestions.data.slice(0, 4).map((question) => (
                <li key={question.id}>
                  <span>{question.title}</span>
                  <small>
                    回答 {question.answerCount} · 正文 {question.nonEmptyBodyCount}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="form-hint">没有找到相似问题。</p>
          )}
        </div>
      ) : null}

      {addDerived.error ? <p className="form-error">{getReadableError(addDerived.error)}</p> : null}
      {removeDerived.error ? <p className="form-error">{getReadableError(removeDerived.error)}</p> : null}

      <div className="derived-list">
        {derivedQuestions.isLoading ? <p className="state-text compact">正在读取衍生问题...</p> : null}
        {derivedQuestions.error ? <p className="form-error">{getReadableError(derivedQuestions.error)}</p> : null}
        {!derivedQuestions.isLoading && !derivedQuestions.data?.length ? (
          <div className="derived-empty">当前正文还没有衍生问题。</div>
        ) : null}
        {derivedQuestions.data?.map((item) => (
          <article key={item.linkId} className="derived-item">
            <button className="derived-title" type="button" onClick={() => setSelected(item)}>
              {item.title}
            </button>
            <div className="derived-meta">
              <span>回答 {item.answerCount}</span>
              <span>正文 {item.nonEmptyBodyCount}</span>
              <span>{item.hasQuestionInsight && !item.questionInsightIsEmpty ? "有见解" : "无见解"}</span>
            </div>
            <button className="mini-danger" type="button" onClick={() => handleRemove(item)} aria-label="移除衍生问题">
              <Trash2 size={14} />
            </button>
          </article>
        ))}
      </div>

      {selected ? (
        <div className="jump-dialog" role="dialog" aria-modal="true" aria-label="选择跳转目标">
          <div className="jump-card">
            <button className="jump-close" type="button" onClick={() => setSelected(null)} aria-label="关闭">
              <X size={16} />
            </button>
            <p className="eyebrow">跳转到</p>
            <h2>{selected.title}</h2>
            <div className="jump-actions">
              <button className="primary-button" type="button" onClick={() => openInsight(selected)} disabled={resolveJump.isPending}>
                <Lightbulb size={16} />
                问题见解
              </button>
              <button className="secondary-button" type="button" onClick={() => openPreferredArticle(selected)} disabled={resolveJump.isPending}>
                <BookOpen size={16} />
                首选回答
              </button>
            </div>
            {jumpMessage ? <p className="form-error">{jumpMessage}</p> : null}
            {resolveJump.isPending ? (
              <p className="form-hint">
                <ArrowRight size={14} /> 正在解析跳转目标...
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
