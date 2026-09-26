"use client";
import { useActionState } from "react";
import { deactivateStaffAction, saveStaffAction } from "@/app/staff-actions";
import type { StaffRole } from "@/lib/staff";

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

export function StaffAccessForm({
  club,
  slug,
  person,
  services,
}: {
  club: string;
  slug: string;
  person: {
    account_id: string;
    email: string;
    staff_role: StaffRole | null;
    active: boolean | null;
    can_manage_staff: boolean | null;
    can_manage_booking_setup: boolean | null;
    qualification_ids: string[];
  };
  services: { id: string; name: string; active: boolean }[];
}) {
  const [state, action, pending] = useActionState(
    saveStaffAction.bind(null, club, slug),
    {},
  );
  const [offState, offAction, offPending] = useActionState(
    deactivateStaffAction.bind(null, club, slug, person.account_id),
    {},
  );
  return (
    <article className="booking-card staff-card">
      <div>
        <strong>{person.email}</strong>
        <p>
          {person.staff_role
            ? `${person.staff_role} · ${person.active ? "active" : "inactive"}`
            : "Club member · no staff access"}
        </p>
      </div>
      <form action={action} className="staff-access-form">
        <input type="hidden" name="account_id" value={person.account_id} />
        <label>
          Operational role
          <select name="role" defaultValue={person.staff_role ?? "reception"}>
            {(["manager", "groomer", "reception", "cafe"] as const).map(
              (role) => (
                <option key={role} value={role}>
                  {role[0].toUpperCase() + role.slice(1)}
                </option>
              ),
            )}
          </select>
        </label>
        <fieldset disabled={pending}>
          <legend>Permissions</legend>
          {[
            ["can_manage_staff", "Manage staff access"],
            [
              "can_manage_booking_setup",
              "Manage services, stations, locations and shifts",
            ],
          ].map(([name, label]) => (
            <label className="terms-check" key={name}>
              <input
                type="checkbox"
                name={name}
                value="yes"
                defaultChecked={Boolean(person[name as keyof typeof person])}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <fieldset disabled={pending}>
          <legend>Grooming qualifications</legend>
          {services.map((service) => (
            <label className="terms-check" key={service.id}>
              <input
                type="checkbox"
                name="service_ids"
                value={service.id}
                defaultChecked={person.qualification_ids.includes(service.id)}
              />
              <span>
                {service.name}
                {service.active ? "" : " (retired)"}
              </span>
            </label>
          ))}
        </fieldset>
        <Result state={state} />
        <button className="button" disabled={pending}>
          {pending
            ? "Saving…"
            : person.staff_role
              ? "Update access"
              : "Assign staff access"}
        </button>
      </form>
      {person.active && (
        <form action={offAction}>
          <Result state={offState} />
          <button className="text-button" disabled={offPending}>
            {offPending ? "Deactivating…" : "Deactivate staff access"}
          </button>
        </form>
      )}
    </article>
  );
}
