import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Dashboard page header with a band image stretched behind the title,
 * fading into the page background — same treatment as the reference design.
 */
export function Banner({
  src,
  alt,
  eyebrow,
  title,
  caption,
  action,
}: {
  src: string;
  alt: string;
  eyebrow: string;
  title: string;
  caption?: string;
  action?: ReactNode;
}) {
  return (
    <header className="capsule relative mb-8 flex flex-wrap items-end justify-between gap-4 overflow-hidden p-7">
      <Image
        src={src}
        alt={alt}
        width={1600}
        height={400}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/40" />
      <div className="relative">
        <span className="label">{eyebrow}</span>
        <h1 className="mt-2 text-2xl tracking-[-0.025em]">{title}</h1>
        {caption ? (
          <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-muted">{caption}</p>
        ) : null}
      </div>
      {action ? <div className="relative">{action}</div> : null}
    </header>
  );
}
