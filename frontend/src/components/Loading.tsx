interface LoadingProps {
  label?: string;
  size?: "sm" | "md";
}

export function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  const dimension = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <svg
      className={`animate-spin text-ink/40 ${dimension}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Loading({ label = "Loading\u2026", size = "md" }: LoadingProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink/50">
      <Spinner size={size} />
      <span>{label}</span>
    </div>
  );
}
