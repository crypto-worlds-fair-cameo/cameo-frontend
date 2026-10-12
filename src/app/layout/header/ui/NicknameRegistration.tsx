import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { DialogDescription } from '@/shared/ui/dialog';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/utils';
import {
  walletDialogActionsClassName,
  walletDialogButtonClassName,
} from '../config/walletDialogStyles';
import { useNicknameRegistration } from '../model/useNicknameRegistration';
import { useWalletAuthentication } from '../model/useWalletAuthentication';
import { openWalletDialogStep } from '../model/openWalletDialogStep';
import { ProfileCreatedContent } from './ProfileCreatedContent';

/** 새 계정의 닉네임 만들기 단계. 서버 거절은 입력칸 위에 안내한다. */
export function NicknameRegistrationContent() {
  const { t } = useTranslation('wallet');
  const auth = useWalletAuthentication();

  return (
    <div className="wallet-dialog">
      <DialogDescription className="sr-only">{t('nickname.description')}</DialogDescription>
      {auth.errorKey && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {t(auth.errorKey, { walletName: auth.errorWalletName })}
        </p>
      )}
      {auth.session && <NicknameRegistration key={auth.session.user.id} auth={auth} />}
    </div>
  );
}

interface NicknameRegistrationProps {
  auth: ReturnType<typeof useWalletAuthentication>;
}

function NicknameRegistration({ auth }: NicknameRegistrationProps) {
  const { t } = useTranslation('wallet');
  const form = useNicknameRegistration();

  return (
    // 입력칸은 제목 아래 넓은 여백 뒤에 두고, 완료 버튼은 다른 단계처럼 창 아래에 맞춘다.
    <form
      className="mt-20 flex flex-1 flex-col"
      onSubmit={event => {
        event.preventDefault();
        if (!form.canSubmit || auth.isPending) return;
        auth.saveNickname(form.nickname, () =>
          openWalletDialogStep({
            title: t('nickname.created'),
            content: <ProfileCreatedContent />,
            hideTitle: true,
          })
        );
      }}
    >
      <Field label={t('nickname.label')} error={form.tooLong ? t('nickname.tooLong') : undefined}>
        {props => (
          // 글자 수는 입력칸 안쪽 오른쪽 끝에 두고, 입력 글자가 숫자 밑으로 들어가지 않게 오른쪽 여백을 둔다.
          <div className="relative">
            <Input
              {...props}
              className="h-10 rounded-[4px] pr-14"
              name="nickname"
              autoComplete="nickname"
              autoFocus
              required
              value={form.nickname}
              disabled={auth.isPending}
              onChange={event => form.setNickname(event.target.value)}
            />
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground',
                form.tooLong && 'text-destructive'
              )}
            >
              {t('nickname.count', { count: form.length })}
            </span>
          </div>
        )}
      </Field>
      <div className={walletDialogActionsClassName}>
        <Button
          type="submit"
          variant="secondary"
          className={walletDialogButtonClassName}
          loading={auth.isPending}
          disabled={!form.canSubmit}
        >
          {t(auth.isPending ? 'nickname.saving' : 'nickname.complete')}
        </Button>
      </div>
    </form>
  );
}
