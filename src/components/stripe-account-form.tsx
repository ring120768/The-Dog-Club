"use client";
import { useActionState } from "react";
import { configureStripeAccountAction } from "@/app/stripe-actions";

export function StripeAccountForm({
  club,
  slug,
  current,
}: {
  club: string;
  slug: string;
  current?: {
    external_account_id: string;
    status: string;
    charges_enabled: boolean;
    details_submitted: boolean;
  };
}) {
  const [state, action, pending] = useActionState(
    configureStripeAccountAction.bind(null, club, slug),
    {},
  );
  return (
    <section className="membership-panel stripe-connection-panel">
      <span className="eyebrow">PAYMENT SANDBOX</span>
      <h2>Stripe connected account</h2>
      <p>
        Verify a non-live connected account before a club can offer online
        membership checkout. The Stripe API supplies the readiness flags.
      </p>
      {current && (
        <p className="demo-payment-note">
          {current.external_account_id} · {current.status} · charges{" "}
          {current.charges_enabled ? "enabled" : "disabled"} · details{" "}
          {current.details_submitted ? "submitted" : "incomplete"}
        </p>
      )}
      <form action={action} className="membership-inline-form">
        <label>
          Connected-account ID
          <input
            name="stripe_account_id"
            required
            pattern="acct_[A-Za-z0-9_]+"
            defaultValue={current?.external_account_id ?? ""}
            placeholder="acct_…"
          />
        </label>
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
        <button className="button" disabled={pending}>
          {pending ? "Verifying…" : "Verify sandbox account"}
        </button>
      </form>
      <small>
        Automatic tax remains off until the operator confirms tax treatment and
        an active Stripe Tax registration.
      </small>
    </section>
  );
}
