"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <main className="setup-page">
          <section className="setup-card">
            <p className="eyebrow">note-remeber</p>
            <h1>页面遇到了意外错误</h1>
            <p>{this.state.error?.message ?? "未知错误"}</p>
            <p style={{ marginTop: 14 }}>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                重新加载
              </button>
            </p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
