export function Triangle({
  size = 10,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-block ${className}`}
      style={{
        width: size,
        height: size * 0.88,
        clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
        background: "currentColor",
      }}
      aria-hidden
    />
  );
}

/** Decorative concentric rings + orbiting node. Pure CSS/SVG, no images. */
export function Orbits({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute ${className}`} aria-hidden>
      <div className="relative h-full w-full">
        <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
        <div className="absolute inset-[12%] rounded-full border border-white/[0.05]" />
        <div className="absolute inset-[26%] rounded-full border border-dashed border-white/[0.07] orbit" />
        <div className="absolute inset-[42%] rounded-full border border-white/[0.05]" />
        <div className="orbit-slow absolute inset-0">
          <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/50" />
        </div>
      </div>
    </div>
  );
}
