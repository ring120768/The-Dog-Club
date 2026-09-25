import Link from "next/link";
import { currentAccount } from "@/lib/auth";
import { AcceptInvitation } from "@/components/invitation-form";
export default async function Join() {
  const a = await currentAccount();
  return (
    <main className="form-page">
      <h1>Join your pack.</h1>
      <p>
        Use the email your club invited. Accepting gives you access to the club;
        it does not purchase a membership or approve your dog for an activity.
      </p>
      <AcceptInvitation email={a?.email} />
      <Link href="/login">Already registered? Sign in</Link>
    </main>
  );
}
