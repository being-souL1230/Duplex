type RingProps = {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  caption?: string;
  suffix?: string;
  muted?: boolean;
};

/** Circular progress dial — used everywhere instead of bars. */
export function Ring({
  value,
  size = 128,
  stroke = 2,
  label,
  caption,
  suffix = "",
  muted = false,
}: RingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={muted ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.82)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
        <span className="mono text-lg tracking-tight">
          {label ?? clamped}
          <span className="text-muted text-xs">{suffix}</span>
        </span>
        {caption ? (
          <span className="label max-w-[80%] leading-tight">{caption}</span>
        ) : null}
      </div>
    </div>
  );
}
