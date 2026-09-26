"use client";
import { useActionState } from "react";
import {
  cancelBookingAction,
  closeResourceAction,
  createLocationAction,
  reserveBookingAction,
  setInventoryActiveAction,
  setupBookingAction,
} from "@/app/booking-actions";

function Result({ state }: { state: { error?: string; success?: string } }) {
  return (
    <>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="success" role="status">
          {state.success}
        </p>
      )}
    </>
  );
}

export function BookingSetupForm({
  club,
  slug,
  locations,
  staff,
}: {
  club: string;
  slug: string;
  locations: { id: string; name: string; active: boolean }[];
  staff: { account_id: string; email: string }[];
}) {
  const [state, action, pending] = useActionState(
    setupBookingAction.bind(null, club, slug),
    {},
  );
  return (
    <form action={action} className="profile-form booking-panel">
      <fieldset disabled={pending} className="editor-fields">
        <div className="field-pair">
          <label>
            Venue location
            <select name="location_id" required>
              {locations
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Qualified groomer
            <select name="staff_id" required>
              {staff.map((person) => (
                <option key={person.account_id} value={person.account_id}>
                  {person.email}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Service name
          <input
            name="service_name"
            required
            maxLength={100}
            placeholder="Full groom"
          />
        </label>
        <div className="field-pair">
          <label>
            Service minutes
            <input
              name="duration_minutes"
              type="number"
              min={15}
              max={480}
              step={15}
              defaultValue={60}
              required
            />
          </label>
          <label>
            Clean-up minutes
            <input
              name="cleanup_minutes"
              type="number"
              min={0}
              max={120}
              step={15}
              defaultValue={15}
              required
            />
          </label>
        </div>
        <label>
          Fixed price (£)
          <input
            name="price_pounds"
            inputMode="decimal"
            required
            pattern="\d{1,5}(\.\d{1,2})?"
            placeholder="65.00"
          />
          <small>
            This price is shown and recorded; payment is not collected yet.
          </small>
        </label>
        <label>
          Cancellation terms
          <textarea
            name="cancellation_terms"
            required
            maxLength={1000}
            defaultValue="Cancel at least 24 hours before the appointment."
          />
        </label>
        <div className="field-pair">
          <label>
            Membership credit use
            <select name="membership_credit_eligible" defaultValue="yes">
              <option value="yes">Allowed</option>
              <option value="no">Not allowed</option>
            </select>
          </label>
          <label>
            Credits needed
            <input
              name="membership_credit_cost"
              type="number"
              min={1}
              max={100}
              defaultValue={1}
              required
            />
          </label>
        </div>
        <label>
          Grooming station
          <input
            name="resource_name"
            required
            maxLength={100}
            placeholder="Station one"
          />
        </label>
        <div className="field-pair">
          <label>
            Shift date
            <input name="date" type="date" required />
          </label>
          <label>
            Shift starts
            <input
              name="starts_at"
              type="time"
              step={900}
              required
              defaultValue="09:00"
            />
          </label>
          <label>
            Shift ends
            <input
              name="ends_at"
              type="time"
              step={900}
              required
              defaultValue="17:00"
            />
          </label>
        </div>
        <div className="field-pair">
          <label>
            Break starts
            <input name="break_starts_at" type="time" step={900} />
          </label>
          <label>
            Break ends
            <input name="break_ends_at" type="time" step={900} />
          </label>
        </div>
        <small>
          The selected groomer is qualified for this service and the dated shift
          is published immediately.
        </small>
      </fieldset>
      <Result state={state} />
      <button className="button" disabled={pending}>
        {pending ? "Publishing…" : "Create bookable setup"}
      </button>
    </form>
  );
}

export function LocationForm({ club, slug }: { club: string; slug: string }) {
  const [state, action, pending] = useActionState(
    createLocationAction.bind(null, club, slug),
    {},
  );
  return (
    <form action={action} className="profile-form booking-panel">
      <fieldset disabled={pending} className="editor-fields">
        <div className="field-pair">
          <label>
            Location name
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              placeholder="Chiswick club"
            />
          </label>
          <label>
            Address label
            <input
              name="address_label"
              maxLength={200}
              placeholder="Chiswick High Road, London"
            />
          </label>
        </div>
      </fieldset>
      <Result state={state} />
      <button className="button" disabled={pending}>
        {pending ? "Adding…" : "Add location"}
      </button>
    </form>
  );
}

export function InventoryToggleForm({
  club,
  slug,
  kind,
  id,
  active,
}: {
  club: string;
  slug: string;
  kind: "location" | "service" | "resource";
  id: string;
  active: boolean;
}) {
  const [state, action, pending] = useActionState(
    setInventoryActiveAction.bind(null, club, slug, kind, id, !active),
    {},
  );
  return (
    <form action={action}>
      <Result state={state} />
      <button className="text-button" disabled={pending}>
        {pending ? "Saving…" : active ? "Retire" : "Restore"}
      </button>
    </form>
  );
}

export function ResourceClosureForm({
  club,
  slug,
  resources,
}: {
  club: string;
  slug: string;
  resources: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(
    closeResourceAction.bind(null, club, slug),
    {},
  );
  return (
    <form action={action} className="profile-form booking-panel">
      <fieldset
        className="editor-fields"
        disabled={pending || !resources.length}
      >
        <label>
          Station
          <select name="resource_id" required>
            {resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field-pair">
          <label>
            Date
            <input name="date" type="date" required />
          </label>
          <label>
            From
            <input name="starts_at" type="time" step={900} required />
          </label>
          <label>
            Until
            <input name="ends_at" type="time" step={900} required />
          </label>
        </div>
        <label>
          Reason
          <input
            name="reason"
            required
            maxLength={500}
            placeholder="Maintenance"
          />
        </label>
      </fieldset>
      <Result state={state} />
      <button className="button" disabled={pending || !resources.length}>
        {pending ? "Saving…" : "Close station"}
      </button>
    </form>
  );
}

export function BookingSlotForm({
  club,
  slug,
  dog,
  service,
  startsAt,
  localTime,
  pricePence,
  terms,
  availableCredits,
  creditCost,
  creditEligible,
}: {
  club: string;
  slug: string;
  dog: string;
  service: string;
  startsAt: string;
  localTime: string;
  pricePence: number;
  terms: string;
  availableCredits: number;
  creditCost: number;
  creditEligible: boolean;
}) {
  const [state, action, pending] = useActionState(
    reserveBookingAction.bind(null, club, slug, dog, service, startsAt),
    {},
  );
  return (
    <form action={action} className="slot-card">
      <strong>{localTime}</strong>
      <span>
        {new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: "GBP",
        }).format(pricePence / 100)}
      </span>
      <label className="terms-check">
        <input type="checkbox" name="accepted_terms" value="yes" required />
        <span>I agree to: {terms}</span>
      </label>
      {creditEligible && availableCredits >= creditCost && (
        <label className="terms-check membership-credit-check">
          <input type="checkbox" name="use_membership_credit" value="yes" />
          <span>
            Use {creditCost} grooming {creditCost === 1 ? "credit" : "credits"}{" "}
            — £0 due. Restored if cancelled before the visit starts.
          </span>
        </label>
      )}
      {creditEligible &&
        availableCredits > 0 &&
        availableCredits < creditCost && (
          <small>
            This service needs {creditCost} credits; you have {availableCredits}
            .
          </small>
        )}
      <Result state={state} />
      <button className="button" disabled={pending}>
        {pending ? "Confirming…" : "Confirm booking"}
      </button>
    </form>
  );
}

export function CancelBookingForm({
  club,
  slug,
  booking,
}: {
  club: string;
  slug: string;
  booking: string;
}) {
  const [state, action, pending] = useActionState(
    cancelBookingAction.bind(null, club, slug, booking),
    {},
  );
  return (
    <form action={action} className="cancel-form">
      <label>
        Cancellation reason
        <input name="reason" required maxLength={500} />
      </label>
      <Result state={state} />
      <button className="text-button" disabled={pending}>
        {pending ? "Cancelling…" : "Cancel and release slot"}
      </button>
    </form>
  );
}
