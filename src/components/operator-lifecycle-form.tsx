"use client";

import { useActionState, useState } from "react";
import { changeOperatorStateAction } from "@/app/operator-actions";
import {
  operatorStatePolicy,
  operatorTransitions,
  type OperatorLifecycleEvent,
  type OperatorState,
} from "@/lib/operator-lifecycle-contract";

export function OperatorLifecycleForm({
  club,
  slug,
  current,
  events,
}: {
  club: string;
  slug: string;
  current: OperatorState;
  events: OperatorLifecycleEvent[];
}) {
  const targets = operatorTransitions[current];
  const [target, setTarget] = useState<OperatorState>(targets[0] ?? current);
  const [state, action, pending] = useActionState(
    changeOperatorStateAction.bind(null, slug),
    {},
  );
  return (
    <section
      className="readiness-panel lifecycle-panel"
      aria-labelledby="lifecycle-heading"
    >
      <span className="eyebrow">OPERATOR LIFECYCLE</span>
      <h2 id="lifecycle-heading">{operatorStatePolicy[current].label}</h2>
      <p>{operatorStatePolicy[current].access}</p>
      <small>{operatorStatePolicy[current].export}</small>
      {current !== "closed" ? (
        <form action={action} className="lifecycle-form">
          <input type="hidden" name="club" value={club} />
          <label>
            Change state
            <select
              name="state"
              value={target}
              onChange={(event) =>
                setTarget(event.target.value as OperatorState)
              }
            >
              {targets.map((item) => (
                <option key={item} value={item}>
                  {operatorStatePolicy[item].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reason
            <textarea
              name="reason"
              required
              minLength={10}
              maxLength={500}
              rows={3}
            />
          </label>
          {target === "active" && (
            <label className="checkbox-row">
              <input type="checkbox" name="live_confirmation" value="yes" />
              External production, payments, support and operational readiness
              have been reviewed.
            </label>
          )}
          {state.error && (
            <p className="error" role="alert">
              {state.error}
            </p>
          )}
          <button className="button" disabled={pending}>
            {pending ? "Saving…" : "Record state change"}
          </button>
        </form>
      ) : (
        <p className="readiness-note">
          Closed is final in this workflow. Records remain retained for
          controlled export and offboarding.
        </p>
      )}
      {events.length > 0 && (
        <div className="lifecycle-history">
          <h3>Recent state history</h3>
          {events.map((event, index) => (
            <p key={`${event.created_at}-${index}`}>
              <strong>
                {operatorStatePolicy[event.from_state].label} →{" "}
                {operatorStatePolicy[event.to_state].label}
              </strong>
              <span>
                {event.reason} · {event.actor_email}
              </span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
