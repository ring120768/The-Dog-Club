import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { platformClubs } from "@/lib/branding";
import { database } from "@/lib/database";
import { demoGuideFor } from "@/lib/demo-guide";
import { operatorReadinessForPlatform } from "@/lib/operator-readiness";
import { isDemoMode } from "@/lib/runtime";

export default async function PlatformDemoGuide({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  if (!isDemoMode()) notFound();
  const account = await requireAccount();
  const db = await database();
  const clubs = await platformClubs(db, account.id);
  if (!clubs.length) notFound();
  const requested = (await searchParams).club;
  const selected =
    clubs.find((club) => club.slug === requested) ??
    clubs.find((club) => club.slug === "willow") ??
    clubs[0];
  const [guide, readiness] = await Promise.all([
    demoGuideFor(db, account.id, selected.id),
    operatorReadinessForPlatform(db, account.id, [selected.id]),
  ]);
  const member = guide.accounts.find((item) => item.role === "member");
  const manager = guide.accounts.find((item) => item.role === "manager");
  const ready = readiness[0]?.ready ?? false;
  const steps = [
    {
      actor: "Platform owner",
      title: "Start from a clean club",
      detail:
        "Return to Operators and use Reset demo activity for this club. Its branding, dogs, memberships and operational setup stay in place.",
      href: "/platform",
      link: "Open operators",
    },
    {
      actor: member?.email ?? "Demo member",
      title: "Introduce the member app",
      detail: `Open the iOS/Android shell, use server http://127.0.0.1:3100 and sign in with the shared demo password. Show membership, upcoming bookings and the dog profile audience control.`,
    },
    {
      actor: member?.email ?? "Demo member",
      title: "Book and demonstrate payment",
      detail:
        "Choose an approved dog, a grooming service and a live slot. Accept the cancellation terms, open the clearly labelled payment wall and complete the simulated payment.",
    },
    {
      actor: manager?.email ?? "Demo manager",
      title: "Show the manager diary",
      detail:
        "Sign in as the club manager and show the confirmed appointment, staffing and station allocation.",
      href: `/club/${guide.club.slug}/bookings`,
      link: "Open bookings",
    },
    {
      actor: manager?.email ?? "Demo manager",
      title: "Run the grooming visit",
      detail:
        "Move the appointment through arrival, handover, grooming, ready notification and verified collection.",
      href: `/club/${guide.club.slug}/operations`,
      link: "Open operations",
    },
    {
      actor: member?.email ?? "Demo member",
      title: "Close with member control",
      detail:
        "Return to the member app to show the updated booking state, then explain that future appointments can be moved or cancelled with credit restoration.",
    },
  ];

  return (
    <main className="platform-main demo-guide-page">
      <div className="platform-heading">
        <div>
          <span className="eyebrow">LOCAL SALES DEMONSTRATION</span>
          <h1>Tell one complete story.</h1>
          <p>
            A repeatable member-to-manager walkthrough for {guide.club.name}.
          </p>
        </div>
        <Link className="inline-link" href="/platform">
          ← Back to operators
        </Link>
      </div>

      <nav className="demo-guide-clubs" aria-label="Choose demo club">
        {clubs.map((club) => (
          <Link
            className={club.id === selected.id ? "active" : ""}
            href={`/platform/demo?club=${club.slug}`}
            key={club.id}
          >
            {club.name}
          </Link>
        ))}
      </nav>

      <section className="demo-guide-overview" aria-label="Demo readiness">
        <div>
          <small>Operator setup</small>
          <strong>{ready ? "Ready" : "Needs setup"}</strong>
        </div>
        <div>
          <small>Dog profiles</small>
          <strong>{guide.state.dogs}</strong>
        </div>
        <div>
          <small>Bookings</small>
          <strong>{guide.state.bookings}</strong>
        </div>
        <div>
          <small>Completed demo payments</small>
          <strong>{guide.state.capturedPayments}</strong>
        </div>
        <div>
          <small>Grooming visits</small>
          <strong>{guide.state.groomingVisits}</strong>
        </div>
      </section>

      <aside className="demo-guide-credentials">
        <strong>Shared synthetic password</strong>
        <code>PawsTogether!26</code>
        <span>These accounts and records are fictional.</span>
      </aside>

      <ol className="demo-guide-steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="demo-step-number">{index + 1}</span>
            <div>
              <small>{step.actor}</small>
              <h2>{step.title}</h2>
              <p>{step.detail}</p>
              {step.href && (
                <Link className="inline-link" href={step.href}>
                  {step.link} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <p className="demo-guide-boundary">
        Payment is simulated and visibly labelled. Email, payroll, café POS and
        production Stripe remain outside this demonstration.
      </p>
    </main>
  );
}
