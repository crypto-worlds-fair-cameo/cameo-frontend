import { useId, type ComponentProps, type ReactNode } from 'react';
import './ui.css';

export function Checkbox({
  label,
  id,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { label: ReactNode }) {
  const generatedId = useId();
  return (
    <label className="cameo-checkbox-label" htmlFor={id ?? generatedId}>
      <input {...props} id={id ?? generatedId} type="checkbox" className="cameo-checkbox" />
      {label}
    </label>
  );
}
