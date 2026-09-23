import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  scope: 'app' | 'page';
  resetKey?: string;
}

interface ErrorBoundaryState {
  failed: boolean;
  resetKey?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Unhandled ${this.props.scope} rendering error`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <section role="alert" className="mx-auto max-w-xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold">
          {this.props.scope === 'app'
            ? '앱을 표시하지 못했습니다.'
            : '페이지를 표시하지 못했습니다.'}
        </h1>
        <p>새로고침하거나 홈으로 이동해 다시 시도해 주세요.</p>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            className="rounded border px-4 py-2"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
          <a className="rounded border px-4 py-2" href="/">
            홈으로 이동
          </a>
        </div>
      </section>
    );
  }
}
