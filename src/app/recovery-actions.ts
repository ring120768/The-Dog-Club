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
  recordPasswordRecoveryDelivery,
  RecoveryError,
  requestPasswordRecovery,
} from "@/lib/recovery";
import {
  recoveryEmailSender,
  RecoveryEmailDeliveryError,
} from "@/lib/recovery-email";
import { isDemoMode } from "@/lib/runtime";

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
  const db = await database();
  let sender = null;
  if (!isDemoMode()) {
    try {
      sender = recoveryEmailSender();
    } catch {
      // A valid public request still enters the private support queue when
      // production email configuration is incomplete.
    }
  }
  try {
    const prepared = await requestPasswordRecovery(
      db,
      String(form.get("email") ?? ""),
      sender ? "email" : "manual",
    );
    if (prepared && sender) {
      try {
        const delivered = await sender.send(prepared);
        await recordPasswordRecoveryDelivery(db, prepared.requestId, {
          status: "provider_accepted",
          provider: delivered.provider,
          messageId: delivered.messageId,
        });
      } catch (error) {
        try {
          await recordPasswordRecoveryDelivery(db, prepared.requestId, {
            status: "failed",
            provider: "resend",
            errorCode:
              error instanceof RecoveryEmailDeliveryError
                ? error.code
                : "unexpected_delivery_error",
          });
        } catch {
          // Delivery bookkeeping must never make the public response reveal
          // whether the submitted address belongs to an account.
        }
      }
    }
  } catch (error) {
    return errorState(error);
  }
  return {
    success: sender
      ? "If that account exists, check its inbox for a password-reset email. If it does not arrive, contact platform support."
      : "If that account exists, the request is ready for platform support. Contact them through your usual private channel.",
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
