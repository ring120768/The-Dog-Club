"use server";
import { photoChangeFromForm, PhotoValidationError } from "@/lib/photos";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signIn, signOut, requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor, saveDog, dogInput } from "@/lib/dogs";
export async function loginAction(form: FormData) {
  const email = z
    .email()
    .max(254)
    .safeParse(
      String(form.get("email") ?? "")
        .trim()
        .toLowerCase(),
    );
  const password = z.string().min(1).max(128).safeParse(form.get("password"));
  if (
    !email.success ||
    !password.success ||
    !(await signIn(email.data, password.data))
  )
    redirect("/login?error=1");
  redirect("/");
}
export async function logoutAction() {
  await signOut();
  redirect("/login");
}
export type FormState = { error?: string };
export async function saveDogAction(
  clubSlug: string,
  id: string | undefined,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find(
    (c) => c.slug === clubSlug,
  );
  if (!club) return { error: "You do not have access to this club." };
  const parsed = dogInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const photoChange = await photoChangeFromForm(form);
    await saveDog(db, account.id, club.id, id, parsed.data, photoChange);
  } catch (error) {
    if (error instanceof PhotoValidationError) return { error: error.message };
    return {
      error: "Could not save this profile. Check your access and try again.",
    };
  }
  revalidatePath(`/club/${clubSlug}`);
  revalidatePath("/p/[slug]/[id]", "page");
  redirect(`/club/${clubSlug}?saved=1`);
}
