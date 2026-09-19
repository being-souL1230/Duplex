import { redirect } from "next/navigation";
import { PageHead } from "@/components/PageHead";
import { SettingsPanel } from "@/components/SettingsPanel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <PageHead
        eyebrow="Control"
        title="Settings"
        subtitle="Detection is a feature you own — switch it off, raise the bar, or keep it quiet."
      />
      <SettingsPanel
        initial={{
          name: user.name,
          detectionEnabled: user.detectionEnabled,
          closeUnrelatedTabs: user.closeUnrelatedTabs,
          aiLabelsEnabled: user.aiLabelsEnabled,
          highThreshold: user.highThreshold,
          mediumThreshold: user.mediumThreshold,
          tourCompleted: user.tourCompleted,
        }}
      />
    </>
  );
}
