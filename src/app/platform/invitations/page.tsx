import Link from "next/link";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { listInvites } from "@/lib/onboarding";
import { InvitationForm } from "@/components/invitation-form";
import { InvitationList } from "@/components/invitation-list";
export default async function OperatorInvites() {
  const a = await requireAccount();
  const items = await listInvites(await database(), a.id, "operator");
  return (
    <main className="platform-main">
      <Link href="/platform">← All clubs</Link>
      <h1>Welcome a new operator.</h1>
      <p>
        The operator accepts this private invitation to create their account and
        club together. They can change their branding afterwards.
      </p>
      <InvitationForm />
      <InvitationList items={items} />
    </main>
  );
}
