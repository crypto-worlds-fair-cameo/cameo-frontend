import { useId, useRef, useState, type ReactNode } from 'react';
import { Pencil, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { AuthenticatedSession } from '@/entities/session';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { useDisplayNameMutation } from '../api/profile.queries';
import { NICKNAME_MAX_LENGTH } from '../lib/profileValidation';
import { getProfileSaveErrorKey, useProfileEditForm } from '../model/useProfileEditForm';

type ProfileUser = AuthenticatedSession['user'];
type DisplayNameMutation = ReturnType<typeof useDisplayNameMutation>;

/** 수정 버튼으로 여는 프로필 수정 모달. 저장 중에는 닫기를 막아 결과를 확인할 수 있게 한다. */
export function EditProfileDialog({ user, trigger }: { user: ProfileUser; trigger: ReactNode }) {
  const { t } = useTranslation('profile');
  const [open, setOpen] = useState(false);
  const mutation = useDisplayNameMutation();

  function changeOpen(next: boolean) {
    if (!next && mutation.isPending) return;
    // 다시 열었을 때 이전 저장 오류가 남지 않도록 닫을 때 결과를 비운다.
    if (!next) mutation.reset();
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="cameo-light profile-edit-dialog">
        <DialogHeader>
          <DialogTitle>{t('edit.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('edit.description')}</DialogDescription>
        </DialogHeader>
        {/* 모달 내용은 열 때마다 새로 마운트되어 현재 닉네임으로 입력을 초기화한다. */}
        <EditProfileForm
          user={user}
          mutation={mutation}
          onSaved={() => {
            mutation.reset();
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditProfileForm({
  user,
  mutation,
  onSaved,
}: {
  user: ProfileUser;
  mutation: DisplayNameMutation;
  onSaved: () => void;
}) {
  const { t } = useTranslation('profile');
  const form = useProfileEditForm(user.displayName);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageHintId = useId();
  const errorKey = mutation.isError ? getProfileSaveErrorKey(mutation.error) : null;
  const imageState = form.avatar.error ? 'error' : form.avatar.previewUrl ? 'selected' : undefined;

  return (
    <form
      className="profile-edit-form"
      onSubmit={event => {
        event.preventDefault();
        if (!form.canSave || mutation.isPending) return;
        mutation.mutate(form.nickname.trim(), {
          onSuccess: () => {
            toast(t('edit.saved'));
            onSaved();
          },
        });
      }}
    >
      <div className="profile-edit-avatar">
        <span className="profile-edit-avatar-frame" data-state={imageState}>
          <Avatar className="size-16" aria-hidden="true">
            <AvatarImage
              src={form.avatar.previewUrl ?? user.avatarUrl ?? undefined}
              alt=""
              className="object-cover"
            />
            <AvatarFallback className="bg-gray-100 text-gray-600">
              <UserRound className="size-7" />
            </AvatarFallback>
          </Avatar>
          <span className="profile-edit-avatar-badge" aria-hidden="true">
            <Pencil />
          </span>
        </span>
        <div className="profile-edit-avatar-copy">
          <p className="profile-edit-label">{t('edit.imageLabel')}</p>
          <p
            id={imageHintId}
            className="profile-edit-hint"
            data-state={imageState}
            aria-live="polite"
          >
            {form.avatar.error
              ? t(`edit.imageErrors.${form.avatar.error}`)
              : form.avatar.previewUrl
                ? t('edit.imageSelected')
                : t('edit.imageHint')}
          </p>
          {/* 파일 선택 창은 사진 변경 버튼으로 연다. 같은 파일을 다시 골라도 검사하도록 값을 비운다. */}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={event => {
              form.selectAvatar(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            aria-describedby={imageHintId}
            disabled={mutation.isPending}
            onClick={() => fileInput.current?.click()}
          >
            {t('edit.changeImage')}
          </Button>
        </div>
      </div>
      <Field
        label={t('edit.nickname')}
        hint={t('edit.nicknameHint')}
        error={
          form.tooLong
            ? t('edit.nicknameTooLong')
            : errorKey === 'invalid'
              ? t('edit.errors.invalid')
              : undefined
        }
      >
        {props => (
          <div className="profile-edit-nickname">
            <Input
              {...props}
              name="nickname"
              autoComplete="nickname"
              value={form.nickname}
              disabled={mutation.isPending}
              onChange={event => {
                form.setNickname(event.target.value);
                // 입력을 고치면 이전 저장 실패 안내를 지운다.
                if (mutation.isError) mutation.reset();
              }}
            />
            <span className="profile-edit-count" aria-hidden="true">
              {form.length}/{NICKNAME_MAX_LENGTH}
            </span>
          </div>
        )}
      </Field>
      {errorKey && errorKey !== 'invalid' && (
        <p className="profile-edit-error" role="alert">
          {t(`edit.errors.${errorKey}`)}
        </p>
      )}
      <div className="profile-edit-actions">
        <Button type="submit" loading={mutation.isPending} disabled={!form.canSave}>
          {t(mutation.isPending ? 'edit.saving' : 'edit.save')}
        </Button>
        <DialogClose asChild>
          <Button variant="secondary" disabled={mutation.isPending}>
            {t('edit.cancel')}
          </Button>
        </DialogClose>
      </div>
    </form>
  );
}
