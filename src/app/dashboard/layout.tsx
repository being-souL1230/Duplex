import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardTour } from "@/components/DashboardTour";
import { Sidebar } from "@/components/Sidebar";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Sidebar name={user.name} />
      <div className="mx-auto w-full max-w-5xl px-5 pb-28 pt-8 lg:pl-28 lg:pr-8">
        {children}
      </div>
      {/* first-visit guided tour - auto-runs once, replayable from settings */}
      <DashboardTour initialCompleted={user.tourCompleted} />
    </div>
  );
}
