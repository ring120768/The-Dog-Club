"use client";
import { useActionState } from "react";
import {
  checkInAdmissionAction,
  checkOutAdmissionAction,
  configureAdmissionAction,
  createAdmissionPassAction,
  setDogAdmissionAction,
  type AdmissionActionState,
} from "@/app/admission-actions";
import type { DogAdmissionEligibility } from "@/lib/admissions";

function ErrorMessage({ state }: { state: AdmissionActionState }) {
  return state.error ? (
    <p className="error" role="alert">
      {state.error}
    </p>
  ) : null;
}

export function CreateAdmissionPassForm({
  club,
  slug,
}: {
  club: string;
  slug: string;
}) {
  const [state, action, pending] = useActionState(
    createAdmissionPassAction.bind(null, club, slug),
    {},
  );
  return (
    <form action={action}>
      <ErrorMessage state={state} />
      <button className="button" disabled={pending}>
        {pending ? "Creating…" : "Create my admission pass"}
      </button>
    </form>
  );
}

export function AdmissionSettingsForm({
  club,
  slug,
  humans,
  dogs,
}: {
  club: string;
  slug: string;
  humans: number;
  dogs: number;
}) {
  const [state, action, pending] = useActionState(
    configureAdmissionAction.bind(null, club, slug),
    {},
  );
  return (
    <form action={action} className="admission-form admission-panel">
      <div className="field-pair">
        <label>
          Human capacity
          <input
            type="number"
            name="human_capacity"
            min={1}
            max={1000}
            defaultValue={humans || ""}
            required
          />
        </label>
        <label>
          Dog capacity
          <input
            type="number"
            name="dog_capacity"
            min={0}
            max={1000}
            defaultValue={dogs || 0}
            required
          />
        </label>
      </div>
      <small>
        Use the operator-approved limits. Do not estimate from floor area.
      </small>
      <ErrorMessage state={state} />
      <button className="button" disabled={pending}>
        {pending ? "Saving…" : "Save capacity"}
      </button>
    </form>
  );
}

export function DogAdmissionForm({
  club,
  slug,
  dog,
  status,
}: {
  club: string;
  slug: string;
  dog: string;
  status: "approved" | "suspended" | null;
}) {
  const [state, action, pending] = useActionState(
    setDogAdmissionAction.bind(null, club, slug, dog),
    {},
  );
  return (
    <form action={action} className="admission-inline-form">
      <select name="status" required defaultValue={status ?? ""}>
        <option value="" disabled>
          Choose decision
        </option>
        <option value="approved">Approved</option>
        <option value="suspended">Suspended</option>
      </select>
      <input
        name="reason"
        minLength={3}
        maxLength={500}
        required
        placeholder="Reason"
      />
      <ErrorMessage state={state} />
      <button className="button secondary" disabled={pending}>
        {pending ? "Saving…" : "Save decision"}
      </button>
    </form>
  );
}

export function AdmissionCheckInForm({
  club,
  slug,
  code,
  dogs,
  disabled,
}: {
  club: string;
  slug: string;
  code: string;
  dogs: DogAdmissionEligibility[];
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    checkInAdmissionAction.bind(null, club, slug, code),
    {},
  );
  return (
    <form action={action} className="admission-form admission-panel">
      <label>
        Humans entering
        <input
          type="number"
          name="human_count"
          min={1}
          max={20}
          defaultValue={1}
          required
        />
      </label>
      <fieldset>
        <legend>Dogs entering</legend>
        {!dogs.length && <small>No dogs are attached to this account.</small>}
        {dogs.map((dog) => (
          <label className="consent-check" key={dog.dog_id}>
            <input
              type="checkbox"
              name="dog_ids"
              value={dog.dog_id}
              disabled={dog.status !== "approved"}
            />
            {dog.dog_name} · {dog.status ?? "not reviewed"}
          </label>
        ))}
      </fieldset>
      <ErrorMessage state={state} />
      <button className="button" disabled={pending || disabled}>
        {pending ? "Checking in…" : "Confirm admission"}
      </button>
    </form>
  );
}

export function AdmissionCheckOutForm({
  club,
  slug,
  visit,
}: {
  club: string;
  slug: string;
  visit: string;
}) {
  const [state, action, pending] = useActionState(
    checkOutAdmissionAction.bind(null, club, slug, visit),
    {},
  );
  return (
    <form action={action}>
      <ErrorMessage state={state} />
      <button className="button secondary" disabled={pending}>
        {pending ? "Checking out…" : "Check out"}
      </button>
    </form>
  );
}
