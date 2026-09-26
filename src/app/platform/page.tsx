import Link from "next/link";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { platformClubs } from "@/lib/branding";
import { operatorReadinessForPlatform } from "@/lib/operator-readiness";
import { ClubMark } from "@/components/club-mark";
export default async function PlatformHome() {
  const account = await requireAccount();
  const db = await database();
  const clubs = await platformClubs(db, account.id);
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
          <Link className="inline-link" href="/platform/recovery">
            Recovery requests
          </Link>
          <Link className="button" href="/platform/invitations">
            Invite an operator +
          </Link>
        </div>
      </div>
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
