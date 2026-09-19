import type { ReactNode } from "react";

export function PageHead({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="label">{eyebrow}</span>
        <h1 className="mt-2 text-2xl tracking-[-0.025em]">{title}</h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
