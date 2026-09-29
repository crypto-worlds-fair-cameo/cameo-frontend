import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state/ErrorState';

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
      <ErrorState
        role="alert"
        fullScreen={this.props.scope === 'app'}
        symbol={<CircleAlert />}
        title={this.props.scope === 'app' ? '앱을 표시하지 못했어요' : '페이지를 표시하지 못했어요'}
        description="새로고침 후 다시 시도해 주세요."
        actions={
          <>
            <Button onClick={() => window.location.reload()}>새로고침</Button>
            <Button variant="secondary" asChild>
              <a href="/">홈으로 이동</a>
            </Button>
          </>
        }
      />
    );
  }
}
