import Link from "next/link";
import { RecoveryRequestForm } from "@/components/recovery-forms";
import { recoveryEmailConfigurationStatus } from "@/lib/recovery-email";
import { isDemoMode } from "@/lib/runtime";

export default function RecoverPage() {
  const automaticEmail =
    !isDemoMode() && recoveryEmailConfigurationStatus() === "configured";
  return (
    <main className="form-page">
      <span className="eyebrow">ACCOUNT HELP</span>
      <h1>Get back to your pack.</h1>
      <p>
        {automaticEmail
          ? "Enter your account email. If it matches an account, we’ll send a one-time recovery link to that address."
          : "Enter your account email. Platform support will verify the request and privately share a short-lived recovery link."}
      </p>
      <RecoveryRequestForm />
      <Link href="/login">← Back to sign in</Link>
    </main>
  );
}
