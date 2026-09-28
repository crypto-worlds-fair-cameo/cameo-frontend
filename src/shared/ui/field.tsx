import { useId, type ReactNode } from 'react';
import './ui.css';

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: true;
    required?: boolean;
  }) => ReactNode;
};

export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  return (
    <div className="cameo-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children({
        id,
        required,
        'aria-describedby': hint || error ? `${id}-help` : undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {(error || hint) && (
        <p id={`${id}-help`} className={error ? 'cameo-field-error' : 'cameo-field-hint'}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
