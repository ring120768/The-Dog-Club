import Link from "next/link";
import { RecoveryResetForm } from "@/components/recovery-forms";

export default function ResetPage() {
  return (
    <main className="form-page">
      <span className="eyebrow">PRIVATE RECOVERY</span>
      <h1>Choose a new password.</h1>
      <p>
        A recovery link works once and expires after 30 minutes. Resetting your
        password signs the account out everywhere.
      </p>
      <RecoveryResetForm />
      <Link href="/login">← Back to sign in</Link>
    </main>
  );
}
