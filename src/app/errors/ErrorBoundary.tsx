import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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

    return <ErrorFallback scope={this.props.scope} />;
  }
}

function ErrorFallback({ scope }: { scope: 'app' | 'page' }) {
  const { t } = useTranslation('common');

  return (
    <ErrorState
      role="alert"
      fullScreen={scope === 'app'}
      symbol={<CircleAlert />}
      title={scope === 'app' ? t('error.appTitle') : t('error.pageTitle')}
      description={t('error.description')}
      actions={
        <>
          <Button onClick={() => window.location.reload()}>{t('error.refresh')}</Button>
          <Button variant="secondary" asChild>
            <a href="/">{t('error.home')}</a>
          </Button>
        </>
      }
    />
  );
}
