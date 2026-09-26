import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import { householdDashboard } from "@/lib/households";
import {
  HouseholdGrantForm,
  HouseholdInviteForm,
  LeaveHouseholdButton,
  RevokeHouseholdInviteButton,
} from "@/components/household-forms";

export default async function HouseholdPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ joined?: string }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  if (!club) notFound();
  const [dashboard, query] = await Promise.all([
    householdDashboard(db, account.id, club.id),
    searchParams,
  ]);
  const mine = dashboard.grants.filter(
    (grant) => grant.owner_account_id === account.id,
  );
  const helping = dashboard.grants.filter(
    (grant) => grant.adult_account_id === account.id,
  );
  const pending = dashboard.invites.filter(
    (invite) =>
      !invite.accepted_at &&
      !invite.revoked_at &&
      new Date(invite.expires_at).getTime() > Date.now(),
  );
  return (
    <main className="club-main">
      {query.joined && (
        <p className="success" role="status">
          Household access accepted. Your shared dogs and bookings are ready.
        </p>
      )}
      <span className="eyebrow">THE HUMANS BEHIND THE PACK</span>
      <h1>Household access.</h1>
      <p className="intro">
        Invite another trusted adult and choose whether they can manage dog
        profiles and care, grooming bookings, or both. You can change or remove
        access at any time.
      </p>
      <section className="booking-section">
        <h2>Invite an adult</h2>
        <HouseholdInviteForm club={club.id} slug={slug} />
      </section>
      {mine.length > 0 && (
        <section className="booking-section">
          <h2>Adults helping your household</h2>
          <div className="operator-grid">
            {mine.map((grant) => (
              <HouseholdGrantForm
                key={grant.adult_account_id}
                club={club.id}
                slug={slug}
                owner={grant.owner_account_id}
                adult={grant.adult_account_id}
                adultEmail={grant.adult_email}
                canManageDogs={grant.can_manage_dogs}
                canManageBookings={grant.can_manage_bookings}
              />
            ))}
          </div>
        </section>
      )}
      {helping.length > 0 && (
        <section className="booking-section">
          <h2>Households you help</h2>
          <div className="operator-grid">
            {helping.map((grant) => (
              <article className="operator-card" key={grant.owner_account_id}>
                <div>
                  <h3>{grant.owner_email}</h3>
                  <p>
                    {grant.can_manage_dogs
                      ? "Dog profiles and grooming care"
                      : "No dog-profile access"}
                    {" · "}
                    {grant.can_manage_bookings
                      ? "Grooming bookings"
                      : "No booking access"}
                  </p>
                </div>
                <LeaveHouseholdButton
                  club={club.id}
                  slug={slug}
                  owner={grant.owner_account_id}
                  adult={grant.adult_account_id}
                />
              </article>
            ))}
          </div>
        </section>
      )}
      {pending.length > 0 && (
        <section className="booking-section">
          <h2>Pending invitations</h2>
          {pending.map((invite) => (
            <article className="operator-card" key={invite.id}>
              <div>
                <h3>{invite.email}</h3>
                <p>
                  {invite.can_manage_dogs ? "Dog care" : ""}
                  {invite.can_manage_dogs && invite.can_manage_bookings
                    ? " · "
                    : ""}
                  {invite.can_manage_bookings ? "Bookings" : ""}
                </p>
              </div>
              <RevokeHouseholdInviteButton
                club={club.id}
                slug={slug}
                invite={invite.id}
              />
            </article>
          ))}
        </section>
      )}
      <Link className="inline-link" href={`/club/${slug}`}>
        ← Back to your pack
      </Link>
    </main>
  );
}
