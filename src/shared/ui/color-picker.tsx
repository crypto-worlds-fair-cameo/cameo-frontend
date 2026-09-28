import { useId } from 'react';
import { Slider } from './slider';
import './ui.css';

export function ColorPicker({
  value,
  onValueChange,
  label = '색상',
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const color = /^#[0-9a-f]{6}$/i.test(value) ? value : '#171717';
  const channels = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
  return (
    <fieldset className="cameo-color-picker" disabled={disabled}>
      <legend>{label}</legend>
      <div className="cameo-color-picker-row">
        <input
          id={id}
          type="color"
          aria-label={`${label} 선택`}
          value={color}
          onChange={event => onValueChange(event.target.value)}
        />
        <input
          key={color}
          className="cameo-color-hex"
          aria-label={`${label} HEX`}
          defaultValue={color.toUpperCase()}
          maxLength={7}
          pattern="#[0-9a-fA-F]{6}"
          onBlur={event => {
            const hex = event.target.value;
            if (/^#[0-9a-f]{6}$/i.test(hex)) onValueChange(hex);
            else event.target.value = color.toUpperCase();
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </div>
      {['R', 'G', 'B'].map((channel, index) => (
        <Slider
          key={channel}
          label={channel}
          min={0}
          max={255}
          value={channels[index]}
          compact
          disabled={disabled}
          onValueChange={next => {
            const updated = [...channels];
            updated[index] = next;
            onValueChange(`#${updated.map(n => n.toString(16).padStart(2, '0')).join('')}`);
          }}
        />
      ))}
    </fieldset>
  );
}
