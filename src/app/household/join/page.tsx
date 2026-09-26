import Link from "next/link";
import { currentAccount } from "@/lib/auth";
import { AcceptHouseholdInvitation } from "@/components/household-forms";

export default async function JoinHouseholdPage() {
  const account = await currentAccount();
  return (
    <main className="form-page">
      <span className="eyebrow">YOUR SHARED PACK</span>
      <h1>Join a household.</h1>
      <p>
        The invitation lists the areas you can help manage. It does not transfer
        dog ownership, membership billing or admission rights.
      </p>
      <AcceptHouseholdInvitation email={account?.email} />
      <Link href="/login">Already registered? Sign in</Link>
    </main>
  );
}
