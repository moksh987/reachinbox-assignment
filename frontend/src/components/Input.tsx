import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldWrapperProps {
  label: string;
  hint?: string;
}

export function Input({
  label,
  hint,
  className = "",
  ...props
}: FieldWrapperProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input
        className={`w-full rounded-md border border-wire bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink/50 ${className}`}
        {...props}
      />
      {hint && <span className="mt-1 block text-xs text-ink/50">{hint}</span>}
    </label>
  );
}

export function Textarea({
  label,
  hint,
  className = "",
  ...props
}: FieldWrapperProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <textarea
        className={`w-full rounded-md border border-wire bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink/50 ${className}`}
        {...props}
      />
      {hint && <span className="mt-1 block text-xs text-ink/50">{hint}</span>}
    </label>
  );
}
