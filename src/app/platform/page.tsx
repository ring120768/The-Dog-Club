import Link from "next/link";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { platformClubs } from "@/lib/branding";
import { operatorReadinessForPlatform } from "@/lib/operator-readiness";
import { ClubMark } from "@/components/club-mark";
import { operatorStatePolicy } from "@/lib/operator-lifecycle-contract";
import { isDemoMode } from "@/lib/runtime";
import { resetDemoActivityAction } from "./demo-actions";

export default async function PlatformHome({
  searchParams,
}: {
  searchParams: Promise<{
    reset?: string;
    club?: string;
    removed?: string;
  }>;
}) {
  const account = await requireAccount();
  const db = await database();
  const clubs = await platformClubs(db, account.id);
  const notice = await searchParams;
  const readiness = new Map(
    (
      await operatorReadinessForPlatform(
        db,
        account.id,
        clubs.map((club) => club.id),
      )
    ).map((item) => [item.club_id, item]),
  );
  return (
    <main className="platform-main">
      <div className="platform-heading">
        <div>
          <span className="eyebrow">
            ONE PLATFORM. EVERY CLUB’S PERSONALITY.
          </span>
          <h1>Room for another pack.</h1>
          <p>Set up operators and give each club its own identity.</p>
        </div>
        <div className="platform-actions">
          {isDemoMode() && (
            <Link className="inline-link" href="/platform/demo">
              Run guided demo
            </Link>
          )}
          <Link className="inline-link" href="/platform/recovery">
            Recovery requests
          </Link>
          <Link className="button" href="/platform/invitations">
            Invite an operator +
          </Link>
        </div>
      </div>
      {notice.reset === "complete" && (
        <p className="notice success" role="status">
          Demo activity reset for {notice.club}. Removed {notice.removed ?? "0"}{" "}
          transactional records; club setup was preserved.
        </p>
      )}
      {notice.reset === "confirmation-required" && (
        <p className="notice error" role="alert">
          Tick the confirmation box before resetting demo activity.
        </p>
      )}
      <div className="operator-grid">
        {clubs.map((club) => {
          const progress = readiness.get(club.id)!;
          return (
            <article className="operator-card" key={club.id}>
              <div
                className="operator-mark"
                style={{ background: club.colour }}
              >
                <ClubMark emblem={club.emblem} size={36} />
              </div>
              <div>
                <h2>{club.name}</h2>
                <p>{club.location}</p>
                <small>/club/{club.slug}</small>
                <span className={`operator-state state-${club.operator_state}`}>
                  {operatorStatePolicy[club.operator_state].label}
                </span>
                <span
                  className={`readiness-status ${progress.ready ? "ready" : "setup"}`}
                >
                  {progress.ready
                    ? "Demo ready"
                    : `${progress.complete}/${progress.total} setup checks`}
                </span>
              </div>
              <Link className="inline-link" href={`/platform/${club.slug}`}>
                Review operator →
              </Link>
              {isDemoMode() && (
                <details className="demo-reset">
                  <summary>Reset demo activity</summary>
                  <p>
                    Clears bookings, visits and simulated payments while
                    preserving this club’s setup.
                  </p>
                  <form action={resetDemoActivityAction}>
                    <input type="hidden" name="club" value={club.id} />
                    <label className="check-line">
                      <input
                        type="checkbox"
                        name="confirmation"
                        value="confirmed"
                      />
                      I understand this clears the fictional activity history.
                    </label>
                    <button className="text-button danger" type="submit">
                      Reset this demo club
                    </button>
                  </form>
                </details>
              )}
            </article>
          );
        })}
      </div>
      <div className="coming-next">
        <p>
          Operator setup, private invitations and per-club Stripe sandbox
          connection are available. Production merchant onboarding, custom
          domains and café service configuration remain on the roadmap.
        </p>
        <span>
          Private member and care records are not available in this console.
        </span>
      </div>
    </main>
  );
}
