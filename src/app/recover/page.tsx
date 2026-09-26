import Link from "next/link";
import { RecoveryRequestForm } from "@/components/recovery-forms";

export default function RecoverPage() {
  return (
    <main className="form-page">
      <span className="eyebrow">ACCOUNT HELP</span>
      <h1>Get back to your pack.</h1>
      <p>
        Enter your account email. For this demo, platform support will verify
        the request and privately share a short-lived recovery link.
      </p>
      <RecoveryRequestForm />
      <Link href="/login">← Back to sign in</Link>
    </main>
  );
}
