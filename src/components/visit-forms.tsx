"use client";
import { useActionState } from "react";
import {
  arriveAction,
  correctVisitAction,
  progressVisitAction,
  type VisitActionState,
} from "@/app/visit-actions";
import {
  visitLabels,
  visitStatuses,
  type VisitStatus,
} from "@/lib/visit-contract";

async function noVisitAction(
  _state: VisitActionState,
  _form: FormData,
): Promise<VisitActionState> {
  return {};
}

function ErrorMessage({ error }: { error?: string }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}

export function ArrivalForm({
  club,
  slug,
  booking,
}: {
  club: string;
  slug: string;
  booking: string;
}) {
  const [state, action, pending] = useActionState(
    arriveAction.bind(null, club, slug, booking),
    {},
  );
  return (
    <form action={action}>
      <ErrorMessage error={state.error} />
      <button className="button" disabled={pending}>
        {pending ? "Checking in…" : "Mark arrived"}
      </button>
    </form>
  );
}

export function VisitProgressForm({
  club,
  slug,
  visit,
  status,
  collector,
}: {
  club: string;
  slug: string;
  visit: string;
  status: VisitStatus;
  collector: string;
}) {
  const target: VisitStatus | null =
    status === "arrived"
      ? "handed_over"
      : status === "handed_over"
        ? "in_progress"
        : status === "in_progress"
          ? "ready"
          : status === "ready"
            ? "collected"
            : null;
  const [state, action, pending] = useActionState(
    target
      ? progressVisitAction.bind(null, club, slug, visit, target)
      : noVisitAction,
    {},
  );
  if (!target) return null;
  const button =
    target === "handed_over"
      ? "Record handover"
      : target === "in_progress"
        ? "Start groom"
        : target === "ready"
          ? "Mark ready"
          : "Complete collection";
  return (
    <form action={action} className="visit-action-form">
      {target === "handed_over" && (
        <label>
          Authorised collection adult
          <input
            name="collector_name"
            required
            minLength={2}
            maxLength={100}
            placeholder="Full name"
          />
        </label>
      )}
      {target === "collected" && (
        <label className="consent-check">
          <input
            type="checkbox"
            name="collector_verified"
            value="yes"
            required
          />
          I have matched the collecting adult to {collector}.
        </label>
      )}
      {target === "ready" && (
        <small>
          This records a manual-contact task. It does not send a message.
        </small>
      )}
      <ErrorMessage error={state.error} />
      <button className="button" disabled={pending}>
        {pending ? "Saving…" : button}
      </button>
    </form>
  );
}

export function VisitCorrectionForm({
  club,
  slug,
  visit,
  status,
}: {
  club: string;
  slug: string;
  visit: string;
  status: VisitStatus;
}) {
  const [state, action, pending] = useActionState(
    correctVisitAction.bind(null, club, slug, visit),
    {},
  );
  return (
    <details className="visit-correction">
      <summary>Correct visit state</summary>
      <form action={action} className="visit-action-form">
        <label>
          Correct state
          <select name="status" required defaultValue="">
            <option value="" disabled>
              Choose state
            </option>
            {visitStatuses
              .filter((item) => item !== status && item !== "collected")
              .map((item) => (
                <option value={item} key={item}>
                  {visitLabels[item]}
                </option>
              ))}
          </select>
        </label>
        <label>
          Reason for correction
          <input name="reason" required minLength={3} maxLength={500} />
        </label>
        <small>Corrections remain visible in the visit history.</small>
        <ErrorMessage error={state.error} />
        <button className="button secondary" disabled={pending}>
          {pending ? "Correcting…" : "Save correction"}
        </button>
      </form>
    </details>
  );
}
