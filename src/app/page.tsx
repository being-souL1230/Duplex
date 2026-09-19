import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { Orbits, Triangle } from "@/components/Shapes";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LOOP = [
  { k: "Detect", d: "Lightweight tab signals", visual: "scatter" },
  { k: "Understand", d: "Cluster + score", visual: "cluster" },
  { k: "Confirm", d: "You decide", visual: "confirm" },
  { k: "Restore", d: "Only what belongs", visual: "restore" },
  { k: "Learn", d: "Next time is sharper", visual: "learn" },
];

/** Tiny wordless visual per loop step - the story told in dots, not text. */
function StepVisual({ kind }: { kind: string }) {
  const dot = (cx: number, cy: number, o: number, key: string | number) => (
    <circle key={key} cx={cx} cy={cy} r={2.3} fill="white" opacity={o} />
  );

  if (kind === "scatter") {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
        {dot(14, 15, 0.9, 1)}
        {dot(31, 11, 0.4, 2)}
        {dot(37, 27, 0.5, 3)}
        {dot(11, 33, 0.3, 4)}
        {dot(23, 24, 0.18, 5)}
      </svg>
    );
  }
  if (kind === "cluster") {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
        <circle cx={16} cy={17} r={8.5} fill="none" stroke="white" strokeWidth={1} strokeDasharray="3 3" opacity={0.3} />
        <circle cx={32} cy={31} r={8.5} fill="none" stroke="white" strokeWidth={1} strokeDasharray="3 3" opacity={0.3} />
        {dot(14, 15, 0.9, 1)}
        {dot(20, 20, 0.45, 2)}
        {dot(30, 29, 0.8, 3)}
        {dot(36, 34, 0.45, 4)}
      </svg>
    );
  }
  if (kind === "confirm") {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="white" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx={24} cy={24} r={11} opacity={0.4} />
        <path d="M18.5 24.5l4 4 7.5-9" opacity={0.95} />
      </svg>
    );
  }
  if (kind === "restore") {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          return (
            <circle
              key={i}
              cx={24 + 13 * Math.cos(a)}
              cy={24 + 13 * Math.sin(a)}
              r={2.3}
              fill="white"
              opacity={i % 2 ? 0.3 : 0.9}
            />
          );
        })}
      </svg>
    );
  }
  /* learn */
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="white" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M35 24a11 11 0 1 1-4.2-8.7" opacity={0.75} />
      <path d="M35.5 10.5v6h-6" opacity={0.75} />
      <circle cx={24} cy={24} r={2.3} fill="white" opacity={0.9} stroke="none" />
    </svg>
  );
}

