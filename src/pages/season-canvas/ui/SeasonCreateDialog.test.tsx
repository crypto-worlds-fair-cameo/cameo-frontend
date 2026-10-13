import { useRef, useState, type ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SeasonFormDraft } from '../lib/seasonForm';
import { SeasonCreateDialog } from './SeasonCreateDialog';

type DialogProps = ComponentProps<typeof SeasonCreateDialog>;

const initialDraft: SeasonFormDraft = {
  title: 'Weekend canvas',
  description: '',
  width: '1000',
  height: '1000',
  unlimitedCapacity: false,
  capacity: '20',
  unlimitedStrokes: false,
  strokeLimitPerUser: '3',
  entryRule: 'anyone',
  paidEntry: false,
  entryFee: '',
  scheduled: true,
  startsAt: '2026-10-12T10:30',
  endsAt: '2026-10-12T13:45',
};

function FormHarness({
  draft: draftOverride,
  errors = {},
  isPending = false,
  ambiguous = false,
  onSubmit = vi.fn(),
  onOpenChange = vi.fn(),
  onCheckList = vi.fn(),
}: Partial<Pick<DialogProps, 'draft' | 'errors' | 'isPending' | 'ambiguous' | 'onCheckList'>> & {
  onSubmit?: (draft: SeasonFormDraft) => void;
  onOpenChange?: DialogProps['onOpenChange'];
}) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState(draftOverride ?? initialDraft);
  const [retryAcknowledged, setRetryAcknowledged] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const fallbackRef = useRef<HTMLHeadingElement>(null);
  const restoreFocusRef = useRef(true);
  return (
    <>
      <h1 ref={fallbackRef} tabIndex={-1}>
        Seasons
      </h1>
      <button ref={openerRef} onClick={() => setOpen(true)}>
        Open create form
      </button>
      <SeasonCreateDialog
        open={open}
        draft={draft}
        errors={errors}
        serverError={null}
        traceId={null}
        ambiguous={ambiguous}
        retryAcknowledged={retryAcknowledged}
        isPending={isPending}
        onOpenChange={next => {
          onOpenChange(next);
          setOpen(next);
        }}
        onUpdate={(key, value) => setDraft(current => ({ ...current, [key]: value }))}
        onSubmit={() => onSubmit(draft)}
        onCheckList={onCheckList}
        onRetryAcknowledged={setRetryAcknowledged}
        restoreFocusTo={openerRef}
        fallbackFocusTo={fallbackRef}
        restoreFocusOnClose={restoreFocusRef}
      />
    </>
  );
}

function dateInput(label: '시작' | '종료') {
  return screen.getByLabelText(new RegExp(`^${label}\\s*\\*?$`)) as HTMLInputElement;
}

function dateText(label: '시작' | '종료') {
  return dateInput(label).parentElement?.querySelector('.season-form__date-value')?.textContent;
}

function timeInput(label: '시작' | '종료') {
  return screen.getByRole('button', { name: `${label} 시간` }) as HTMLButtonElement;
}

