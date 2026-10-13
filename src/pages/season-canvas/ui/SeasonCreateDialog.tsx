import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
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
import { SeasonTimeDial } from './SeasonTimeDial';
import type { SeasonErrorKey } from '../lib/seasonErrors';
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  limitText,
  parseUtcDateTimeInput,
  toUtcDateTimeInput,
  type SeasonFormDraft,
  type SeasonFormErrorKey,
  type SeasonFormErrors,
} from '../lib/seasonForm';
import './season-dialog.css';

const formErrorKeys: Record<SeasonFormErrorKey, `form.errors.${SeasonFormErrorKey}`> = {
  requiredNumber: 'form.errors.requiredNumber',
  integerRange: 'form.errors.integerRange',
  entryFeeRange: 'form.errors.entryFeeRange',
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
  // 시즌 시각은 보는 사람의 시간대와 상관없이 항상 UTC로 입력·표시한다.
  const timezone = 'UTC';
  const immediateStart = useMemo(
    () => (props.open ? toUtcDateTimeInput(new Date()) : ''),
    [props.open]
  );
  const errorText = (field: keyof SeasonFormDraft): string | undefined => {
    const error = props.errors[field];
    return error ? t(formErrorKeys[error]) : undefined;
  };
  const selectMode = (scheduled: boolean) => {
    props.onUpdate('scheduled', scheduled);
    if (!scheduled) return;
    const startsAt = parseUtcDateTimeInput(props.draft.startsAt);
    const endsAt = parseUtcDateTimeInput(props.draft.endsAt);
    // 예약 전환 시 종료가 시작보다 늦지 않을 때만 2시간 뒤로 조정한다.
    if (startsAt && (!endsAt || endsAt <= startsAt)) {
      props.onUpdate(
        'endsAt',
        toUtcDateTimeInput(new Date(startsAt.getTime() + 2 * 60 * 60 * 1000))
      );
    }
  };
  return (
    <Dialog open={props.open} onOpenChange={open => !props.isPending && props.onOpenChange(open)}>
      <DialogContent
        className="season-dialog season-create-dialog"
        showCloseButton={false}
        onEscapeKeyDown={event => {
          // 다이얼이 열려 있으면 개설 창보다 먼저 다이얼만 닫는다.
          if (props.isPending || document.querySelector('.season-form__time-dial')) {
            event.preventDefault();
          }
        }}
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
                  maxLength={TITLE_MAX_LENGTH}
                  value={props.draft.title}
                  onChange={event =>
                    props.onUpdate('title', limitText(event.target.value, TITLE_MAX_LENGTH))
                  }
                />
              )}
            </Field>
            <Field label={t('form.descriptionLabel')} error={errorText('description')}>
              {field => (
                <FieldTextarea
                  {...field}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  value={props.draft.description}
                  onChange={value =>
                    props.onUpdate('description', limitText(value, DESCRIPTION_MAX_LENGTH))
                  }
                />
              )}
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
                    <Checkbox
                      checked={props.draft.unlimitedCapacity}
                      label={t('form.unlimited')}
                      onChange={event => props.onUpdate('unlimitedCapacity', event.target.checked)}
                    />
                    <Input
                      {...field}
                      type="number"
                      min="2"
                      max="100"
                      step="1"
                      title="2–100"
                      disabled={props.draft.unlimitedCapacity}
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
                <Checkbox
                  checked={props.draft.entryRule === 'anyone'}
                  label={t('form.anyone')}
                  onChange={() => props.onUpdate('entryRule', 'anyone')}
                />
                <Checkbox
                  checked={props.draft.entryRule === 'wallet_holders'}
                  label={t('form.walletOnly')}
                  onChange={() => props.onUpdate('entryRule', 'wallet_holders')}
                />
              </div>
              <div className="season-form__option-row season-form__fee">
                <Checkbox
                  checked={!props.draft.paidEntry}
                  label={t('form.noFee')}
                  onChange={event => props.onUpdate('paidEntry', !event.target.checked)}
                />
                <Input
                  aria-label={t('form.entryFee')}
                  aria-invalid={props.errors.entryFee ? true : undefined}
                  aria-describedby={props.errors.entryFee ? 'season-fee-error' : undefined}
                  inputMode="decimal"
                  placeholder="0.001–100"
                  data-inactive={!props.draft.paidEntry || undefined}
                  value={props.draft.paidEntry ? props.draft.entryFee : '0'}
                  onPointerDown={() => {
                    if (!props.draft.paidEntry) props.onUpdate('paidEntry', true);
                  }}
                  onFocus={() => {
                    if (!props.draft.paidEntry) props.onUpdate('paidEntry', true);
                  }}
                  onChange={event => props.onUpdate('entryFee', event.target.value)}
                />
                <span>SOL</span>
              </div>
              {errorText('entryFee') && (
                <p id="season-fee-error" className="cameo-field-error">
                  {errorText('entryFee')}
                </p>
              )}
              {props.draft.paidEntry && (
                <p className="season-form__fee-note">{t('form.feeNote')}</p>
              )}
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
  maxLength,
  ...props
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  maxLength?: number;
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
      maxLength={maxLength}
      onChange={event => onChange(event.target.value)}
    />
  );
}

