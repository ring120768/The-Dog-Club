import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { isPlatformOwner } from "@/lib/branding";
import { database } from "@/lib/database";
import { recoveryRequestsForPlatform } from "@/lib/recovery";
import { RecoverySupportControls } from "@/components/recovery-forms";
import { recoveryEmailConfigurationStatus } from "@/lib/recovery-email";
import { isDemoMode } from "@/lib/runtime";

const displayDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));

export default async function PlatformRecoveryPage() {
  const account = await requireAccount();
  const db = await database();
  if (!(await isPlatformOwner(db, account.id))) notFound();
  const requests = await recoveryRequestsForPlatform(db, account.id);
  const emailStatus = isDemoMode()
    ? "disabled"
    : recoveryEmailConfigurationStatus();
  return (
    <main className="platform-main">
      <Link className="inline-link" href="/platform">
        ← Platform console
      </Link>
      <div className="platform-heading">
        <div>
          <span className="eyebrow">ACCOUNT RECOVERY</span>
          <h1>Private support queue.</h1>
          <p>
            {emailStatus === "configured"
              ? "Configured requests are sent to the account’s stored email. Provider acceptance is recorded here; it is not proof that the message reached the inbox."
              : "Verify the requester through your agreed support process before sharing a one-time link. Never send it in a public channel."}
          </p>
          {emailStatus === "invalid" && (
            <p className="error" role="alert">
              Recovery email configuration is invalid. Requests will remain in
              the manual support queue until it is corrected.
            </p>
          )}
        </div>
      </div>
      <div className="operator-grid">
        {requests.map((request) => {
          const completed = Boolean(request.consumed_at);
          const dismissed = Boolean(request.dismissed_at);
          const expired =
            Boolean(request.expires_at) &&
            new Date(request.expires_at!).getTime() <= Date.now();
          const closed = completed || dismissed;
          return (
            <article className="operator-card" key={request.id}>
              <div>
                <h2>{request.email}</h2>
                <p>Requested {displayDate(request.requested_at)}</p>
                <small>
                  {completed
                    ? "Password reset completed"
                    : dismissed
                      ? "Request dismissed"
                      : expired
                        ? "Recovery link expired — a new one can be issued"
                        : request.delivery_status === "provider_accepted"
                          ? `Email accepted by ${request.delivery_provider ?? "provider"}`
                          : request.delivery_status === "failed"
                            ? "Email failed — manual support required"
                            : request.delivery_status === "pending"
                              ? "Email delivery pending"
                              : request.handled_at
                                ? "Manual recovery link issued"
                                : "Awaiting verification"}
                </small>
              </div>
              {!closed && <RecoverySupportControls requestId={request.id} />}
            </article>
          );
        })}
        {!requests.length && (
          <div className="empty-card">
            <h2>No recovery requests.</h2>
            <p>
              New requests will appear here without exposing account status.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
