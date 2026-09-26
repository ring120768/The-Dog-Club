import { z } from "zod";

export class RecoveryEmailConfigurationError extends Error {}
export class RecoveryEmailDeliveryError extends Error {
  constructor(public readonly code: string) {
    super("Recovery email delivery failed.");
  }
}

export type RecoveryEmailResult = {
  provider: "resend";
  messageId: string;
};

export type RecoveryEmailSender = {
  send(input: {
    requestId: string;
    email: string;
    token: string;
  }): Promise<RecoveryEmailResult>;
};

type EmailEnvironment = {
  RECOVERY_EMAIL_PROVIDER?: string;
  RESEND_API_KEY?: string;
  RECOVERY_EMAIL_FROM?: string;
  APP_URL?: string;
  NODE_ENV?: string;
};

type Fetcher = typeof fetch;

const responseSchema = z.object({ id: z.string().min(1) });

function recoveryOrigin(environment: EmailEnvironment) {
  let origin: URL;
  try {
    origin = new URL(environment.APP_URL ?? "");
  } catch {
    throw new RecoveryEmailConfigurationError(
      "APP_URL must be an absolute URL before recovery email is enabled.",
    );
  }
  if (environment.NODE_ENV === "production" && origin.protocol !== "https:")
    throw new RecoveryEmailConfigurationError(
      "Production recovery links require an HTTPS APP_URL.",
    );
  return origin.origin;
}

export function recoveryEmailSender(
  environment: EmailEnvironment = process.env,
  request: Fetcher = fetch,
): RecoveryEmailSender | null {
  const provider = environment.RECOVERY_EMAIL_PROVIDER?.trim().toLowerCase();
  if (!provider) return null;
  if (provider !== "resend")
    throw new RecoveryEmailConfigurationError(
      `Unsupported recovery email provider: ${provider}.`,
    );
  const apiKey = environment.RESEND_API_KEY?.trim();
  const from = environment.RECOVERY_EMAIL_FROM?.trim();
  if (!apiKey || !from)
    throw new RecoveryEmailConfigurationError(
      "Resend recovery email requires RESEND_API_KEY and RECOVERY_EMAIL_FROM.",
    );
  const origin = recoveryOrigin(environment);
  return {
    async send(input) {
      const resetUrl = `${origin}/reset#${input.token}`;
      let response: Response;
      try {
        response = await request("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `password-recovery/${input.requestId}`,
          },
          body: JSON.stringify({
            from,
            to: [input.email],
            subject: "Reset your Dog Club password",
            text: `Use this one-time link within 30 minutes to reset your Dog Club password:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
            html: `<p>Use this one-time link within 30 minutes to reset your Dog Club password:</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`,
          }),
        });
      } catch {
        throw new RecoveryEmailDeliveryError("network_error");
      }
      if (!response.ok)
        throw new RecoveryEmailDeliveryError(`provider_${response.status}`);
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success)
        throw new RecoveryEmailDeliveryError("invalid_provider_response");
      return { provider: "resend", messageId: parsed.data.id };
    },
  };
}

export function recoveryEmailConfigurationStatus(
  environment: EmailEnvironment = process.env,
): "configured" | "disabled" | "invalid" {
  try {
    return recoveryEmailSender(environment) ? "configured" : "disabled";
  } catch (error) {
    if (error instanceof RecoveryEmailConfigurationError) return "invalid";
    throw error;
  }
}
