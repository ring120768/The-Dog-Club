"use server";

import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { resetDemoActivity } from "@/lib/demo-reset";

export async function resetDemoActivityAction(formData: FormData) {
  const confirmation = formData.get("confirmation");
  if (confirmation !== "confirmed")
    redirect("/platform?reset=confirmation-required");

  const account = await requireAccount();
  const club = String(formData.get("club") ?? "");
  const result = await resetDemoActivity(await database(), account.id, club);
  redirect(
    `/platform?reset=complete&club=${encodeURIComponent(result.club)}&removed=${result.removedRecords}`,
  );
}