const DIAL_CLEARANCE = 288;

function padTime(value: number) {
  return String(value).padStart(2, '0');
}

function readClock(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour24 = match ? Number(match[1]) : 0;
  const minute = match ? Number(match[2]) : 0;
  const hour = hour24 >= 0 && hour24 <= 23 ? hour24 : 0;
  const safeMinute = minute >= 0 && minute <= 59 ? minute : 0;
  const period = hour >= 12 ? 'PM' : 'AM';
  return {
    hour,
    minute: safeMinute,
    label: `${hour % 12 || 12}:${padTime(safeMinute)} ${period}`,
  };
}

/** 시간 선택은 12시간 시계 다이얼과 AM/PM으로 고른다. */
function SeasonTimeField({
  value,
  label,
  onChange,
  ...props
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');
  const rootRef = useRef<HTMLDivElement>(null);
  const clock = readClock(value);
  if (props.disabled && open) setOpen(false);
  const shown = open && !props.disabled;

  useEffect(() => {
    if (!shown) return;
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      rootRef.current
        ?.querySelector<HTMLButtonElement>('.season-form__time-trigger')
        ?.focus({ preventScroll: true });
    }
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [shown]);

  useLayoutEffect(() => {
    if (!shown || !rootRef.current) return;
    const root = rootRef.current;
    const dialog = root.closest('.season-dialog');
    let adjusted = false;

    const spaceAround = () => {
      const field = root.getBoundingClientRect();
      const bounds = dialog?.getBoundingClientRect();
      return {
        above: bounds ? field.top - bounds.top : field.top,
        below: bounds ? bounds.bottom - field.bottom : window.innerHeight - field.bottom,
        bounds,
      };
    };

    const place = () => {
      const { above, below, bounds } = spaceAround();
      if (
        !adjusted &&
        dialog &&
        bounds &&
        bounds.height > 0 &&
        Math.max(above, below) < DIAL_CLEARANCE
      ) {
        adjusted = true;
        root.scrollIntoView({ block: above >= below ? 'end' : 'start', inline: 'nearest' });
      }
      const next = spaceAround();
      const fitsTop = next.above >= DIAL_CLEARANCE;
      const fitsBottom = next.below >= DIAL_CLEARANCE;
      if (fitsTop && !fitsBottom) setPlacement('top');
      else if (fitsBottom && !fitsTop) setPlacement('bottom');
      else setPlacement(next.above >= next.below ? 'top' : 'bottom');
    };

    place();
    window.addEventListener('resize', place);
    dialog?.addEventListener('scroll', place);
    return () => {
      window.removeEventListener('resize', place);
      dialog?.removeEventListener('scroll', place);
    };
  }, [shown]);

  function commit(nextHour: number, nextMinute: number, close: boolean) {
    onChange(`${padTime(nextHour)}:${padTime(nextMinute)}`);
    if (close) setOpen(false);
  }

  return (
    <div className="season-form__time-input" ref={rootRef}>
      <button
        {...props}
        type="button"
        className="cameo-input season-form__time-trigger"
        aria-haspopup="dialog"
        aria-expanded={shown}
        aria-label={label}
        onClick={() => {
          if (!props.disabled) setOpen(current => !current);
        }}
      >
        {clock.label}
      </button>
      <img src="/images/season-time-chevron.svg" alt="" />
      {shown && (
        <SeasonTimeDial
          label={label}
          hour={clock.hour}
          minute={clock.minute}
          placement={placement}
          onCommit={commit}
        />
      )}
    </div>
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
        <span className="season-form__date-value" aria-hidden="true">
          {date.replace(/-/g, '.')}
        </span>
        <img src="/images/season-calendar.svg" alt="" />
      </div>
      <SeasonTimeField
        {...props}
        id={props.id ? `${props.id}-time` : undefined}
        label={`${label} ${timeLabel}`}
        value={time.slice(0, 5)}
        onChange={next => onChange(`${date}T${next}`)}
      />
    </div>
  );
}
