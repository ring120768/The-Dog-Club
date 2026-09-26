import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { editableClub, isPlatformOwner } from "@/lib/branding";
import { paymentAccountFor } from "@/lib/stripe-memberships";
import { BrandForm } from "@/components/brand-form";
import { StripeAccountForm } from "@/components/stripe-account-form";
import { operatorReadinessForPlatform } from "@/lib/operator-readiness";
import { operatorLifecycleForPlatform } from "@/lib/operator-lifecycle";
import { OperatorLifecycleForm } from "@/components/operator-lifecycle-form";

export default async function Operator({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    saved?: string;
    created?: string;
    lifecycle?: string;
  }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  if (!(await isPlatformOwner(db, account.id))) notFound();
  const club = await editableClub(db, account.id, slug);
  if (!club) notFound();
  const [query, paymentAccount, readiness, lifecycle] = await Promise.all([
    searchParams,
    paymentAccountFor(db, club.id),
    operatorReadinessForPlatform(db, account.id, [club.id]).then(
      (items) => items[0],
    ),
    operatorLifecycleForPlatform(db, account.id, club.id),
  ]);
  return (
    <main className="platform-main">
      <Link className="inline-link" href="/platform">
        ← All clubs
      </Link>
      {(query.saved || query.created || query.lifecycle) && (
        <p className="success" role="status">
          {query.lifecycle
            ? "Operator lifecycle updated and recorded."
            : query.created
              ? "Club created and manager assigned. Their club access is ready."
              : "Club branding saved."}
        </p>
      )}
      <div className="platform-heading">
        <div>
          <span className="eyebrow">OPERATOR IDENTITY</span>
          <h1>{club.name}</h1>
          <p>
            /club/{club.slug} · Configuration version {club.version}
          </p>
        </div>
      </div>
      <section className="readiness-panel" aria-labelledby="readiness-heading">
        <div className="readiness-heading">
          <div>
            <span className="eyebrow">OPERATOR READINESS</span>
            <h2 id="readiness-heading">
              {readiness.ready
                ? "Ready for a demo walkthrough."
                : "Finish the operating setup."}
            </h2>
          </div>
          <strong>
            {readiness.complete}/{readiness.total}
          </strong>
        </div>
        <div className="readiness-list">
          {readiness.checks.map((check) => (
            <article
              key={check.key}
              className={check.complete ? "complete" : "incomplete"}
            >
              <span aria-hidden="true">{check.complete ? "✓" : "○"}</span>
              <div>
                <h3>{check.label}</h3>
                <p>{check.detail}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="readiness-note">
          This checklist proves a synthetic sales-demo journey. Payment-provider
          connection, production data, mobile-store release and live operational
          approval are separate gates.
        </p>
      </section>
      <OperatorLifecycleForm
        club={club.id}
        slug={club.slug}
        current={club.operator_state}
        events={lifecycle}
      />
      <section className="readiness-panel" aria-labelledby="export-heading">
        <div className="readiness-heading">
          <div>
            <span className="eyebrow">PORTABILITY &amp; OFFBOARDING</span>
            <h2 id="export-heading">Download a verified operator archive.</h2>
          </div>
        </div>
        <p className="readiness-note">
          The JSON archive contains this operator’s configuration and
          operational records, including dog photographs. Passwords, sessions,
          invitation and recovery tokens, admission pass codes, hosted Stripe
          URLs and raw payment webhooks are excluded. Restores require
          separately verified account identities.
        </p>
        <a
          className="button"
          href={`/api/platform/operators/${encodeURIComponent(club.id)}/export`}
          download
        >
          Download operator archive
        </a>
      </section>
      <BrandForm club={club} platform />
      <StripeAccountForm club={club.id} slug={slug} current={paymentAccount} />
    </main>
  );
}
