"use server";

import { redirect } from "next/navigation";
import { database } from "@/lib/database";
import { completeDemoServiceCheckout } from "@/lib/demo-service-payments";

export async function finishDemoServicePayment(
  checkout: string,
  outcome: "paid" | "failed",
) {
  const status = await completeDemoServiceCheckout(
    await database(),
    checkout,
    outcome,
  );
  redirect(`/demo-checkout/${checkout}?result=${status}`);
}
