import Link from "next/link";
import { applicationsFor } from "@/lib/applications";
import { DogAvatar } from "@/components/dog-avatar";
import { photoUrl } from "@/lib/photo-contract";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database, scoped } from "@/lib/database";
import { clubsFor, dogsFor } from "@/lib/dogs";
import { bookingsFor } from "@/lib/bookings";
import { visitsFor } from "@/lib/visits";
import { visitLabels, type VisitStatus } from "@/lib/visit-contract";
import { admissionDashboard } from "@/lib/admissions";
import {
  ArrivalForm,
  VisitCorrectionForm,
  VisitProgressForm,
} from "@/components/visit-forms";

const londonDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
export default async function Operations({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ visit?: string }>;
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
  const visitData = await visitsFor(db, account.id, club.id);
  const admissionData = await admissionDashboard(db, account.id, club.id);
  const visitMessage = (await searchParams).visit;
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
      {visitMessage && (
        <p className="success" role="status">
          {visitMessage === "arrived"
            ? "Arrival recorded."
            : visitMessage === "corrected"
              ? "Visit state corrected and added to the audit history."
              : `Visit updated: ${visitLabels[visitMessage as VisitStatus] ?? visitMessage}.`}
        </p>
      )}
      <span className="eyebrow">MANAGER WORKSPACE</span>
      <h1>Your club, at a glance.</h1>
      <p className="intro">
        {dogs.length} dog profiles · Access restricted to this club.
      </p>
      <section className="operations-admission-summary">
        <div>
          <span className="eyebrow">LIVE CLUB ADMISSION</span>
          <h2>
            {admissionData.occupancy.humans} humans ·{" "}
            {admissionData.occupancy.dogs} dogs
          </h2>
          <p>
            {admissionData.settings
              ? `Approved limits: ${admissionData.settings.human_capacity} ${admissionData.settings.human_capacity === 1 ? "human" : "humans"} and ${admissionData.settings.dog_capacity} ${admissionData.settings.dog_capacity === 1 ? "dog" : "dogs"}.`
              : "Venue capacity has not been configured."}
          </p>
        </div>
        <Link href={`/club/${slug}/admission`} className="button">
          Open reception →
        </Link>
      </section>
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
            .map((booking) => {
              const visit = visitData.visits.find(
                (item) => item.booking_id === booking.id,
              );
              const events = visitData.events.filter(
                (event) => event.visit_id === visit?.id,
              );
              return (
                <article className="booking-card visit-card" key={booking.id}>
                  <div className="visit-card-main">
                    <div>
                      <span className="eyebrow">
                        {visit ? visitLabels[visit.status] : "Booked"}
                      </span>
                      <h3>
                        {booking.dog_name} · {booking.service_name}
                      </h3>
                      <p>
                        {londonDateTime(booking.starts_at)} ·{" "}
                        {booking.resource_name}
                      </p>
                      <small>
                        {booking.grooming_credits_applied > 0
                          ? `${booking.grooming_credits_applied} grooming ${booking.grooming_credits_applied === 1 ? "credit" : "credits"} applied · £0 due`
                          : `£${(booking.amount_due_pence_snapshot / 100).toFixed(2)} due`}
                      </small>
                      {visit?.authorised_collector_name && (
                        <small>
                          Authorised collector:{" "}
                          {visit.authorised_collector_name}
                        </small>
                      )}
                      {visit?.status === "ready" &&
                        visit.notification_status === "manual_required" && (
                          <p className="manual-contact">
                            Ready contact has not been sent. Contact the member
                            manually.
                          </p>
                        )}
                    </div>
                    {!visit ? (
                      <ArrivalForm
                        club={club.id}
                        slug={slug}
                        booking={booking.id}
                      />
                    ) : (
                      <VisitProgressForm
                        club={club.id}
                        slug={slug}
                        visit={visit.id}
                        status={visit.status}
                        collector={visit.authorised_collector_name}
                      />
                    )}
                  </div>
                  {visit && (
                    <div className="visit-audit">
                      <details>
                        <summary>Visit history ({events.length})</summary>
                        <ol>
                          {events.map((event) => (
                            <li key={event.id}>
                              {visitLabels[event.to_status]}
                              {event.action === "visit.corrected"
                                ? ` — corrected: ${event.reason}`
                                : ""}
                            </li>
                          ))}
                        </ol>
                      </details>
                      <VisitCorrectionForm
                        club={club.id}
                        slug={slug}
                        visit={visit.id}
                        status={visit.status}
                      />
                    </div>
                  )}
                </article>
              );
            })
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
