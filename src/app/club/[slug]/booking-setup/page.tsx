import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import { bookingSetupFor } from "@/lib/bookings";
import {
  BookingSetupForm,
  InventoryToggleForm,
  LocationForm,
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
    (item) =>
      item.slug === slug &&
      (item.role === "manager" || item.can_manage_booking_setup),
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
      <section>
        <h2>Venue locations</h2>
        <p className="intro">
          Locations keep stations and shifts together. All times use
          Europe/London.
        </p>
        <LocationForm club={club.id} slug={slug} />
        {setup.locations.map((location) => (
          <article className="booking-card" key={location.id}>
            <div>
              <strong>{location.name}</strong>
              <p>
                {location.address_label || "No address label"} ·{" "}
                {location.active ? "active" : "retired"}
              </p>
            </div>
            <InventoryToggleForm
              club={club.id}
              slug={slug}
              kind="location"
              id={location.id}
              active={location.active}
            />
          </article>
        ))}
      </section>
      <BookingSetupForm
        club={club.id}
        slug={slug}
        locations={setup.locations}
        staff={setup.staff}
      />
      <section className="booking-summary">
        <h2>Current setup</h2>
        <p>
          {setup.services.length} services · {setup.resources.length} stations ·{" "}
          {setup.shifts.length} shifts
        </p>
        <h3>Services</h3>
        {setup.services.map((service) => (
          <article key={service.id}>
            <div>
              <strong>{service.name}</strong>
              <span> · {service.active ? "active" : "retired"}</span>
            </div>
            <InventoryToggleForm
              club={club.id}
              slug={slug}
              kind="service"
              id={service.id}
              active={service.active}
            />
          </article>
        ))}
        <h3>Stations</h3>
        {setup.resources.map((resource) => (
          <article key={resource.id}>
            <div>
              <strong>{resource.name}</strong>
              <span>
                {" "}
                · {resource.location_name} ·{" "}
                {resource.active ? "active" : "retired"}
              </span>
            </div>
            <InventoryToggleForm
              club={club.id}
              slug={slug}
              kind="resource"
              id={resource.id}
              active={resource.active}
            />
          </article>
        ))}
        <h3>Published shifts</h3>
        {setup.shifts.map((shift) => (
          <article key={shift.id}>
            <strong>{londonDateTime(shift.starts_at)}</strong>
            <span>
              {" "}
              to {londonDateTime(shift.ends_at)} · {shift.staff_email} ·{" "}
              {shift.location_name} · {shift.status}
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
