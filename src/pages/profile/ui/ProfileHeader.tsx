import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AuthenticatedSession } from '@/entities/session';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { shortenAddress } from '../lib/profileFormat';
import { EditProfileDialog } from './EditProfileDialog';

interface ProfileHeaderProps {
  user: AuthenticatedSession['user'];
  walletAddress?: string;
  showActions: boolean;
  onShowJoined: () => void;
}

/** 프로필 사진·닉네임·지갑 주소. 시안처럼 프로필·내 시즌 탭에서만 수정·참여 캔버스 버튼을 둔다. */
export function ProfileHeader({
  user,
  walletAddress,
  showActions,
  onShowJoined,
}: ProfileHeaderProps) {
  const { t } = useTranslation('profile');
  const name = user.displayName?.trim();
  return (
    <header className="profile-header">
      <Avatar className="size-16" aria-hidden="true">
        <AvatarImage src={user.avatarUrl || undefined} alt="" className="object-cover" />
        <AvatarFallback className="bg-gray-100 text-gray-600">
          <UserRound className="size-7" />
        </AvatarFallback>
      </Avatar>
      <div className="profile-identity">
        <h1>{name ? `@${name}` : t('fallbackName')}</h1>
        {walletAddress && (
          <p className="font-data" title={walletAddress}>
            {shortenAddress(walletAddress)}
          </p>
        )}
      </div>
      {showActions && (
        <div className="profile-actions">
          <EditProfileDialog
            user={user}
            trigger={
              <Button variant="secondary" size="sm">
                {t('header.edit')}
              </Button>
            }
          />
          <Button variant="secondary" size="sm" onClick={onShowJoined}>
            {t('header.joinedCanvases')}
          </Button>
        </div>
      )}
    </header>
  );
}
