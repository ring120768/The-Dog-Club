"use client";
import { useActionState } from "react";
import {
  activateMembershipAction,
  cancelMembershipAction,
  createPlanAction,
  groomingCreditAction,
  membershipStateAction,
} from "@/app/membership-actions";

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

export function MembershipPlanForm({
  club,
  slug,
}: {
  club: string;
  slug: string;
}) {
  const [state, action, pending] = useActionState(
    createPlanAction.bind(null, club, slug),
    {},
  );
  return (
    <form action={action} className="membership-form membership-panel">
      <fieldset disabled={pending}>
        <label>
          Plan name
          <input name="name" required maxLength={100} placeholder="Care" />
        </label>
        <div className="field-pair">
          <label>
            Monthly price (£)
            <input
              name="monthly_price_pounds"
              required
              inputMode="decimal"
              pattern="\d{1,5}(\.\d{1,2})?"
              placeholder="39.00"
            />
          </label>
          <label>
            Grooming credits per period
            <input
              name="grooming_credits_per_period"
              type="number"
              min={0}
              max={100}
              defaultValue={0}
              required
            />
          </label>
        </div>
        <label>
          Inclusions
          <textarea name="inclusions" required maxLength={2000} />
        </label>
        <label>
          Limits
          <textarea name="limits_text" required maxLength={1000} />
        </label>
        <label>
          Additional-dog terms
          <textarea name="additional_dog_terms" required maxLength={1000} />
        </label>
        <label>
          Renewal terms
          <textarea name="renewal_terms" required maxLength={1000} />
        </label>
        <label>
          Cancellation terms
          <textarea name="cancellation_terms" required maxLength={1000} />
        </label>
        <label className="consent-check">
          <input type="checkbox" name="payment_issue_benefits" value="yes" />
          Keep benefits available while payment needs attention.
        </label>
      </fieldset>
      <Result state={state} />
      <button className="button" disabled={pending}>
        {pending ? "Creating…" : "Create plan"}
      </button>
    </form>
  );
}

export function DemoMembershipForm({
  club,
  slug,
  plans,
  accounts,
  start,
  end,
}: {
  club: string;
  slug: string;
  plans: { id: string; name: string }[];
  accounts: { id: string; email: string }[];
  start: string;
  end: string;
}) {
  const [state, action, pending] = useActionState(
    activateMembershipAction.bind(null, club, slug),
    {},
  );
  return (
    <form action={action} className="membership-form membership-panel">
      <fieldset disabled={pending || !plans.length || !accounts.length}>
        <label>
          Plan
          <select name="plan_id" required defaultValue="">
            <option value="" disabled>
              Choose plan
            </option>
            {plans.map((plan) => (
              <option value={plan.id} key={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Club account
          <select name="account_id" required defaultValue="">
            <option value="" disabled>
              Choose account
            </option>
            {accounts.map((account) => (
              <option value={account.id} key={account.id}>
                {account.email}
              </option>
            ))}
          </select>
        </label>
        <div className="field-pair">
          <label>
            Period starts
            <input
              name="period_starts_on"
              type="date"
              required
              defaultValue={start}
            />
          </label>
          <label>
            Period ends
            <input
              name="period_ends_on"
              type="date"
              required
              defaultValue={end}
            />
          </label>
        </div>
      </fieldset>
      <p className="demo-payment-note">
        Demo activation only. No payment is taken or marked as paid.
      </p>
      <Result state={state} />
      <button
        className="button"
        disabled={pending || !plans.length || !accounts.length}
      >
        {pending ? "Activating…" : "Activate demo membership"}
      </button>
    </form>
  );
}

export function CancelMembershipForm({
  club,
  slug,
  subscription,
}: {
  club: string;
  slug: string;
  subscription: string;
}) {
  const [state, action, pending] = useActionState(
    cancelMembershipAction.bind(null, club, slug, subscription),
    {},
  );
  return (
    <form action={action} className="membership-inline-form">
      <Result state={state} />
      <button className="button secondary" disabled={pending}>
        {pending ? "Scheduling…" : "Cancel at period end"}
      </button>
    </form>
  );
}

export function MembershipAdminForms({
  club,
  slug,
  subscription,
  idempotencyKey,
}: {
  club: string;
  slug: string;
  subscription: string;
  idempotencyKey: string;
}) {
  const [stateState, stateAction, statePending] = useActionState(
    membershipStateAction.bind(null, club, slug, subscription),
    {},
  );
  const [creditState, creditAction, creditPending] = useActionState(
    groomingCreditAction.bind(null, club, slug, subscription, idempotencyKey),
    {},
  );
  return (
    <div className="membership-admin-actions">
      <details>
        <summary>Change membership state</summary>
        <form action={stateAction} className="membership-inline-form">
          <label>
            New state
            <select name="state" required defaultValue="">
              <option value="" disabled>
                Choose state
              </option>
              <option value="active">Active</option>
              <option value="payment_issue">Payment issue</option>
              <option value="ended">Ended</option>
            </select>
          </label>
          <label>
            Reason
            <input name="reason" required minLength={3} maxLength={500} />
          </label>
          <Result state={stateState} />
          <button className="button secondary" disabled={statePending}>
            {statePending ? "Saving…" : "Save state"}
          </button>
        </form>
      </details>
      <details>
        <summary>Adjust grooming credits</summary>
        <form action={creditAction} className="membership-inline-form">
          <label>
            Entry type
            <select name="entry_type" required defaultValue="">
              <option value="" disabled>
                Choose type
              </option>
              <option value="redemption">Redemption</option>
              <option value="restoration">Restoration</option>
              <option value="adjustment">Manager adjustment</option>
            </select>
          </label>
          <label>
            Credit change
            <input
              name="delta"
              type="number"
              min={-100}
              max={100}
              required
              placeholder="-1 or 1"
            />
          </label>
          <label>
            Reason
            <input name="reason" required minLength={3} maxLength={500} />
          </label>
          <Result state={creditState} />
          <button className="button secondary" disabled={creditPending}>
            {creditPending ? "Saving…" : "Record credit change"}
          </button>
        </form>
      </details>
    </div>
  );
}
