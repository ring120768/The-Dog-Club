"use client";
import { useActionState } from "react";
import { applicationAction } from "@/app/onboarding-actions";
import type { Application } from "@/lib/applications";
export function ApplicationForm({
  club,
  dog,
  application,
  review = false,
}: {
  club: string;
  dog: string;
  application?: Application;
  review?: boolean;
}) {
  const [state, action, pending] = useActionState(
    applicationAction.bind(null, club, dog, review),
    {},
  );
  const status = application?.status ?? "draft";
  const choices: Record<string, string[]> = {
    pending: ["approved", "needs-information", "suspended"],
    approved: ["expired", "suspended"],
    expired: ["needs-information", "suspended"],
    suspended: ["needs-information"],
  };
  const editable = review
    ? !!choices[status]
    : ["draft", "needs-information"].includes(status);
  return (
    <section>
      <h2>Grooming application</h2>
      <p>
        Status: <strong>{status}</strong> · Grooming only; not a booking or
        admission pass.
      </p>
      {application?.reason && <p>Manager feedback: {application.reason}</p>}
      {application?.reviewed_at && (
        <p>
          Last reviewed{" "}
          {new Date(application.reviewed_at).toLocaleDateString("en-GB", {
            timeZone: "Europe/London",
          })}
        </p>
      )}
      {review && (
        <>
          <p>Emergency contact: {application?.emergency_contact}</p>
          <p>Handling needs: {application?.handling_notes}</p>
        </>
      )}
      {editable ? (
        <form className="profile-form" action={action}>
          <input
            type="hidden"
            name="version"
            value={application?.version ?? 0}
          />
          <fieldset className="editor-fields" disabled={pending}>
            {review ? (
              <>
                <label>
                  Decision
                  <select name="status">
                    {choices[status].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reason and member feedback
                  <textarea name="reason" required maxLength={1000} />
                </label>
              </>
            ) : (
              <>
                <label>
                  Emergency contact and phone
                  <input
                    name="emergency_contact"
                    required
                    minLength={3}
                    maxLength={200}
                    defaultValue={application?.emergency_contact}
                  />
                </label>
                <label>
                  Handling needs or sensitivities
                  <textarea
                    name="handling_notes"
                    required
                    maxLength={2000}
                    defaultValue={application?.handling_notes}
                  />
                  <small>
                    Write “none known” if appropriate. This information is
                    private to you and authorised club managers.
                  </small>
                </label>
              </>
            )}
          </fieldset>
          {state.error && (
            <p role="alert" className="error">
              {state.error}
            </p>
          )}
          {state.success && <p role="status">{state.success}</p>}
          {!review && (
            <button
              className="text-button"
              name="intent"
              value="draft"
              disabled={pending}
            >
              Save draft
            </button>
          )}
          <button
            className="button"
            name="intent"
            value="submit"
            disabled={pending}
          >
            {pending
              ? "Saving…"
              : review
                ? "Record decision"
                : "Submit for review"}
          </button>
        </form>
      ) : (
        <p>
          {status === "pending"
            ? "Your manager will review your application."
            : "Contact your manager if the care information or decision needs to change."}
        </p>
      )}
    </section>
  );
}
