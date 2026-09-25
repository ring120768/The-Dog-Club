import Link from "next/link";
import { applicationsFor } from "@/lib/applications";
import { DogAvatar } from "@/components/dog-avatar";
import { photoUrl } from "@/lib/photo-contract";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database, scoped } from "@/lib/database";
import { clubsFor, dogsFor } from "@/lib/dogs";
import { bookingsFor } from "@/lib/bookings";

const londonDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
export default async function Operations({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find(
    (c) => c.slug === slug && c.role === "manager",
  );
  if (!club) notFound();
  const dogs = await dogsFor(db, account.id, club.id);
  const applications = await applicationsFor(db, account.id, club.id);
  const bookings = await bookingsFor(db, account.id, club.id);
  const care = await scoped(
    db,
    account.id,
    club.id,
    false,
    async (tx) =>
      (
        await tx.query<{ dog_id: string; notes: string }>(
          "SELECT dog_id,notes FROM care_notes",
        )
      ).rows,
  );
  return (
    <main className="club-main">
      <span className="eyebrow">MANAGER WORKSPACE</span>
      <h1>Your club, at a glance.</h1>
      <p className="intro">
        {dogs.length} dog profiles · Access restricted to this club.
      </p>
      <section>
        <h2>Grooming approval queue</h2>
        {applications.length === 0 ? (
          <p>No applications yet.</p>
        ) : (
          applications.map((a) => (
            <p key={a.dog_id}>
              <Link href={`/club/${slug}/applications/${a.dog_id}`}>
                {dogs.find((d) => d.id === a.dog_id)?.name ?? "Dog"} ·{" "}
                {a.status} →
              </Link>
            </p>
          ))
        )}
      </section>
      <section className="booking-summary">
        <div className="section-heading">
          <div>
            <span className="eyebrow">BOOKABLE GROOMING</span>
            <h2>Upcoming schedule</h2>
          </div>
          <Link href={`/club/${slug}/booking-setup`} className="inline-link">
            Configure services →
          </Link>
        </div>
        {bookings.filter((booking) => booking.status === "confirmed").length ===
        0 ? (
          <p>No confirmed grooming bookings.</p>
        ) : (
          bookings
            .filter((booking) => booking.status === "confirmed")
            .map((booking) => (
              <article className="booking-card" key={booking.id}>
                <div>
                  <h3>
                    {booking.dog_name} · {booking.service_name}
                  </h3>
                  <p>
                    {londonDateTime(booking.starts_at)} ·{" "}
                    {booking.resource_name}
                  </p>
                </div>
              </article>
            ))
        )}
      </section>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dog</th>
              <th>Breed</th>
              <th>Social visibility</th>
              <th>Private care note</th>
            </tr>
          </thead>
          <tbody>
            {dogs.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="manager-dog">
                    <DogAvatar
                      colour={d.avatar}
                      name={d.name}
                      photoSrc={
                        d.photo_id
                          ? photoUrl("members", club.id, d.id, d.photo_id)
                          : undefined
                      }
                    />
                    <span>{d.name}</span>
                  </div>
                </td>
                <td>{d.breed}</td>
                <td>{d.audience}</td>
                <td>
                  {care.find((c) => c.dog_id === d.id)?.notes ?? "Not recorded"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="coming-next">
        <p>
          Recurring rotas, clocking, payroll, payments and integrations remain
          on the roadmap.
        </p>
        <span>Not yet connected</span>
      </div>
    </main>
  );
}
