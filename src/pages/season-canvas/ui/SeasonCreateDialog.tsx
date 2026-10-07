import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { DateTimePicker } from '@/shared/ui/date-time-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import type { SeasonErrorKey } from '../lib/seasonErrors';
import {
  toLocalDateTimeInput,
  type SeasonFormDraft,
  type SeasonFormErrorKey,
  type SeasonFormErrors,
} from '../lib/seasonForm';

const formErrorKeys: Record<SeasonFormErrorKey, `form.errors.${SeasonFormErrorKey}`> = {
  requiredNumber: 'form.errors.requiredNumber',
  integerRange: 'form.errors.integerRange',
  titleLength: 'form.errors.titleLength',
  descriptionLength: 'form.errors.descriptionLength',
  invalidDateTime: 'form.errors.invalidDateTime',
  scheduledStartRange: 'form.errors.scheduledStartRange',
  durationRange: 'form.errors.durationRange',
  immediateDurationRange: 'form.errors.immediateDurationRange',
};

interface SeasonCreateDialogProps {
  open: boolean;
  draft: SeasonFormDraft;
  errors: SeasonFormErrors;
  serverError: SeasonErrorKey | null;
  traceId: string | null;
  ambiguous: boolean;
  retryAcknowledged: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: <K extends keyof SeasonFormDraft>(key: K, value: SeasonFormDraft[K]) => void;
  onSubmit: () => void;
  onCheckList: () => void;
  onRetryAcknowledged: (value: boolean) => void;
  restoreFocusTo: RefObject<HTMLElement | null>;
  fallbackFocusTo: RefObject<HTMLElement | null>;
  restoreFocusOnClose: RefObject<boolean>;
}

