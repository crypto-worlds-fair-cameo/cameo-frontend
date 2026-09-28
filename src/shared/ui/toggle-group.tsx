import './ui.css';

export function ToggleGroup({
  label,
  items,
  value,
  onValueChange,
}: {
  label: string;
  items: { value: string; label: string; disabled?: boolean }[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="cameo-toggle-group" role="group" aria-label={label}>
      {items.map(item => (
        <button
          key={item.value}
          type="button"
          disabled={item.disabled}
          aria-pressed={item.value === value}
          onClick={() => onValueChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
