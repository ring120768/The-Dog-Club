import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import { staffAdminFor } from "@/lib/staff";
import { listInvites } from "@/lib/onboarding";
import { StaffAccessForm, StaffInvitationForm } from "@/components/staff-forms";
import { InvitationList } from "@/components/invitation-list";

const london = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
export default async function StaffPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find(
    (item) =>
      item.slug === slug && (item.role === "manager" || item.can_manage_staff),
  );
  if (!club) notFound();
  const admin = await staffAdminFor(db, account.id, club.id);
  const invites = await listInvites(db, account.id, "staff", club.id);
  return (
    <main className="form-page booking-setup-page">
      <Link href={`/club/${slug}/operations`}>← Manager overview</Link>
      <span className="eyebrow">STAFF ACCESS</span>
      <h1>Give each person only the access they need.</h1>
      <p>
        Invite staff with their intended role, permissions and grooming
        qualifications. Existing club members can also be assigned below.
      </p>
      <section>
        <h2>Invite staff</h2>
        <StaffInvitationForm club={club.id} services={admin.services} />
        <InvitationList items={invites} />
      </section>
      <section>
        <h2>Owner and manager accounts</h2>
        {admin.people
          .filter((p) => p.membership_role === "manager")
          .map((person) => (
            <article className="booking-card" key={person.account_id}>
              <div>
                <strong>{person.email}</strong>
                <p>Manager · full club administration</p>
              </div>
            </article>
          ))}
      </section>
      <section>
        <h2>Team access</h2>
        {admin.people
          .filter((p) => p.membership_role !== "manager")
          .map((person) => (
            <StaffAccessForm
              key={person.account_id}
              club={club.id}
              slug={slug}
              person={person}
              services={admin.services}
            />
          ))}
      </section>
      <section>
        <h2>Recent access history</h2>
        {!admin.events.length && <p>No staff access changes yet.</p>}
        {admin.events.map((event, index) => (
          <p key={`${event.staff_account_id}-${event.created_at}-${index}`}>
            <strong>{event.action}</strong> · {event.staff_account_id} ·{" "}
            {london(event.created_at)}
          </p>
        ))}
      </section>
    </main>
  );
}
