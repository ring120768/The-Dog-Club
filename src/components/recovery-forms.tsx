"use client";

import { useActionState, useEffect, useState } from "react";
import {
  completeRecoveryAction,
  dismissRecoveryAction,
  issueRecoveryLinkAction,
  requestRecoveryAction,
} from "@/app/recovery-actions";

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

export function RecoveryRequestForm() {
  const [state, action, pending] = useActionState(requestRecoveryAction, {});
  return (
    <form action={action} className="profile-form">
      <fieldset disabled={pending} className="editor-fields">
        <label>
          Account email
          <input name="email" type="email" required maxLength={254} />
        </label>
      </fieldset>
      <Result state={state} />
      <button className="button" disabled={pending}>
        {pending ? "Requesting…" : "Request password help"}
      </button>
    </form>
  );
}

export function RecoveryResetForm() {
  const [token, setToken] = useState("");
  useEffect(() => setToken(window.location.hash.slice(1)), []);
  const [state, action, pending] = useActionState(completeRecoveryAction, {});
  return (
    <form action={action} className="profile-form">
      <fieldset disabled={pending} className="editor-fields">
        <label>
          Recovery code
          <input
            name="token"
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
          />
        </label>
        <label>
          New password
          <input
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
          />
          <small>Use at least 12 characters.</small>
        </label>
        <label>
          Confirm new password
          <input
            name="confirm_password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
          />
        </label>
      </fieldset>
      <Result state={state} />
      <button className="button" disabled={pending || !token}>
        {pending ? "Resetting…" : "Set new password"}
      </button>
    </form>
  );
}

export function RecoverySupportControls({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(
    issueRecoveryLinkAction.bind(null, requestId),
    {},
  );
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <div className="profile-form">
      <form action={action}>
        <Result state={state} />
        {state.token && (
          <label>
            Private 30-minute recovery link
            <input
              readOnly
              value={`${origin}/reset#${state.token}`}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
        )}
        <button className="button" disabled={pending}>
          {pending ? "Creating…" : "Create one-time link"}
        </button>
      </form>
      <form action={dismissRecoveryAction.bind(null, requestId)}>
        <button className="text-button">Dismiss request</button>
      </form>
    </div>
  );
}
