import { Minus, Plus } from 'lucide-react';
import './ui.css';

export function ZoomControls({
  value,
  onValueChange,
  min = 25,
  max = 200,
  step = 25,
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="cameo-zoom" role="group" aria-label="확대 및 축소">
      <button
        type="button"
        aria-label="축소"
        disabled={value <= min}
        onClick={() => onValueChange(Math.max(min, value - step))}
      >
        <Minus size={14} />
      </button>
      <output aria-live="polite">{value}%</output>
      <button
        type="button"
        aria-label="확대"
        disabled={value >= max}
        onClick={() => onValueChange(Math.min(max, value + step))}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
