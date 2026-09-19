"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Step = {
  /** CSS selector of the element to spotlight */
  target: string;
  title: string;
  body: string;
  /** where the tooltip card prefers to sit relative to the target */
  place?: "right" | "left" | "top" | "bottom";
};

/**
 * Every target lives on the sidebar rail (rendered by the dashboard layout),
 * so the tour works from any page and never depends on page content.
 * On small screens the rail is hidden and the card falls back to center.
 */
const STEPS: Step[] = [
  {
    target: '[data-tour="nav"]',
    title: "This is your map",
    body: "Six pages, one purpose: getting you into the right work context fast. Walk through each one with me.",
    place: "right",
  },
  {
    target: '[data-tour="nav-overview"]',
    title: "Overview — your week at a glance",
    body: "Focus hours, sessions, how often detection guessed right — and recent modes for a one-click jump back in.",
    place: "right",
  },
  {
    target: '[data-tour="nav-modes"]',
    title: "Modes — your projects",
    body: "One circle = one project. Save the links you need for it, then hit “Open all links” to launch the whole workspace at once.",
    place: "right",
  },
  {
    target: '[data-tour="nav-live"]',
    title: "Live — watch the engine think",
    body: "A simulated browser window runs the real detection engine: it clusters your tabs, scores them against your modes, and asks before it acts.",
    place: "right",
  },
  {
    target: '[data-tour="nav-detection"]',
    title: "Detection — the engine's diary",
    body: "Every suggestion with its exact score and reasons. Ignoring one teaches the engine to stay quiet about that context.",
    place: "right",
  },
  {
    target: '[data-tour="nav-sessions"]',
    title: "Sessions — your work history",
    body: "Every restore records how long you stayed and how many times you jumped around. Fewer switches, deeper work.",
    place: "right",
  },
  {
    target: '[data-tour="nav-settings"]',
    title: "Settings — you are in control",
    body: "Detection on/off, sensitivity thresholds, and a button to replay this tour anytime.",
    place: "right",
  },
  {
    target: '[data-tour="user"]',
    title: "Suggestion, not surveillance",
    body: "FocusFlow never reads page content and never acts without your confirmation. That's the deal — welcome aboard!",
    place: "right",
  },
];

export function GuidedTour({ run, onFinish }: { run: boolean; onFinish: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [ttSize, setTtSize] = useState({ w: 300, h: 150 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const step = STEPS[stepIndex];

  const position = useMemo(() => {
    if (!rect) return null;
    const ttW = ttSize.w;
    const ttH = ttSize.h;
    const gap = 14;
    const margin = 12;
    const vw = window.innerWidth;
    const place = step.place ?? "bottom";

    let left: number;
    let top: number;

    if (place === "right") {
      left = rect.right + gap;
      top = rect.top + rect.height / 2;
    } else if (place === "left") {
      left = rect.left - gap - ttW;
      top = rect.top + rect.height / 2;
    } else {
      left = rect.left + rect.width / 2 - ttW / 2;
      top = rect.bottom + gap;
    }

    if (place === "right" || place === "left") {
      /* flip to the other side when it would overflow the viewport */
      if (place === "right" && left + ttW + margin > vw) left = rect.left - gap - ttW;
      if (place === "left" && left < margin) left = rect.right + gap;
      top = Math.min(Math.max(margin, top - ttH / 2), window.innerHeight - ttH - margin);
    } else {
      left = Math.min(Math.max(margin, left), vw - ttW - margin);
      if (top + ttH + margin > window.innerHeight) {
        top = Math.max(margin, rect.top - gap - ttH);
      }
    }

    return { left, top, ttW };
  }, [rect, step, ttSize]);

  /* Measure the rendered tooltip so positioning uses real size, not a guess. */
  useEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const update = () => setTtSize({ w: el.offsetWidth || 300, h: el.offsetHeight || 150 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Measure the spotlight target: first *visible* match of the selector. */
  useEffect(() => {
    if (!run || !step) return;
    let raf = 0;

    const measure = () => {
      let found: DOMRect | null = null;
      for (const el of document.querySelectorAll(step.target)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          found = r;
          break;
        }
      }
      setRect(found); /* null → tooltip centers itself */
    };

    measure();
    raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [run, step]);

  if (!run || !step) return null;

  const missing = !rect;
  const pad = missing ? 0 : 8;
  const last = stepIndex === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="Product tour">
      {/* spotlight mask */}
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <mask id="tour-spotlight">
            <rect width="100%" height="100%" fill="white" />
            {rect ? (
              <rect
                x={rect.left - pad}
                y={rect.top - pad}
                width={rect.width + pad * 2}
                height={rect.height + pad * 2}
                rx={28}
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#tour-spotlight)" />
      </svg>
      {/* click-outside ends the tour */}
      <div className="absolute inset-0" onClick={onFinish} />

      {/* tooltip card */}
      <div
        ref={tooltipRef}
        className="fixed rounded-[1.75rem] border border-white/12 bg-[#0c0c0e] p-5 shadow-2xl"
        style={
          position
            ? { left: position.left, top: position.top, width: position.ttW }
            : {
                left: "50%",
                top: "50%",
                width: 300,
                transform: "translate(-50%, -50%)",
              }
        }
      >
        <div className="flex items-center justify-between">
          <span className="label">
            {stepIndex + 1} / {STEPS.length}
          </span>
          <button onClick={onFinish} className="text-[0.7rem] text-muted transition hover:text-fg">
            Skip tour
          </button>
        </div>
        <p className="mt-3 text-sm tracking-tight">{step.title}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex ? "w-4 bg-white" : "w-1.5 bg-white/25"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {stepIndex > 0 ? (
              <button className="btn px-3 py-1.5 text-[0.7rem]" onClick={() => setStepIndex((i) => i - 1)}>
                Back
              </button>
            ) : null}
            <button
              className="btn btn-solid px-3.5 py-1.5 text-[0.7rem]"
              onClick={() => (last ? onFinish() : setStepIndex((i) => i + 1))}
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