function displayTime(value: string) {
  const [rawHour = '0', minute = '00'] = value.split(':');
  const hour24 = Number(rawHour);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour24 % 12 || 12}:${minute} ${period}`;
}

async function pickTime(
  user: ReturnType<typeof userEvent.setup>,
  label: '시작' | '종료',
  time: string
) {
  const trigger = timeInput(label);
  if (trigger.getAttribute('aria-expanded') !== 'true') await user.click(trigger);
  const root = trigger.parentElement;
  if (!root) throw new Error('Time field is missing.');
  const [rawHour = '0', minute = '00'] = time.split(':');
  const hour24 = Number(rawHour);
  const hour = String(hour24 % 12 || 12);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const exact = (value: string) => (name: string) => name === value;
  const periodButton = within(root).getByRole('button', { name: exact(period) });
  if (periodButton.getAttribute('aria-pressed') !== 'true') await user.click(periodButton);
  await user.click(within(root).getByRole('button', { name: exact(hour) }));
  await user.click(within(root).getByRole('button', { name: exact(minute) }));
}

describe('season create form interactions', () => {
  it('stops title and description at the server limit without showing a counter', () => {
    render(<FormHarness />);
    const title = screen.getByRole('textbox', { name: /시즌 제목/ });
    const description = screen.getByLabelText('설명');
    expect(screen.queryByText(/^\d+\/(50|1000)$/)).toBeNull();

    fireEvent.change(title, { target: { value: 'ㅌ'.repeat(51) } });
    expect((title as HTMLInputElement).value).toBe('ㅌ'.repeat(50));
    fireEvent.change(description, { target: { value: 'ㅌ'.repeat(1001) } });
    expect((description as HTMLTextAreaElement).value).toBe('ㅌ'.repeat(1000));
    expect(screen.queryByText(/^\d+\/(50|1000)$/)).toBeNull();
  });

  it('merges separate date and time edits into the complete local datetimes submitted', async () => {
    const onSubmit = vi.fn();
    render(<FormHarness onSubmit={onSubmit} />);

    expect(timeInput('시작').textContent).toBe('10:30 AM');
    expect(timeInput('종료').textContent).toBe('1:45 PM');
    expect(dateText('시작')).toBe('2026.10.12');
    fireEvent.change(dateInput('시작'), { target: { value: '2026-10-13' } });
    expect(dateText('시작')).toBe('2026.10.13');
    expect(timeInput('시작').textContent).toBe('10:30 AM');
    const user = userEvent.setup();
    await user.click(timeInput('시작'));
    const menuText = timeInput('시작').parentElement?.textContent ?? '';
    expect(menuText).toMatch(/AM/);
    expect(menuText).toMatch(/PM/);
    expect(menuText).not.toMatch(/오전|오후/);
    await pickTime(user, '시작', '11:15');
    expect(timeInput('시작').textContent).toBe('11:15 AM');
    expect(dateInput('시작').value).toBe('2026-10-13');
    await pickTime(user, '종료', '15:20');
    expect(dateInput('종료').value).toBe('2026-10-12');
    fireEvent.change(dateInput('종료'), { target: { value: '2026-10-14' } });
    expect(timeInput('종료').textContent).toBe('3:20 PM');
    fireEvent.click(screen.getByRole('button', { name: '개설하기' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        startsAt: '2026-10-13T11:15',
        endsAt: '2026-10-14T15:20',
        scheduled: true,
      })
    );
  });

  it.each([
    ['2026-10-12T09:00', '12:30'],
    ['2026-10-12T10:30', '12:30'],
    ['2026-10-12T13:45', '13:45'],
  ])(
    'enables scheduled start and safely keeps or corrects end %s',
    async (endsAt, expectedTime) => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(
        <FormHarness draft={{ ...initialDraft, scheduled: false, endsAt }} onSubmit={onSubmit} />
      );
      expect(dateInput('시작').matches(':disabled')).toBe(true);
      expect(timeInput('시작').matches(':disabled')).toBe(true);

      await user.click(screen.getByRole('checkbox', { name: '즉시 시작' }));
      expect(dateInput('시작').matches(':disabled')).toBe(false);
      expect(timeInput('시작').matches(':disabled')).toBe(false);
      expect(dateInput('시작').value).toBe('2026-10-12');
      expect(timeInput('시작').textContent).toBe('10:30 AM');
      expect(timeInput('종료').textContent).toBe(displayTime(expectedTime));
      await user.click(screen.getByRole('button', { name: '개설하기' }));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduled: true,
          startsAt: '2026-10-12T10:30',
          endsAt: `2026-10-12T${expectedTime}`,
        })
      );
    }
  );

  it('disables the stroke range for unlimited mode while preserving the selected limit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<FormHarness onSubmit={onSubmit} />);
    const range = screen.getByRole('slider', { name: /1인당 획 제한/ }) as HTMLInputElement;
    const unlimited = screen
      .getAllByRole('checkbox', { name: '무제한' })
      .find(input => !input.matches(':disabled'))!;
    fireEvent.change(range, { target: { value: '7' } });
    await user.click(unlimited);
    expect(range.matches(':disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: '개설하기' }));
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ unlimitedStrokes: true, strokeLimitPerUser: '7' })
    );

    await user.click(unlimited);
    expect(range.matches(':disabled')).toBe(false);
    expect(range.value).toBe('7');
    await user.click(screen.getByRole('button', { name: '개설하기' }));
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ unlimitedStrokes: false, strokeLimitPerUser: '7' })
    );
  });

  it('connects validation errors to both datetime inputs, the range and expanded dimensions', () => {
    render(
      <FormHarness
        errors={{
          title: 'titleLength',
          startsAt: 'invalidDateTime',
          strokeLimitPerUser: 'integerRange',
          width: 'integerRange',
        }}
      />
    );
    const title = screen.getByRole('textbox', { name: /시즌 제목/ });
    const range = screen.getByRole('slider', { name: /1인당 획 제한/ });
    const width = screen.getByRole('spinbutton', { name: /가로 크기/ });
    for (const input of [title, range, width, dateInput('시작'), timeInput('시작')]) {
      expect(input.getAttribute('aria-invalid')).toBe('true');
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const describedText = describedBy!
        .split(/\s+/)
        .map(id => document.getElementById(id)?.textContent ?? '');
      expect(describedText.some(text => text.length > 0)).toBe(true);
    }
    expect(dateInput('시작').getAttribute('aria-describedby')).toBe(
      timeInput('시작').getAttribute('aria-describedby')
    );
    expect(width.closest('details')?.open).toBe(true);
  });

  it('clears None when the SOL fee field is pressed', async () => {
    const user = userEvent.setup();
    render(<FormHarness />);
    const none = screen.getByRole('checkbox', { name: '없음' }) as HTMLInputElement;
    const fee = screen.getByRole('textbox', { name: 'SOL 입장료' }) as HTMLInputElement;
    expect(none.checked).toBe(true);
    expect(fee.value).toBe('0');
    await user.click(fee);
    expect(none.checked).toBe(false);
    expect(fee.value).toBe('');
    await user.type(fee, '0.1');
    expect(fee.value).toBe('0.1');
  });

  it('locks fields, submission and dismissal while a create request is pending', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    render(<FormHarness isPending onSubmit={onSubmit} onOpenChange={onOpenChange} />);
    const title = screen.getByRole('textbox', { name: /시즌 제목/ }) as HTMLInputElement;
    const cancel = screen.getByRole('button', { name: '취소' });
    const submit = screen.getByRole('button', { name: '개설 중' });
    const immediate = screen.getByRole('checkbox', { name: '즉시 시작' });
    for (const control of [title, cancel, submit, immediate, dateInput('종료')]) {
      expect(control.matches(':disabled')).toBe(true);
    }
    await user.type(title, ' change');
    await user.click(immediate);
    await user.click(submit);
    await user.click(cancel);
    await user.keyboard('{Escape}');
    const overlay = document.querySelector('[data-slot="dialog-overlay"]')!;
    await user.click(overlay);
    expect(title.value).toBe(initialDraft.title);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('cancels without submitting and returns focus to the opener', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    render(<FormHarness onSubmit={onSubmit} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open create form' }))
    );
  });

  it('steps the clock from the keyboard and leaves the form open on Escape', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<FormHarness onOpenChange={onOpenChange} />);
    await user.click(timeInput('시작'));
    const dial = timeInput('시작').parentElement;
    if (!dial) throw new Error('Time field is missing.');
    const exact = (value: string) => (name: string) => name === value;
    within(dial)
      .getByRole('button', { name: exact('10') })
      .focus();
    await user.keyboard('{ArrowUp}');
    expect(timeInput('시작').textContent).toBe('11:30 AM');
    await user.click(within(dial).getByRole('button', { name: exact('11') }));
    within(dial)
      .getByRole('button', { name: exact('30') })
      .focus();
    await user.keyboard('{ArrowUp}');
    expect(timeInput('시작').textContent).toBe('11:31 AM');
    await user.keyboard('{Escape}');
    expect(dial.querySelector('.season-form__time-dial')).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(timeInput('시작').textContent).toBe('11:31 AM');
  });

  it('requires acknowledging duplicate risk before submitting an ambiguous retry', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<FormHarness ambiguous onSubmit={onSubmit} />);
    const submit = screen.getByRole('button', { name: '개설하기' });
    expect(submit.matches(':disabled')).toBe(true);
    await user.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('checkbox', { name: '중복 시즌이 생길 수 있음을 확인했습니다.' })
    );
    expect(submit.matches(':disabled')).toBe(false);
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
