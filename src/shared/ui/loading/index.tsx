import { useTranslation } from 'react-i18next';
import { useLoadingStore } from '@/shared/ui/loading/model/loadingStore';

/**
 * Global loading component that displays a spinner when isLoading is true.
 * 사용법:
 * const { show, hide } = useLoadingStore();
 * const taskId = show();
 * try { await work(); } finally { hide(taskId); }
 * 페이지 조회는 페이지의 로딩 상태를 사용하고, 전체 화면 대기가 필요한 작업만 등록합니다.
 */
export const GlobalLoading = () => {
    const { t } = useTranslation('common');
    const { isLoading } = useLoadingStore();

    if (!isLoading) return null;

    return (
        <div
            role="status"
            aria-label={t('loading')}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40"
        >
            <span className="sr-only">{t('loading')}</span>
            <div
                aria-hidden="true"
                className="animate-spin rounded-full h-12 w-12 border-t-4 border-white"
            ></div>
        </div>
    );
};

export const RouteLoading = () => {
    const { t } = useTranslation('common');
    return (
        <div
            role="status"
            aria-label={t('loadingPage')}
            className="flex min-h-[40vh] items-center justify-center"
        >
            <div className="h-10 w-10 animate-spin rounded-full border-t-4 border-primary" />
        </div>
    );
};
