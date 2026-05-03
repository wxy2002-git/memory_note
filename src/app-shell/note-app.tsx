"use client";

import { BookOpen, LogOut, Search } from "lucide-react";
import { AppQueryProvider } from "@/lib/query-client";
import { useAuth } from "@/hooks/use-auth";
import { LoginView } from "@/components/auth/login-view";
import { QuestionsView } from "@/components/questions/questions-view";
import { ArticlesView } from "@/components/articles/articles-view";
import { DocumentView } from "@/components/documents/document-view";
import { getReadableError } from "@/data/errors";
import { useNavigationState } from "@/hooks/use-navigation-state";

function AppContent() {
  const { config, user, isLoading, userError, signOut } = useAuth();
  const view = useNavigationState((state) => state.view);
  const openQuestions = useNavigationState((state) => state.openQuestions);

  if (!config.configured) {
    return (
      <main className="setup-page">
        <section className="setup-card">
          <p className="eyebrow">note-remeber</p>
          <h1>需要先配置 Supabase</h1>
          <p>
            当前缺少环境变量：{config.missing.join("、")}。请复制
            <code>.env.example</code> 为 <code>.env.local</code>，填入 Supabase 项目地址和 anon key。
          </p>
          <div className="setup-list">
            <span>当前站点地址：{config.siteUrl}</span>
            <span>默认存储桶：{config.storageBucket}</span>
          </div>
        </section>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="setup-page">
        <section className="setup-card">
          <p className="eyebrow">note-remeber</p>
          <h1>正在检查登录状态</h1>
          <p>稍等一下，应用正在连接你的阅读工作台。</p>
        </section>
      </main>
    );
  }

  if (userError) {
    return (
      <main className="setup-page">
        <section className="setup-card">
          <p className="eyebrow">note-remeber</p>
          <h1>连接失败</h1>
          <p>{getReadableError(userError)}</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div className="brand">
          <BookOpen size={18} />
          <span>note-remeber</span>
        </div>
        <nav className="topbar-nav" aria-label="主导航">
          <button
            className={`nav-button ${view.name === "questions" ? "active" : ""}`}
            type="button"
            onClick={openQuestions}
          >
            问题库
          </button>
          <button className={`nav-button ${view.name === "answers" ? "active" : ""}`} type="button" disabled={view.name !== "answers"}>
            回答
          </button>
        </nav>
        <div className="topbar-path">
          <Search size={15} />
          <span>
            {view.name === "answers"
              ? `问题库 > 回答${view.questionTitle ? ` > ${view.questionTitle}` : ""}`
              : view.name === "document"
                ? `问题库 > 回答${view.questionTitle ? ` > ${view.questionTitle}` : ""} > ${view.derivedJump ? "衍生跳转 > " : ""}${view.title}`
                : "问题库"}
          </span>
        </div>
        <div className="topbar-user">
          <span>{user.email}</span>
          <button
            className="icon-text-button"
            type="button"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
          >
            <LogOut size={15} />
            退出
          </button>
        </div>
      </header>
      {view.name === "questions" ? <QuestionsView /> : null}
      {view.name === "answers" ? <ArticlesView questionId={view.questionId} /> : null}
      {view.name === "document" ? (
        <DocumentView
          documentId={view.documentId}
          documentType={view.documentType}
          title={view.title}
          questionId={view.questionId}
          questionTitle={view.questionTitle}
          articleId={view.articleId}
          articleTitle={view.articleTitle}
          derivedJump={view.derivedJump}
          originDocumentId={view.originDocumentId}
          originDocumentType={view.originDocumentType}
          originTitle={view.originTitle}
          originQuestionId={view.originQuestionId}
          originQuestionTitle={view.originQuestionTitle}
          originArticleId={view.originArticleId}
          originArticleTitle={view.originArticleTitle}
        />
      ) : null}
    </main>
  );
}

export function NoteApp() {
  return (
    <AppQueryProvider>
      <AppContent />
    </AppQueryProvider>
  );
}
