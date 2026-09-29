import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state/ErrorState';

const NotFoundPage = () => {
  const { t } = useTranslation('notFound');
  return (
    <ErrorState
      symbol="404"
      title={t('title')}
      description={t('description')}
      actions={
        <Button asChild>
          <Link to="/">{t('home')}</Link>
        </Button>
      }
    />
  );
};

export default NotFoundPage;
