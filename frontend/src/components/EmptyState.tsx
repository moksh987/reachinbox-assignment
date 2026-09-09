import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-wire py-16 text-center">
      <p className="font-display text-base font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink/50">{description}</p>}
      {action}
    </div>
  );
}
