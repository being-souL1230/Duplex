import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  google_unconfigured: "Google sign-in is not configured on this server",
  google_failed: "Google sign-in failed — please try again",
  google_state: "Sign-in session expired — please try again",
  google_unverified: "Your Google email is not verified",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await ensureSeeded().catch(() => undefined);
  if (await getCurrentUser()) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="The demo account is pre-filled with four work modes and a week of sessions."
    >
      {error && ERROR_MESSAGES[error] ? (
        <p className="pill mb-3 px-4 py-2 text-center text-xs text-muted">
          {ERROR_MESSAGES[error]}
        </p>
      ) : null}
      <AuthForm mode="login" googleEnabled={googleConfigured()} />
      <p className="mt-5 text-center text-xs text-muted">
        No account yet?{" "}
        <Link href="/signup" className="text-fg underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
