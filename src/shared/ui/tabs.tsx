import { useId, useRef, type ReactNode } from 'react';
import './ui.css';

type TabItem = { value: string; label: string; content: ReactNode };
export function Tabs({
  label,
  items,
  value,
  onValueChange,
}: {
  label: string;
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="cameo-tabs">
      <div role="tablist" aria-label={label}>
        {items.map((item, index) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            ref={node => {
              buttons.current[index] = node;
            }}
            id={`${id}-tab-${index}`}
            aria-controls={`${id}-panel-${index}`}
            aria-selected={value === item.value}
            tabIndex={value === item.value ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={event => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % items.length
                  : event.key === 'ArrowLeft'
                    ? (index - 1 + items.length) % items.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? items.length - 1
                        : undefined;
              if (next === undefined) return;
              event.preventDefault();
              onValueChange(items[next].value);
              buttons.current[next]?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item, index) => (
        <div
          key={item.value}
          role="tabpanel"
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          hidden={value !== item.value}
          tabIndex={0}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