const SIGNALS = [
  ["Hostname", "github.com"],
  ["URL pattern", "/org/project/issues"],
  ["Page title", "Project Issues"],
  ["Tab sequence", "Code → Docs → Design"],
  ["Time proximity", "opened within 30s"],
  ["Repetition", "same set, 4 sessions"],
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24">
      {/* nav */}
      <header className="sticky top-4 z-20 mt-4">
        <nav className="pill mx-auto flex items-center justify-between gap-4 py-2 pl-3 pr-2 backdrop-blur-xl">
          <BrandMark size="sm" />
          <div className="hidden items-center gap-6 text-xs text-muted sm:flex">
            <a href="#loop" className="transition hover:text-fg">Loop</a>
            <a href="#engine" className="transition hover:text-fg">Engine</a>
            <a href="#extension" className="transition hover:text-fg">Extension</a>
            <a href="#privacy" className="transition hover:text-fg">Privacy</a>
          </div>
          <Link href={user ? "/dashboard" : "/login"} className="btn btn-solid">
            {user ? "Open app" : "Sign in"}
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="relative grid items-center gap-10 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rise">
          <span className="label flex items-center gap-2">
            <Triangle size={8} className="text-white/50" />
            Context switching killer
          </span>
          <h1 className="mt-5 text-[2.6rem] leading-[1.02] tracking-[-0.03em] sm:text-6xl">
            Your browser restores tabs.
            <br />
            <span className="text-muted">Duplex restores intent.</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-muted">
            It watches lightweight signals - hostname, title, timing - clusters them,
            scores the match against your work modes, and asks before it acts.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={user ? "/dashboard" : "/signup"} className="btn btn-solid px-5 py-2.5">
              {user ? "Go to dashboard" : "Start free"}
            </Link>
            <Link href="/login" className="btn px-5 py-2.5">
              Try the demo account
            </Link>
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-md">
          <Orbits className="inset-0" />
          <div className="absolute inset-[9%] overflow-hidden rounded-full border border-white/10">
            <Image
              src="/images/hero-orb-circle.jpg"
              alt="Abstract sphere"
              width={900}
              height={900}
              priority
              className="h-full w-full object-cover opacity-90"
            />
          </div>
          <div className="pill absolute -left-2 top-8 flex items-center gap-2 px-3 py-1.5 backdrop-blur-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-white pulse-dot" />
            <span className="mono text-[0.65rem]">college project · 92%</span>
          </div>
          <div className="pill absolute -right-1 bottom-12 flex items-center gap-2 px-3 py-1.5 backdrop-blur-xl">
            <Triangle size={8} className="text-white/60" />
            <span className="mono text-[0.65rem]">6 tabs → 4 kept</span>
          </div>
        </div>
      </section>

      {/* loop */}
      <section id="loop" className="mt-28">
        <div className="flex items-end justify-between gap-6">
          <h2 className="text-xl tracking-tight">The loop</h2>
          <span className="label hidden sm:block">deterministic, explainable</span>
        </div>
        <div className="relative mt-12 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {/* connector line, brightening left → right to show flow */}
          <div className="absolute left-[10%] right-[10%] top-[3.25rem] hidden h-px bg-gradient-to-r from-white/5 via-white/15 to-white/35 lg:block" />
          {/* flow arrows at the column boundaries */}
          {[20, 40, 60, 80].map((x) => (
            <span
              key={x}
              className="absolute top-[3.08rem] hidden -translate-x-1/2 lg:block"
              style={{ left: `${x}%` }}
            >
              <Triangle size={7} className="rotate-90 text-white/40" />
            </span>
          ))}
          {LOOP.map((step, i) => (
            <div key={step.k} className="group relative flex flex-col items-center text-center">
              <div className="disc relative flex h-[6.5rem] w-[6.5rem] items-center justify-center transition duration-300 group-hover:border-white/25 group-hover:shadow-[0_0_44px_-10px_rgba(255,255,255,0.2)]">
                <span className="mono absolute top-3 text-[0.55rem] tracking-[0.2em] text-white/35">
                  0{i + 1}
                </span>
                <span className="transition-transform duration-300 group-hover:scale-110">
                  <StepVisual kind={step.visual} />
                </span>
              </div>
              <p className="mt-4 text-sm tracking-tight">{step.k}</p>
              <p className="mt-1 text-xs text-muted">{step.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* engine */}
      <section id="engine" className="mt-28 grid items-center gap-10 lg:grid-cols-2">
        <div className="relative mx-auto aspect-square w-full max-w-sm">
          <div className="absolute inset-0 overflow-hidden rounded-full border border-white/10">
            <Image
              src="/images/clusters-circle.jpg"
              alt="Clustered signals"
              width={800}
              height={800}
              className="h-full w-full object-cover opacity-80"
            />
          </div>
          <div className="absolute inset-[-6%] rounded-full border border-dashed border-white/[0.07] orbit" />
        </div>
        <div>
          <h2 className="text-xl tracking-tight">What the engine reads</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            No page text. No keystrokes. No form values. Seven lightweight signals are
            enough to recognise a working context.
          </p>
          <ul className="mt-7 space-y-2">
            {SIGNALS.map(([k, v]) => (
              <li
                key={k}
                className="pill flex items-center justify-between gap-4 px-4 py-2.5 text-xs"
              >
                <span className="text-fg">{k}</span>
                <span className="mono truncate text-muted">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* finale - extension + promises + cta, one connected composition */}
      <section className="relative mt-24 overflow-hidden rounded-[2.5rem] border border-white/8">
        {/* shared backdrop - connects every band of the finale */}
        <Image
          src="/images/prism.jpg"
          alt=""
          width={1600}
          height={900}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.12]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/90 to-ink" />

        <div className="relative">
          {/* extension row */}
          <div id="extension" className="grid gap-6 p-8 sm:p-10 lg:grid-cols-[1.25fr_auto] lg:items-center">
            <div>
              <span className="label flex items-center gap-2">
                <Triangle size={8} className="text-white/50" />
                Chrome Extension · Manifest V3
              </span>
              <h2 className="mt-3 text-xl tracking-tight sm:text-2xl">
                Put the engine in your browser
              </h2>
              <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted">
                Watches the same lightweight signals in your real tabs - hostname,
                title, timing - and suggests your work mode from the toolbar. Shares
                the web session; no second login.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.7rem] text-muted">
                <span className="pill px-3 py-1">12s debounce</span>
                <Triangle size={6} className="text-white/30" />
                <span className="pill px-3 py-1">one-click switch</span>
                <Triangle size={6} className="text-white/30" />
                <span className="pill px-3 py-1">45-min quiet on ignore</span>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 lg:items-end">
              <a href="/api/extension/download" className="btn btn-solid px-6 py-2.5 text-center" download>
                ↓ Download for Chrome · Edge · Brave · Opera
              </a>
              <a href="/api/extension/download?target=firefox" className="text-center text-[0.7rem] text-muted transition hover:text-fg lg:text-right" download>
                Firefox build (experimental) ↓
              </a>
              <a
                href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#manifest"
                target="_blank"
                rel="noreferrer"
                className="text-[0.7rem] text-muted transition hover:text-fg lg:text-right"
              >
                how to load unpacked in Chrome →
              </a>
            </div>
          </div>

          {/* triangle divider - connects extension to the promise triad */}
          <div className="flex items-center gap-3 px-8 sm:px-10">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-white/10" />
            <Triangle size={8} className="text-white/40" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/10 to-white/10" />
          </div>

          {/* promises - one flowing triad, no boxes */}
          <div id="privacy" className="grid gap-x-10 gap-y-7 p-8 sm:grid-cols-3 sm:p-10">
            {[
              {
                t: "Suggestion, not surveillance",
                d: "A visible feature with an on/off switch, an ignore action, and a reason for every score.",
              },
              {
                t: "Confirm before restore",
                d: "Nothing is created silently. High confidence only earns the right to ask a question.",
              },
              {
                t: "Works without AI",
                d: "Naming is an optional layer. The heuristic engine never depends on an API key.",
              },
            ].map((card, i) => (
              <div key={card.t} className="relative pl-6">
                <Triangle
                  size={9}
                  className={`absolute left-0 top-1 ${
                    i === 1 ? "text-white/70" : "text-white/35"
                  }`}
                />
                <p className="text-xs tracking-tight">{card.t}</p>
                <p className="mt-1.5 text-[0.7rem] leading-relaxed text-muted">{card.d}</p>
              </div>
            ))}
          </div>

          {/* cta strip */}
          <div className="flex flex-wrap items-center justify-between gap-5 border-t border-white/8 p-8 sm:px-10">
            <div>
              <p className="text-lg tracking-[-0.02em]">One click. The right context.</p>
              <p className="mono mt-1 text-[0.65rem] text-muted">
                demo@duplex.dev · watch a mixed window resolve into one workspace
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={user ? "/dashboard" : "/signup"} className="btn btn-solid px-5 py-2.5">
                {user ? "Go to dashboard" : "Create account"}
              </Link>
              <Link href="/login" className="btn px-5 py-2.5">
                Try the demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-16 flex items-center justify-between text-xs text-muted">
        <span>Duplex</span>
        <span className="mono">Hack Devengers 2.0</span>
      </footer>
    </main>
  );
}
