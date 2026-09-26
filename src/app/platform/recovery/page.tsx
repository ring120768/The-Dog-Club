import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { isPlatformOwner } from "@/lib/branding";
import { database } from "@/lib/database";
import { recoveryRequestsForPlatform } from "@/lib/recovery";
import { RecoverySupportControls } from "@/components/recovery-forms";

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
            Verify the requester through your agreed support process before
            sharing a one-time link. Never send it in a public channel.
          </p>
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
                        ? "Link expired — a new one can be issued"
                        : request.handled_at
                          ? "Recovery link issued"
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
