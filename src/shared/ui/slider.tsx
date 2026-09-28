import { useId, type ComponentProps, type CSSProperties } from 'react';
import { cn } from '@/shared/lib/utils';
import './ui.css';

type SliderProps = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange' | 'size'> & {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  unit?: string;
  compact?: boolean;
};
export function Slider({
  label,
  value,
  onValueChange,
  min = 0,
  max = 100,
  unit = '',
  compact,
  id,
  className,
  ...props
}: SliderProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const progress = Math.min(
    100,
    Math.max(0, ((value - Number(min)) / (Number(max) - Number(min) || 1)) * 100)
  );
  return (
    <div className={cn('cameo-slider-field', compact && 'cameo-slider-field--compact', className)}>
      <label htmlFor={inputId}>
        {label}
        <output htmlFor={inputId}>
          {value}
          {unit}
        </output>
      </label>
      <input
        {...props}
        id={inputId}
        type="range"
        min={min}
        max={max}
        value={value}
        aria-valuetext={`${value}${unit}`}
        style={{ '--slider-progress': `${progress}%` } as CSSProperties}
        onChange={event => onValueChange(Number(event.target.value))}
      />
    </div>
  );
}
