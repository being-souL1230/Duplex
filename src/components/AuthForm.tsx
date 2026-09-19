"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AuthForm({
  mode,
  googleEnabled = false,
}: {
  mode: "login" | "signup";
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const isLogin = mode === "login";
  const [email, setEmail] = useState(isLogin ? "demo@duplex.dev" : "");
  const [password, setPassword] = useState(isLogin ? "demo1234" : "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error - try again");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full space-y-3">
      {!isLogin && (
        <input
          className="field"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      )}
      <input
        className="field"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <input
        className="field"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={isLogin ? "current-password" : "new-password"}
        required
      />

      {error ? (
        <p className="pill px-4 py-2 text-center text-xs text-muted">{error}</p>
      ) : null}

      <button type="submit" className="btn btn-solid w-full py-2.5" disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-black/20 border-t-black/70 scan" />
            Working
          </span>
        ) : isLogin ? (
          "Sign in"
        ) : (
          "Create account"
        )}
      </button>

      {googleEnabled ? (
        <>
          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[0.65rem] uppercase tracking-[0.14em] text-muted">or</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <a href="/api/auth/google" className="btn w-full py-2.5">
            <span className="flex items-center justify-center gap-2.5">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.25 1.3-1.66 3.8-5.5 3.8-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.8 3.1 14.62 2.1 12 2.1 6.64 2.1 2.3 6.44 2.3 11.8s4.34 9.7 9.7 9.7c5.6 0 9.31-3.93 9.31-9.47 0-.64-.07-1.13-.16-1.62H12z" />
              </svg>
              Continue with Google
            </span>
          </a>
        </>
      ) : null}
    </form>
  );
}
