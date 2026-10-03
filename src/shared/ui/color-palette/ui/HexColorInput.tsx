import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/shared/ui/input';

interface HexColorInputProps {
  value: string;
  onValueChange: (color: string) => void;
}

/** 입력 중 HEX는 내부 상태로 관리하고, 유효한 6자리 색상만 부모 설정에 반영한다. */
export function HexColorInput({ value, onValueChange }: HexColorInputProps) {
  const { t } = useTranslation('common');
  const errorId = useId();
  const [draft, setDraft] = useState(value.toUpperCase());
  const [invalid, setInvalid] = useState(false);
  const [previousColor, setPreviousColor] = useState(value);

  // 프리셋·RGB로 색상이 바뀌면 입력과 오류를 동기화한다. 입력 DOM을 유지해 Enter 확정 후에도 포커스를 보존한다.
  if (previousColor !== value) {
    setPreviousColor(value);
    setDraft(value.toUpperCase());
    setInvalid(false);
  }

  /** Enter 또는 포커스 해제로 확정하고, 잘못된 입력은 마지막 유효 색상을 유지하며 알린다. */
  function commit() {
    const color = draft.trim().toUpperCase();
    // #과 HEX 6자리가 아니면 입력과 오류를 남기고 부모의 색상 변경은 중단한다.
    if (!/^#[0-9A-F]{6}$/.test(color)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(color);
    onValueChange(color);
  }

  return (
    <div className="color-palette-hex-field">
      <Input
        className="color-palette-hex"
        aria-label={t('colorPalette.hex')}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        value={draft}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        onChange={event => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={event => {
          // Enter는 확정하고, Escape는 미확정 입력을 버리고 부모의 색상으로 되돌린다.
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setDraft(value.toUpperCase());
            setInvalid(false);
          }
        }}
      />
      {invalid && (
        <p id={errorId} className="color-palette-error" role="alert">
          {t('colorPalette.invalidHex')}
        </p>
      )}
    </div>
  );
}
