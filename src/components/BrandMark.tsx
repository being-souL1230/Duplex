import Link from "next/link";

/**
 * Duplex brand mark: two overlapping circles (the "duplex" idea: two
 * contexts, one surface) with a bright intersection point, plus a
 * tracking-tight wordmark with a subtle two-tone treatment.
 */
export function BrandMark({
  href = "/",
  size = "md",
  className = "",
}: {
  href?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const text = size === "sm" ? "text-sm" : "text-[0.95rem]";

  return (
    <Link href={href} className={`group flex items-center gap-2.5 ${className}`}>
      <span
        className={`relative flex ${box} items-center justify-center rounded-full border border-white/15 transition duration-300 group-hover:border-white/35`}
      >
        {/* back circle */}
        <span className="absolute h-[0.62rem] w-[0.62rem] -translate-x-[0.19rem] rounded-full border border-white/40 bg-white/5 transition duration-300 group-hover:border-white/60" />
        {/* front circle */}
        <span className="absolute h-[0.62rem] w-[0.62rem] translate-x-[0.19rem] rounded-full bg-white/85 transition duration-300 group-hover:bg-white" />
        {/* orbit ring */}
        <span className="absolute inset-0 rounded-full border border-dashed border-white/10 orbit" />
      </span>
      <span className={`${text} font-medium tracking-[-0.03em]`}>
        <span className="text-white">Dup</span>
        <span className="text-white/45 transition duration-300 group-hover:text-white/75">
          lex
        </span>
      </span>
    </Link>
  );
}
