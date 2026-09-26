"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import {
  completePasswordRecovery,
  dismissPasswordRecovery,
  issuePasswordRecoveryLink,
  RecoveryError,
  requestPasswordRecovery,
} from "@/lib/recovery";

export type RecoveryState = {
  error?: string;
  success?: string;
  token?: string;
};

const errorState = (error: unknown): RecoveryState => ({
  error:
    error instanceof RecoveryError
      ? error.message
      : error instanceof z.ZodError
        ? error.issues[0].message
        : "Unable to complete this request. Please try again.",
});

export async function requestRecoveryAction(
  _state: RecoveryState,
  form: FormData,
): Promise<RecoveryState> {
  try {
    await requestPasswordRecovery(
      await database(),
      String(form.get("email") ?? ""),
    );
  } catch (error) {
    return errorState(error);
  }
  return {
    success:
      "If that account exists, the request is ready for platform support. Contact them through your usual private channel.",
  };
}

export async function issueRecoveryLinkAction(
  requestId: string,
  _state: RecoveryState,
): Promise<RecoveryState> {
  const account = await requireAccount();
  try {
    const token = await issuePasswordRecoveryLink(
      await database(),
      account.id,
      requestId,
    );
    revalidatePath("/platform/recovery");
    return { token };
  } catch (error) {
    return errorState(error);
  }
}

export async function dismissRecoveryAction(requestId: string) {
  const account = await requireAccount();
  await dismissPasswordRecovery(await database(), account.id, requestId);
  revalidatePath("/platform/recovery");
}

export async function completeRecoveryAction(
  _state: RecoveryState,
  form: FormData,
): Promise<RecoveryState> {
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm_password") ?? ""))
    return { error: "The passwords do not match." };
  try {
    await completePasswordRecovery(
      await database(),
      String(form.get("token") ?? ""),
      password,
    );
  } catch (error) {
    return errorState(error);
  }
  redirect("/login?recovered=1");
}
