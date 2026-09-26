"use client";

import { useActionState, useEffect, useState } from "react";
import {
  acceptHouseholdInviteAction,
  issueHouseholdInviteAction,
  revokeHouseholdGrantAction,
  revokeHouseholdInviteAction,
  updateHouseholdGrantAction,
} from "@/app/household-actions";

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

export function HouseholdInviteForm({
  club,
  slug,
}: {
  club: string;
  slug: string;
}) {
  const [state, action, pending] = useActionState(
    issueHouseholdInviteAction.bind(null, club, slug),
    {},
  );
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <form action={action} className="profile-form booking-panel">
      <fieldset disabled={pending} className="editor-fields">
        <label>
          Adult’s email
          <input name="email" type="email" required maxLength={254} />
        </label>
        <label className="checkbox-row">
          <input name="can_manage_dogs" type="checkbox" value="yes" />
          Manage dog profiles and grooming care applications
        </label>
        <label className="checkbox-row">
          <input name="can_manage_bookings" type="checkbox" value="yes" />
          Make, view and cancel grooming bookings
        </label>
        <small>
          This does not grant billing, membership, admission-pass or public
          ownership access.
        </small>
      </fieldset>
      <Result state={state} />
      {state.token && (
        <label>
          Private household invitation link
          <input
            readOnly
            value={`${origin}/household/join#${state.token}`}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Creating…" : "Invite household adult"}
      </button>
    </form>
  );
}

export function AcceptHouseholdInvitation({ email }: { email?: string }) {
  const [token, setToken] = useState("");
  useEffect(() => setToken(window.location.hash.slice(1)), []);
  const [state, action, pending] = useActionState(
    acceptHouseholdInviteAction,
    {},
  );
  return (
    <form action={action} className="profile-form">
      <fieldset disabled={pending} className="editor-fields">
        <label>
          Invitation code
          <input
            name="token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
            autoComplete="off"
          />
        </label>
        <label>
          Invited email
          <input
            name="email"
            type="email"
            required
            defaultValue={email}
            readOnly={Boolean(email)}
          />
        </label>
        {!email && (
          <label>
            Create password
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
            <small>
              At least 12 characters. Existing users should sign in before
              reopening the invitation.
            </small>
          </label>
        )}
      </fieldset>
      <Result state={state} />
      <button className="button" disabled={pending || !token}>
        {pending ? "Joining…" : "Join household"}
      </button>
    </form>
  );
}

export function HouseholdGrantForm({
  club,
  slug,
  owner,
  adult,
  adultEmail,
  canManageDogs,
  canManageBookings,
}: {
  club: string;
  slug: string;
  owner: string;
  adult: string;
  adultEmail: string;
  canManageDogs: boolean;
  canManageBookings: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateHouseholdGrantAction.bind(null, club, slug, adult),
    {},
  );
  return (
    <article className="operator-card">
      <div>
        <h3>{adultEmail}</h3>
        <p>Choose exactly what this adult can manage.</p>
      </div>
      <form action={action} className="profile-form">
        <fieldset disabled={pending} className="editor-fields">
          <label className="checkbox-row">
            <input
              name="can_manage_dogs"
              type="checkbox"
              value="yes"
              defaultChecked={canManageDogs}
            />
            Dog profiles and grooming care
          </label>
          <label className="checkbox-row">
            <input
              name="can_manage_bookings"
              type="checkbox"
              value="yes"
              defaultChecked={canManageBookings}
            />
            Grooming bookings
          </label>
        </fieldset>
        <Result state={state} />
        <button className="button" disabled={pending}>
          {pending ? "Saving…" : "Save permissions"}
        </button>
      </form>
      <form
        action={revokeHouseholdGrantAction.bind(null, club, slug, owner, adult)}
      >
        <button className="text-button">Remove household access</button>
      </form>
    </article>
  );
}

export function LeaveHouseholdButton({
  club,
  slug,
  owner,
  adult,
}: {
  club: string;
  slug: string;
  owner: string;
  adult: string;
}) {
  return (
    <form
      action={revokeHouseholdGrantAction.bind(null, club, slug, owner, adult)}
    >
      <button className="text-button">Leave this household</button>
    </form>
  );
}

export function RevokeHouseholdInviteButton({
  club,
  slug,
  invite,
}: {
  club: string;
  slug: string;
  invite: string;
}) {
  return (
    <form action={revokeHouseholdInviteAction.bind(null, club, slug, invite)}>
      <button className="text-button">Revoke invitation</button>
    </form>
  );
}
