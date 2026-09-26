"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { editableClub } from "@/lib/branding";
import { changeOperatorState } from "@/lib/operator-lifecycle";
import { OnboardingError } from "@/lib/onboarding";

export type OperatorStateFormState = { error?: string };

export async function changeOperatorStateAction(
  slug: string,
  _state: OperatorStateFormState,
  form: FormData,
): Promise<OperatorStateFormState> {
  const account = await requireAccount();
  const db = await database();
  const club = await editableClub(db, account.id, slug);
  if (!club) return { error: "Operator unavailable." };
  try {
    await changeOperatorState(
      db,
      account.id,
      club.id,
      Object.fromEntries(form),
    );
  } catch (error) {
    if (error instanceof OnboardingError) return { error: error.message };
    if (error instanceof ZodError) return { error: error.issues[0].message };
    return { error: "Unable to change operator state." };
  }
  revalidatePath("/platform");
  revalidatePath(`/platform/${slug}`);
  redirect(`/platform/${slug}?lifecycle=saved`);
}
