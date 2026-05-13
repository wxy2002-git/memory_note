"use client";

import { Check, FileText, Plus, Search, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  useCreateQuestion,
  useDeleteQuestion,
  useQuestions,
  useSimilarQuestions,
  useUpdateQuestionTitle
} from "@/hooks/use-questions";
import { useNavigationState } from "@/hooks/use-navigation-state";
import { getReadableError } from "@/data/errors";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { MAX_TITLE_LENGTH } from "@/lib/text-limits";
import type { QuestionListItem } from "@/types/domain";

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

function getQuestionState(question: QuestionListItem) {
  if (question.nonEmptyBodyCount > 0) {
    return "ready";
  }

  if (question.answerCount > 0) {
    return "draft";
  }

  return "empty";
}

function NewQuestionPanel() {
  const [title, setTitle] = useState("");
  const createQuestion = useCreateQuestion();
  const similarQuestions = useSimilarQuestions(title);
  const normalizedTitle = title.trim();
  const titleTooLong = normalizedTitle.length > MAX_TITLE_LENGTH;
  const exactMatch = useMemo(
    () => similarQuestions.data?.some((question) => question.title.trim() === normalizedTitle),
    [normalizedTitle, similarQuestions.data]
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalizedTitle || titleTooLong || exactMatch) {
      return;
    }

    createQuestion.mutate(normalizedTitle, {
      onSuccess: () => {
        setTitle("");
      }
    });
  }

  return (
    <section className="create-panel" aria-labelledby="new-question-title">
      <div>
        <p className="eyebrow">新建问题</p>
        <h2 id="new-question-title">把新的疑问放进问题库</h2>
      </div>
      <form className="create-form" onSubmit={handleSubmit}>
        <input
          aria-label="新问题标题"
          placeholder="例如：社会运转的规律是什么？"
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="primary-button compact" type="submit" disabled={!normalizedTitle || titleTooLong || exactMatch || createQuestion.isPending}>
          <Plus size={16} />
          新建
        </button>
      </form>

      {normalizedTitle ? (
        <div className="similar-box">
          <div className="similar-header">
            <span>相似问题</span>
            {similarQuestions.isFetching ? <small>查询中</small> : null}
          </div>
          {titleTooLong ? <p className="form-error">问题标题最多 {MAX_TITLE_LENGTH} 个字符。</p> : null}
          {exactMatch ? <p className="form-error">已存在同名问题，不能重复创建。</p> : null}
          {similarQuestions.data?.length ? (
            <ul>
              {similarQuestions.data.slice(0, 5).map((question) => (
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

      {createQuestion.error ? <p className="form-error">{getReadableError(createQuestion.error)}</p> : null}
    </section>
  );
}

function QuestionRow({ question }: { question: QuestionListItem }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [draftTitle, setDraftTitle] = useState(question.title);
  const updateTitle = useUpdateQuestionTitle();
  const deleteQuestion = useDeleteQuestion();
  const openAnswers = useNavigationState((state) => state.openAnswers);
  const state = getQuestionState(question);

  function saveTitle() {
    const nextTitle = draftTitle.trim();

    if (!nextTitle || nextTitle === question.title) {
      setDraftTitle(question.title);
      setIsEditing(false);
      return;
    }

    updateTitle.mutate(
      { questionId: question.id, title: nextTitle },
      {
        onSuccess: () => {
          setIsEditing(false);
        }
      }
    );
  }

  return (
    <>
      <article className="question-row">
      <div className={`status-dot ${state}`} aria-hidden="true" />
      <div className="question-main">
        {isEditing ? (
          <div className="inline-edit">
            <input
              value={draftTitle}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  saveTitle();
                }

                if (event.key === "Escape") {
                  setDraftTitle(question.title);
                  setIsEditing(false);
                }
              }}
              autoFocus
            />
            <button type="button" className="icon-button" onClick={saveTitle} aria-label="保存问题标题">
              <Check size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                setDraftTitle(question.title);
                setIsEditing(false);
              }}
              aria-label="取消编辑"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button className="question-title-button" type="button" onClick={() => openAnswers(question.id, question.title)} onDoubleClick={() => setIsEditing(true)}>
            {question.title}
          </button>
        )}
        {updateTitle.error ? <p className="form-error">{getReadableError(updateTitle.error)}</p> : null}
        {deleteQuestion.error ? <p className="form-error">{getReadableError(deleteQuestion.error)}</p> : null}
      </div>
      <div className="question-meta">
        <span>回答 {question.answerCount}</span>
        <span>正文 {question.nonEmptyBodyCount}</span>
        <span>{formatDate(question.updatedAt)}</span>
      </div>
      <div className="row-actions">
        <button className="secondary-button" type="button" onClick={() => openAnswers(question.id, question.title)}>
          <FileText size={15} />
          回答
        </button>
        <button className="secondary-button" type="button" onClick={() => setIsEditing(true)}>
          编辑
        </button>
        <button className="icon-button danger-icon-button" type="button" onClick={() => setIsConfirmingDelete(true)} aria-label="删除问题" title="删除问题">
          <Trash2 size={15} />
        </button>
      </div>
      </article>
      {isConfirmingDelete ? (
        <ConfirmDialog
          title="删除这个问题？"
          message={`会同时删除「${question.title}」下的回答、正文、流程图和图片文件。这个操作不能撤销。`}
          isPending={deleteQuestion.isPending}
          onCancel={() => setIsConfirmingDelete(false)}
          onConfirm={() =>
            deleteQuestion.mutate(question.id, {
              onSuccess: () => setIsConfirmingDelete(false)
            })
          }
        />
      ) : null}
    </>
  );
}

type QuestionFilter = "all" | "no-answers" | "has-titles" | "has-body" | "recent";

function filterQuestions(questions: QuestionListItem[], filter: QuestionFilter) {
  switch (filter) {
    case "no-answers":
      return questions.filter((q) => q.answerCount === 0);
    case "has-titles":
      return questions.filter((q) => q.answerCount > 0 && q.nonEmptyBodyCount === 0);
    case "has-body":
      return questions.filter((q) => q.nonEmptyBodyCount > 0);
    case "recent":
      return [...questions].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    default:
      return questions;
  }
}

export function QuestionsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<QuestionFilter>("all");
  const questions = useQuestions(search);
  const filteredQuestions = questions.data ? filterQuestions(questions.data, filter) : undefined;

  return (
    <section className="questions-layout">
      <div className="page-heading">
        <div>
          <p className="eyebrow">问题库</p>
          <h1>围绕问题管理阅读材料</h1>
          <p>搜索、筛选和管理你的问题库。</p>
        </div>
      </div>

      <div className="questions-grid">
        <div className="list-panel">
          <div className="list-toolbar">
            <div className="search-input">
              <Search size={17} />
              <input
                aria-label="搜索问题"
                placeholder="搜索问题..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="filter-tabs">
              {([
                ["all", "全部"],
                ["no-answers", "无回答"],
                ["has-titles", "仅标题"],
                ["has-body", "有正文"],
                ["recent", "最近更新"]
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`filter-tab ${filter === value ? "active" : ""}`}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {questions.isLoading ? <p className="state-text">正在读取问题库...</p> : null}
          {questions.error ? <p className="form-error">{getReadableError(questions.error)}</p> : null}
          {!questions.isLoading && !filteredQuestions?.length ? (
            <div className="empty-state">
              <h2>{search || filter !== "all" ? "没有匹配的问题" : "还没有问题"}</h2>
              <p>{search || filter !== "all" ? "尝试调整搜索条件或筛选。" : "先创建一个你正在追问的主题，之后就可以往里面放文章和见解。"}</p>
            </div>
          ) : null}

          <div className="question-list">
            {filteredQuestions?.map((question) => <QuestionRow key={question.id} question={question} />)}
          </div>
        </div>

        <NewQuestionPanel />
      </div>
    </section>
  );
}
