"use client";
import { useActionState, useEffect, useState } from "react";
import { inviteAction, acceptAction } from "@/app/onboarding-actions";
export function InvitationForm({ club }: { club?: string }) {
  const [state, action, pending] = useActionState(
    inviteAction.bind(null, club ? "member" : "operator", club ?? null),
    {},
  );
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <form action={action} className="profile-form">
      <fieldset disabled={pending} className="editor-fields">
        <label>
          Invited email
          <input name="managerEmail" type="email" required maxLength={254} />
        </label>
        {!club && (
          <>
            <label>
              Club name
              <input name="name" required maxLength={80} />
            </label>
            <label>
              Club web address
              <input
                name="slug"
                required
                minLength={3}
                maxLength={48}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder="e.g. park-paws"
              />
              <small>
                Used in /club/your-club and fixed after the club is created.
              </small>
            </label>
            <label>
              Location
              <input name="location" required maxLength={120} />
            </label>
            <label>
              Welcome tagline
              <input name="tagline" required maxLength={160} />
            </label>
          </>
        )}
      </fieldset>
      <p>
        Expires after 72 hours. Share privately with the invited person. No
        email is sent automatically.
      </p>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state.token && (
        <div role="status">
          <p>
            Invitation ready. This link is shown only here; issue a new
            invitation if you lose it.
          </p>
          <label>
            Private invitation link
            <input
              readOnly
              value={`${origin}/join#${state.token}`}
              onFocus={(e) => e.target.select()}
            />
          </label>
        </div>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Creating…" : "Create invitation"}
      </button>
    </form>
  );
}
export function AcceptInvitation({ email }: { email?: string }) {
  const [token, setToken] = useState("");
  useEffect(() => {
    setToken(window.location.hash.slice(1));
  }, []);
  const [state, action, pending] = useActionState(acceptAction, {});
  return (
    <form action={action} className="profile-form">
      <fieldset disabled={pending} className="editor-fields">
        <label>
          Invitation code
          <input
            name="token"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
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
            readOnly={!!email}
          />
        </label>
        {!email && (
          <label>
            Create password
            <input
              type="password"
              name="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
            <small>
              At least 12 characters. Already have an account? Sign in first,
              then return to your invitation.
            </small>
          </label>
        )}
      </fieldset>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state.success && <p role="status">{state.success}</p>}
      <button className="button" disabled={pending}>
        {pending ? "Joining…" : "Accept invitation"}
      </button>
    </form>
  );
}
