import { useMemo, type RefObject } from 'react';
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
import { Slider } from '@/shared/ui/slider';
import { restoreDialogFocus } from './restoreDialogFocus';
import type { SeasonErrorKey } from '../lib/seasonErrors';
import {
  DESCRIPTION_MAX_LENGTH,
  descriptionLength,
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
  const immediateStart = useMemo(
    () => (props.open ? toLocalDateTimeInput(new Date()) : ''),
    [props.open]
  );
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
        showCloseButton={false}
        onEscapeKeyDown={event => props.isPending && event.preventDefault()}
        onPointerDownOutside={event => props.isPending && event.preventDefault()}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (props.restoreFocusOnClose.current) {
            restoreDialogFocus(props.restoreFocusTo.current, props.fallbackFocusTo.current);
          }
        }}
      >
        <DialogHeader className="season-create__heading">
          <DialogTitle>{t('form.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('form.description')}</DialogDescription>
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
                  onChange={event => props.onUpdate('title', event.target.value)}
                />
              )}
            </Field>
            <Field label={t('form.descriptionLabel')} error={errorText('description')}>
              {field => {
                // 오류를 보기 전에 한도를 알 수 있도록 서버 기준 글자 수를 입력칸 아래에 표시한다.
                const count = descriptionLength(props.draft.description);
                const countId = `${field.id}-count`;
                return (
                  <>
                    <FieldTextarea
                      {...field}
                      aria-describedby={[countId, field['aria-describedby']]
                        .filter(Boolean)
                        .join(' ')}
                      value={props.draft.description}
                      onChange={value => props.onUpdate('description', value)}
                    />
                    <p
                      id={countId}
                      className="season-form__counter"
                      data-over={count > DESCRIPTION_MAX_LENGTH || undefined}
                    >
                      {t('form.descriptionCount', { count, max: DESCRIPTION_MAX_LENGTH })}
                    </p>
                  </>
                );
              }}
            </Field>
            <section className="season-form__strokes">
              <Slider
                label={t('form.strokeLimit')}
                min={1}
                max={10}
                step={1}
                value={Number(props.draft.strokeLimitPerUser)}
                unit="/10"
                disabled={props.draft.unlimitedStrokes}
                aria-invalid={props.errors.strokeLimitPerUser ? true : undefined}
                aria-describedby={
                  props.errors.strokeLimitPerUser ? 'season-strokes-error' : undefined
                }
                onValueChange={value => props.onUpdate('strokeLimitPerUser', String(value))}
              />
              <Checkbox
                checked={props.draft.unlimitedStrokes}
                label={t('form.unlimited')}
                onChange={event => props.onUpdate('unlimitedStrokes', event.target.checked)}
              />
              {errorText('strokeLimitPerUser') && (
                <p id="season-strokes-error" className="cameo-field-error">
                  {errorText('strokeLimitPerUser')}
                </p>
              )}
            </section>
            <section className="season-form__capacity">
              <Field label={t('form.capacity')} required error={errorText('capacity')}>
                {field => (
                  <div className="season-form__option-row">
                    <Checkbox checked={false} disabled label={t('form.unlimited')} />
                    <Input
                      {...field}
                      type="number"
                      min="2"
                      max="100"
                      step="1"
                      title="2–100"
                      value={props.draft.capacity}
                      onChange={event => props.onUpdate('capacity', event.target.value)}
                    />
                    <span>{t('form.limit')}</span>
                  </div>
                )}
              </Field>
            </section>
            <fieldset className="season-form__entry">
              <legend>{t('form.entryRules')}</legend>
              <div className="season-form__option-row">
                <Checkbox checked disabled label={t('form.anyone')} />
                <Checkbox checked={false} disabled label={t('form.walletOnly')} />
              </div>
              <div className="season-form__option-row season-form__fee">
                <Checkbox checked disabled label={t('form.noFee')} />
                <Input aria-label={t('form.entryFee')} value="0" disabled />
                <span>SOL</span>
              </div>
            </fieldset>
            <details
              className="season-form__dimensions"
              open={props.errors.width || props.errors.height ? true : undefined}
            >
              <summary>
                {t('form.canvasSize')} · {props.draft.width} × {props.draft.height} px
              </summary>
              <div className="season-form__grid">
                {(['width', 'height'] as const).map(dimension => (
                  <Field
                    key={dimension}
                    label={t(`form.${dimension}`)}
                    required
                    hint="500–10000 px"
                    error={errorText(dimension)}
                  >
                    {field => (
                      <Input
                        {...field}
                        type="number"
                        min="500"
                        max="10000"
                        step="1"
                        value={props.draft[dimension]}
                        onChange={event => props.onUpdate(dimension, event.target.value)}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </details>
            <section className="season-form__duration">
              <div className="season-form__duration-heading">
                <h2>{t('form.duration')}</h2>
                <Checkbox
                  checked={!props.draft.scheduled}
                  label={t('form.immediate')}
                  onChange={event => selectMode(!event.target.checked)}
                />
              </div>
              <div className="season-form__dates">
                <Field label={t('form.startsAt')} required error={errorText('startsAt')}>
                  {field => (
                    <SeasonDateTimeInputs
                      {...field}
                      label={t('form.startsAt')}
                      timeLabel={t('form.time')}
                      value={props.draft.scheduled ? props.draft.startsAt : immediateStart}
                      disabled={!props.draft.scheduled}
                      onChange={value => props.onUpdate('startsAt', value)}
                    />
                  )}
                </Field>
                <span className="season-form__date-separator" aria-hidden="true">
                  ~
                </span>
                <Field label={t('form.endsAt')} required error={errorText('endsAt')}>
                  {field => (
                    <SeasonDateTimeInputs
                      {...field}
                      label={t('form.endsAt')}
                      timeLabel={t('form.time')}
                      value={props.draft.endsAt}
                      onChange={value => props.onUpdate('endsAt', value)}
                    />
                  )}
                </Field>
              </div>
              <p className="season-form__duration-note" title={t('form.timezone', { timezone })}>
                {t('form.durationNote')}
              </p>
            </section>
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
          <DialogFooter className="season-create__actions">
            <Button
              type="submit"
              loading={props.isPending}
              disabled={props.ambiguous && !props.retryAcknowledged}
            >
              {props.isPending ? t('form.submitting') : t('form.submit')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={props.isPending}
              onClick={() => props.onOpenChange(false)}
            >
              {t('form.cancel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldTextarea({
  value,
  placeholder,
  onChange,
  ...props
}: {
  value: string;
  placeholder?: string;
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

/** 날짜와 시간을 나눠 표시하되 기존 로컬 datetime 값과 검증을 유지한다. */
function SeasonDateTimeInputs({
  value,
  label,
  timeLabel,
  onChange,
  ...props
}: {
  value: string;
  label: string;
  timeLabel: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}) {
  const [date = '', time = ''] = value.split('T');
  return (
    <div className="season-form__date-inputs">
      <div className="season-form__date-input">
        <DateTimePicker
          {...props}
          type="date"
          value={date}
          onChange={event => onChange(`${event.target.value}T${time}`)}
        />
        <img src="/images/season-calendar.svg" alt="" />
      </div>
      <div className="season-form__time-input">
        <DateTimePicker
          {...props}
          id={props.id ? `${props.id}-time` : undefined}
          aria-label={`${label} ${timeLabel}`}
          type="time"
          value={time}
          onChange={event => onChange(`${date}T${event.target.value}`)}
        />
        <img src="/images/season-time-chevron.svg" alt="" />
      </div>
    </div>
  );
}
