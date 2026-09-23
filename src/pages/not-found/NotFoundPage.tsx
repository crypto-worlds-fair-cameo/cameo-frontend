import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import SurfaceCard from '@/shared/ui/card/SurfaceCard';

const NotFoundPage = () => {
  const { t } = useTranslation('notFound');
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <SurfaceCard className="max-w-lg space-y-4 text-center">
        <p className="text-sm font-medium tracking-[0.16em] text-primary">{t('label')}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm leading-7 text-muted-foreground">{t('description')}</p>
        <Link
          to="/"
          className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          {t('home')}
        </Link>
      </SurfaceCard>
    </div>
  );
};

export default NotFoundPage;
