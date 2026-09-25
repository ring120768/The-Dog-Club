import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import { bookingSetupFor } from "@/lib/bookings";
import {
  BookingSetupForm,
  ResourceClosureForm,
} from "@/components/booking-forms";

const londonDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));

export default async function BookingSetupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug && item.role === "manager",
  );
  if (!club) notFound();
  const setup = await bookingSetupFor(db, account.id, club.id);
  return (
    <main className="form-page booking-setup-page">
      <Link href={`/club/${slug}/operations`}>← Manager overview</Link>
      <span className="eyebrow">BOOKING FOUNDATION</span>
      <h1>Set the groomers up for success.</h1>
      <p>
        Publish a dated service, station and qualified shift. Times use
        Europe/London.
      </p>
      <BookingSetupForm club={club.id} slug={slug} />
      <section className="booking-summary">
        <h2>Current setup</h2>
        <p>
          {setup.services.length} services · {setup.resources.length} stations ·{" "}
          {setup.shifts.length} shifts
        </p>
        {setup.shifts.map((shift) => (
          <article key={shift.id}>
            <strong>{londonDateTime(shift.starts_at)}</strong>
            <span>
              {" "}
              to {londonDateTime(shift.ends_at)} · {shift.status}
            </span>
          </article>
        ))}
      </section>
      <section>
        <h2>Station closures</h2>
        <p className="intro">
          Closed stations disappear from member availability.
        </p>
        <ResourceClosureForm
          club={club.id}
          slug={slug}
          resources={setup.resources}
        />
        {setup.closures.map((closure, index) => (
          <p key={`${closure.resource_id}-${index}`}>
            {londonDateTime(closure.starts_at)}–
            {londonDateTime(closure.ends_at)} · {closure.reason}
          </p>
        ))}
      </section>
    </main>
  );
}
