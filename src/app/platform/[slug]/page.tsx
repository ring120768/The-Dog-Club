import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { editableClub, isPlatformOwner } from "@/lib/branding";
import { paymentAccountFor } from "@/lib/stripe-memberships";
import { BrandForm } from "@/components/brand-form";
import { StripeAccountForm } from "@/components/stripe-account-form";
import { operatorReadinessForPlatform } from "@/lib/operator-readiness";

export default async function Operator({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string; created?: string }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  if (!(await isPlatformOwner(db, account.id))) notFound();
  const club = await editableClub(db, account.id, slug);
  if (!club) notFound();
  const [query, paymentAccount, readiness] = await Promise.all([
    searchParams,
    paymentAccountFor(db, club.id),
    operatorReadinessForPlatform(db, account.id, [club.id]).then(
      (items) => items[0],
    ),
  ]);
  return (
    <main className="platform-main">
      <Link className="inline-link" href="/platform">
        ← All clubs
      </Link>
      {(query.saved || query.created) && (
        <p className="success" role="status">
          {query.created
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
      <BrandForm club={club} platform />
      <StripeAccountForm club={club.id} slug={slug} current={paymentAccount} />
    </main>
  );
}
