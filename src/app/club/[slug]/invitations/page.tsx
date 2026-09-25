import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import { listInvites } from "@/lib/onboarding";
import { InvitationForm } from "@/components/invitation-form";
import { InvitationList } from "@/components/invitation-list";
export default async function Invites({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, a.id)).find(
    (c) => c.slug === slug && c.role === "manager",
  );
  if (!club) notFound();
  return (
    <main className="form-page">
      <Link href={`/club/${slug}/operations`}>← Manager overview</Link>
      <h1>Invite a member.</h1>
      <InvitationForm club={club.id} />
      <InvitationList items={await listInvites(db, a.id, "member", club.id)} />
    </main>
  );
}
