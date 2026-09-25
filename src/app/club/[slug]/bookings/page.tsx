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
    (dog) => dog.owner_id === account.id,
  );
  const services = await activeServices(db, account.id, club.id);
  const bookings = await bookingsFor(db, account.id, club.id);
  const query = await searchParams;
  const selectedDog = dogs.find((dog) => dog.id === query.dog);
  const selectedService = services.find(
    (service) => service.id === query.service,
  );
  const selectedDate = query.date ?? londonDate();
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
          Grooming booking confirmed. No payment has been taken.
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
        Times include the service and clean-up buffer. Payment is not collected
        in this demo.
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
        {bookings.map((booking) => (
          <article key={booking.id} className="booking-card">
            <div>
              <span className="eyebrow">{booking.status}</span>
              <h3>
                {booking.dog_name} · {booking.service_name}
              </h3>
              <p>
                {bookingDate(booking.starts_at)} · £
                {(booking.price_pence_snapshot / 100).toFixed(2)}
              </p>
              <small>{booking.cancellation_terms_snapshot}</small>
              {booking.cancellation_reason && (
                <small>Reason: {booking.cancellation_reason}</small>
              )}
            </div>
            {booking.status === "confirmed" && (
              <CancelBookingForm
                club={club.id}
                slug={slug}
                booking={booking.id}
              />
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
