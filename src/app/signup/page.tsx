import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <AuthShell
      title="Create your space"
      subtitle="Start clean - create your first work mode and let detection learn from there. Detection never acts without asking."
    >
      <AuthForm mode="signup" googleEnabled={googleConfigured()} />
      <p className="mt-5 text-center text-xs text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-fg underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
