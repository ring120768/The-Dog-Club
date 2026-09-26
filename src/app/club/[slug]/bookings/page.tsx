import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor, dogsFor } from "@/lib/dogs";
import {
  activeServices,
  availabilityFor,
  bookingsFor,
  type GroomingService,
} from "@/lib/bookings";
import { OnboardingError } from "@/lib/onboarding";
import { BookingSlotForm, CancelBookingForm } from "@/components/booking-forms";
import { visitsFor } from "@/lib/visits";
import { visitLabels } from "@/lib/visit-contract";
import { subscriptionsFor } from "@/lib/memberships";

const londonDate = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
};

const bookingDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    dog?: string;
    service?: string;
    date?: string;
    booked?: string;
    credit?: string;
    cancelled?: string;
  }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  if (!club) notFound();
  const dogs = (await dogsFor(db, account.id, club.id)).filter(
    (dog) => dog.can_book,
  );
  const services = await activeServices(db, account.id, club.id);
  const bookings = await bookingsFor(db, account.id, club.id);
  const visitData = await visitsFor(db, account.id, club.id);
  const membershipData = await subscriptionsFor(db, account.id, club.id);
  const query = await searchParams;
  const selectedDog = dogs.find((dog) => dog.id === query.dog);
  const selectedService = services.find(
    (service) => service.id === query.service,
  );
  const selectedDate = query.date ?? londonDate();
  const currentMembership = membershipData.subscriptions.find(
    (subscription) => subscription.state !== "ended",
  );
  const benefitsAvailable = Boolean(
    currentMembership &&
    (currentMembership.state === "active" ||
      currentMembership.state === "cancellation_scheduled" ||
      (currentMembership.state === "payment_issue" &&
        currentMembership.payment_issue_benefits)),
  );
  const availableCredits =
    benefitsAvailable && selectedDog?.owner_id === account.id
      ? currentMembership!.remaining_grooming_credits
      : 0;
  let availability:
    | {
        service: GroomingService;
        slots: { starts_at: string; local_time: string }[];
      }
    | undefined;
  let availabilityError = "";
  if (selectedDog && selectedService && query.date) {
    try {
      availability = await availabilityFor(
        db,
        account.id,
        club.id,
        selectedDog.id,
        selectedService.id,
        selectedDate,
      );
    } catch (error) {
      availabilityError =
        error instanceof OnboardingError
          ? error.message
          : "Availability could not be loaded.";
    }
  }
  return (
    <main className="club-main booking-page">
      {query.booked && (
        <p className="success" role="status">
          {query.credit
            ? "Grooming booking confirmed and membership credit applied. No card payment is due."
            : "Grooming booking confirmed. No payment has been taken."}
        </p>
      )}
      {query.cancelled && (
        <p className="success" role="status">
          Booking cancelled and the slot released.
        </p>
      )}
      <span className="eyebrow">A LITTLE TIME FOR THEM</span>
      <h1>Book a groom.</h1>
      <p className="intro">
        Times include the service and clean-up buffer. Eligible members can use
        grooming credits; card payment is not collected in this demo.
      </p>
      <form method="get" className="booking-search booking-panel">
        <label>
          Dog
          <select name="dog" required defaultValue={selectedDog?.id ?? ""}>
            <option value="" disabled>
              Choose a dog
            </option>
            {dogs.map((dog) => (
              <option key={dog.id} value={dog.id}>
                {dog.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Service
          <select
            name="service"
            required
            defaultValue={selectedService?.id ?? ""}
          >
            <option value="" disabled>
              Choose a service
            </option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} ·{" "}
                {service.duration_minutes + service.cleanup_minutes} mins · £
                {(service.price_pence / 100).toFixed(2)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input
            name="date"
            type="date"
            required
            min={londonDate()}
            defaultValue={selectedDate}
          />
        </label>
        <button className="button">Find times</button>
      </form>
      {availabilityError && (
        <p className="error" role="alert">
          {availabilityError}
        </p>
      )}
      {availability && (
        <section className="available-slots">
          <h2>Available times</h2>
          <p>
            {availability.service.name} · £
            {(availability.service.price_pence / 100).toFixed(2)}
          </p>
          <div className="slot-grid">
            {availability.slots.map((slot) => (
              <BookingSlotForm
                key={String(slot.starts_at)}
                club={club.id}
                slug={slug}
                dog={selectedDog!.id}
                service={availability!.service.id}
                startsAt={new Date(slot.starts_at).toISOString()}
                localTime={slot.local_time}
                pricePence={availability!.service.price_pence}
                terms={availability!.service.cancellation_terms}
                availableCredits={availableCredits}
                creditCost={availability!.service.membership_credit_cost}
                creditEligible={
                  availability!.service.membership_credit_eligible
                }
              />
            ))}
          </div>
          {!availability.slots.length && (
            <p>No bookable times remain on this date.</p>
          )}
        </section>
      )}
      <section className="booking-list">
        <h2>Your bookings</h2>
        {!bookings.length && <p>No grooming bookings yet.</p>}
        {bookings.map((booking) => {
          const visit = visitData.visits.find(
            (item) => item.booking_id === booking.id,
          );
          const events = visitData.events.filter(
            (event) => event.visit_id === visit?.id,
          );
          return (
            <article key={booking.id} className="booking-card">
              <div>
                <span className="eyebrow">
                  {visit ? visitLabels[visit.status] : booking.status}
                </span>
                <h3>
                  {booking.dog_name} · {booking.service_name}
                </h3>
                <p>
                  {bookingDate(booking.starts_at)} ·{" "}
                  {booking.grooming_credits_applied > 0 ? (
                    <>
                      {booking.grooming_credits_applied} grooming{" "}
                      {booking.grooming_credits_applied === 1
                        ? "credit"
                        : "credits"}{" "}
                      · £0 due
                    </>
                  ) : (
                    <>£{(booking.amount_due_pence_snapshot / 100).toFixed(2)}</>
                  )}
                </p>
                {booking.grooming_credits_applied > 0 && (
                  <small>
                    Listed price: £
                    {(booking.price_pence_snapshot / 100).toFixed(2)}
                  </small>
                )}
                <small>{booking.cancellation_terms_snapshot}</small>
                {booking.cancellation_reason && (
                  <small>Reason: {booking.cancellation_reason}</small>
                )}
                {visit?.authorised_collector_name && (
                  <small>
                    Authorised collector: {visit.authorised_collector_name}
                  </small>
                )}
                {visit?.status === "ready" && (
                  <p className="ready-message">
                    {booking.dog_name} is ready for collection. Please contact
                    the club if you have not heard from the team.
                  </p>
                )}
                {visit && (
                  <details className="member-visit-history">
                    <summary>Visit progress</summary>
                    <ol>
                      {events.map((event) => (
                        <li key={event.id}>
                          {visitLabels[event.to_status]}
                          {event.action === "visit.corrected" && event.reason
                            ? ` — ${event.reason}`
                            : ""}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
              {booking.status === "confirmed" && !visit && (
                <CancelBookingForm
                  club={club.id}
                  slug={slug}
                  booking={booking.id}
                />
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
