"use client";

import { useState } from "react";
import { GuidedTour } from "@/components/GuidedTour";

/**
 * Wires the GuidedTour to persistence: auto-runs on first login
 * (tourCompleted = false in DB), marks it done via the settings API
 * when the user finishes or skips.
 */
export function DashboardTour({ initialCompleted }: { initialCompleted: boolean }) {
  const [completed, setCompleted] = useState(initialCompleted);

  function finish() {
    if (!completed) {
      /* optimistic - server call is fire-and-forget */
      setCompleted(true);
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourCompleted: true }),
      }).catch(() => {});
    }
  }

  return <GuidedTour run={!completed} onFinish={finish} />;
}
