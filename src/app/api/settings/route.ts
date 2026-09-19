import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = (await request.json()) as {
    detectionEnabled?: boolean;
    closeUnrelatedTabs?: boolean;
    aiLabelsEnabled?: boolean;
    highThreshold?: number;
    mediumThreshold?: number;
    name?: string;
    tourCompleted?: boolean;
  };

  const high = body.highThreshold;
  const medium = body.mediumThreshold;

  const [updated] = await db
    .update(users)
    .set({
      ...(body.detectionEnabled !== undefined
        ? { detectionEnabled: body.detectionEnabled }
        : {}),
      ...(body.closeUnrelatedTabs !== undefined
        ? { closeUnrelatedTabs: body.closeUnrelatedTabs }
        : {}),
      ...(body.aiLabelsEnabled !== undefined
        ? { aiLabelsEnabled: body.aiLabelsEnabled }
        : {}),
      ...(typeof high === "number"
        ? { highThreshold: Math.max(50, Math.min(100, Math.round(high))) }
        : {}),
      ...(typeof medium === "number"
        ? { mediumThreshold: Math.max(20, Math.min(80, Math.round(medium))) }
        : {}),
      ...(body.name !== undefined ? { name: body.name.trim() || user.name } : {}),
      ...(body.tourCompleted !== undefined ? { tourCompleted: body.tourCompleted } : {}),
    })
    .where(eq(users.id, user.id))
    .returning();

  return Response.json({
    settings: {
      detectionEnabled: updated.detectionEnabled,
      closeUnrelatedTabs: updated.closeUnrelatedTabs,
      aiLabelsEnabled: updated.aiLabelsEnabled,
      highThreshold: updated.highThreshold,
      mediumThreshold: updated.mediumThreshold,
      name: updated.name,
      tourCompleted: updated.tourCompleted,
    },
  });
}
