import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';
import { useNicknameRegistration } from '../model/useNicknameRegistration';
import type { useWalletAuthentication } from '../model/useWalletAuthentication';
import { ProfileUpdatedContent } from './ProfileUpdatedContent';

interface NicknameRegistrationProps {
  auth: ReturnType<typeof useWalletAuthentication>;
}

export function NicknameRegistration({ auth }: NicknameRegistrationProps) {
  const { t } = useTranslation('wallet');
  const form = useNicknameRegistration();

  return (
    <form
      className="grid gap-4"
      onSubmit={event => {
        event.preventDefault();
        if (!form.canSubmit || auth.isPending) return;
        auth.saveNickname(form.nickname, () => {
          const modal = useModalStore.getState();
          modal.openModal({
            title: t('nickname.updated'),
            titleClassName: 'sr-only',
            content: <ProfileUpdatedContent />,
            returnFocusElement: modal.returnFocusElement,
          });
        });
      }}
    >
      <Field
        label={t('nickname.label')}
        hint={t('nickname.hint', { count: form.length })}
        error={form.tooLong ? t('errors.nicknameInvalid') : undefined}
        required
      >
        {props => (
          <Input
            {...props}
            name="nickname"
            autoComplete="nickname"
            autoFocus
            value={form.nickname}
            disabled={auth.isPending}
            onChange={event => form.setNickname(event.target.value)}
            placeholder={t('nickname.placeholder')}
          />
        )}
      </Field>
      <Button type="submit" className="w-full" loading={auth.isPending} disabled={!form.canSubmit}>
        {t(auth.isPending ? 'nickname.saving' : 'nickname.complete')}
      </Button>
    </form>
  );
}
