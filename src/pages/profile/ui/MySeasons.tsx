import { useId } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/shared/ui/button';

/** 내가 만든 시즌 목록은 서버 API가 없어 가짜 항목 없이 제목과 새 시즌 버튼만 표시한다. */
export function MySeasons() {
  const { t } = useTranslation('profile');
  const titleId = useId();
  return (
    <section className="profile-section profile-seasons" aria-labelledby={titleId}>
      <div className="profile-section-header">
        <h2 id={titleId}>{t('seasons.title')}</h2>
        <Button className="profile-new-season" size="sm" asChild>
          <Link to="/season-canvas">
            <Plus aria-hidden="true" />
            {t('seasons.newSeason')}
          </Link>
        </Button>
        <img
          className="profile-section-rule"
          src="/images/profile/section-rule.svg"
          alt=""
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