export function SeasonCreateDialog(props: SeasonCreateDialogProps) {
  const { t } = useTranslation('seasonCanvas');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const errorText = (field: keyof SeasonFormDraft): string | undefined => {
    const error = props.errors[field];
    return error ? t(formErrorKeys[error]) : undefined;
  };
  const selectMode = (scheduled: boolean) => {
    props.onUpdate('scheduled', scheduled);
    if (!scheduled) return;
    const startsAt = new Date(props.draft.startsAt);
    const endsAt = new Date(props.draft.endsAt);
    // 예약 전환 시 종료가 시작보다 늦지 않을 때만 2시간 뒤로 조정한다.
    if (
      Number.isFinite(startsAt.getTime()) &&
      (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt)
    ) {
      props.onUpdate(
        'endsAt',
        toLocalDateTimeInput(new Date(startsAt.getTime() + 2 * 60 * 60 * 1000))
      );
    }
  };
  return (
    <Dialog open={props.open} onOpenChange={open => !props.isPending && props.onOpenChange(open)}>
      <DialogContent
        className="season-dialog season-create-dialog"
        showCloseButton={!props.isPending}
        onEscapeKeyDown={event => props.isPending && event.preventDefault()}
        onPointerDownOutside={event => props.isPending && event.preventDefault()}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (props.restoreFocusOnClose.current) {
            restoreFocus(props.restoreFocusTo.current, props.fallbackFocusTo.current);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('form.title')}</DialogTitle>
          <DialogDescription>{t('form.description')}</DialogDescription>
        </DialogHeader>
        <form
          className="season-form"
          noValidate
          onSubmit={event => {
            event.preventDefault();
            void props.onSubmit();
          }}
        >
          <fieldset className="season-form__controls" disabled={props.isPending}>
            <Field label={t('form.titleLabel')} required error={errorText('title')}>
              {field => (
                <Input
                  {...field}
                  value={props.draft.title}
                  maxLength={100}
                  placeholder={t('form.titlePlaceholder')}
                  onChange={event => props.onUpdate('title', event.target.value)}
                />
              )}
            </Field>
            <Field label={t('form.descriptionLabel')} error={errorText('description')}>
              {field => (
                <FieldTextarea
                  {...field}
                  value={props.draft.description}
                  placeholder={t('form.descriptionPlaceholder')}
                  onChange={value => props.onUpdate('description', value)}
                />
              )}
            </Field>
            <div className="season-form__grid">
              <Field label={t('form.capacity')} required hint="2–100" error={errorText('capacity')}>
                {field => (
                  <Input
                    {...field}
                    type="number"
                    min="2"
                    max="100"
                    step="1"
                    value={props.draft.capacity}
                    onChange={event => props.onUpdate('capacity', event.target.value)}
                  />
                )}
              </Field>
              <Field
                label={t('form.strokeLimit')}
                required
                hint="1–10"
                error={errorText('strokeLimitPerUser')}
              >
                {field => (
                  <Input
                    {...field}
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    disabled={props.draft.unlimitedStrokes}
                    value={props.draft.strokeLimitPerUser}
                    onChange={event => props.onUpdate('strokeLimitPerUser', event.target.value)}
                  />
                )}
              </Field>
              <Field
                label={t('form.width')}
                required
                hint="500–10000 px"
                error={errorText('width')}
              >
                {field => (
                  <Input
                    {...field}
                    type="number"
                    min="500"
                    max="10000"
                    step="1"
                    value={props.draft.width}
                    onChange={event => props.onUpdate('width', event.target.value)}
                  />
                )}
              </Field>
              <Field
                label={t('form.height')}
                required
                hint="500–10000 px"
                error={errorText('height')}
              >
                {field => (
                  <Input
                    {...field}
                    type="number"
                    min="500"
                    max="10000"
                    step="1"
                    value={props.draft.height}
                    onChange={event => props.onUpdate('height', event.target.value)}
                  />
                )}
              </Field>
            </div>
            <Checkbox
              checked={props.draft.unlimitedStrokes}
              label={t('form.unlimited')}
              onChange={event => props.onUpdate('unlimitedStrokes', event.target.checked)}
            />
            <fieldset className="season-mode">
              <legend>{t('form.startMode')}</legend>
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant={!props.draft.scheduled ? 'primary' : 'secondary'}
                  aria-pressed={!props.draft.scheduled}
                  onClick={() => selectMode(false)}
                >
                  {t('form.immediate')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={props.draft.scheduled ? 'primary' : 'secondary'}
                  aria-pressed={props.draft.scheduled}
                  onClick={() => selectMode(true)}
                >
                  {t('form.scheduled')}
                </Button>
              </div>
            </fieldset>
            {props.draft.scheduled && (
              <Field
                label={t('form.startsAt')}
                required
                error={errorText('startsAt')}
                hint={t('form.timezone', { timezone })}
              >
                {field => (
                  <DateTimePicker
                    {...field}
                    value={props.draft.startsAt}
                    onChange={event => props.onUpdate('startsAt', event.target.value)}
                  />
                )}
              </Field>
            )}
            <Field
              label={t('form.endsAt')}
              required
              error={errorText('endsAt')}
              hint={!props.draft.scheduled ? t('form.timezone', { timezone }) : undefined}
            >
              {field => (
                <DateTimePicker
                  {...field}
                  value={props.draft.endsAt}
                  onChange={event => props.onUpdate('endsAt', event.target.value)}
                />
              )}
            </Field>
            {props.serverError && (
              <div className="season-form__error" role="alert">
                <p>{t('form.serverError', { message: t(`errors.${props.serverError}`) })}</p>
                {props.traceId && <small>{t('form.traceId', { traceId: props.traceId })}</small>}
              </div>
            )}
            {props.ambiguous && (
              <div className="season-form__ambiguous" role="alert">
                <p>{t('form.ambiguous')}</p>
                <Checkbox
                  checked={props.retryAcknowledged}
                  label={t('form.retryAck')}
                  onChange={event => props.onRetryAcknowledged(event.target.checked)}
                />
                <Button type="button" variant="secondary" size="sm" onClick={props.onCheckList}>
                  {t('form.checkList')}
                </Button>
              </div>
            )}
          </fieldset>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={props.isPending}
              onClick={() => props.onOpenChange(false)}
            >
              {t('form.cancel')}
            </Button>
            <Button
              type="submit"
              loading={props.isPending}
              disabled={props.ambiguous && !props.retryAcknowledged}
            >
              {props.isPending ? t('form.submitting') : t('form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** 닫힌 modal의 실제 opener가 사라졌으면 페이지 제목으로 안전하게 이동한다. */
function restoreFocus(target: HTMLElement | null, fallback: HTMLElement | null) {
  queueMicrotask(() => {
    const available = (element: HTMLElement | null) =>
      element?.isConnected && !element.matches(':disabled, [aria-disabled="true"]');
    if (available(target)) target!.focus();
    else if (available(fallback)) fallback!.focus();
  });
}

function FieldTextarea({
  value,
  placeholder,
  onChange,
  ...props
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}) {
  return (
    <textarea
      {...props}
      className="season-textarea"
      value={value}
      placeholder={placeholder}
      maxLength={200}
      onChange={event => onChange(event.target.value)}
    />
  );
}
