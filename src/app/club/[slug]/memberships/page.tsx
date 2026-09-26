import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import {
  membershipAccountsFor,
  plansFor,
  subscriptionsFor,
} from "@/lib/memberships";
import { subscriptionLabels } from "@/lib/membership-contract";
import {
  CancelMembershipForm,
  DemoMembershipForm,
  MembershipAdminForms,
  MembershipPlanForm,
} from "@/components/membership-forms";

const displayDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(value),
  );

const inputDate = (offsetDays: number) => {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString().slice(0, 10);
};

export default async function MembershipsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ membership?: string }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  if (!club) notFound();
  const manager = club.role === "manager";
  const [plans, membershipData, accounts] = await Promise.all([
    plansFor(db, account.id, club.id),
    subscriptionsFor(db, account.id, club.id),
    manager ? membershipAccountsFor(db, account.id, club.id) : [],
  ]);
  const result = (await searchParams).membership;
  const messages: Record<string, string> = {
    activated: "Demo membership activated. No payment was taken.",
    cancelled: "Cancellation scheduled for the recorded period end.",
    state: "Membership state updated and audited.",
    credits: "Grooming-credit ledger updated.",
  };
  return (
    <main className="club-main membership-page">
      {result && messages[result] && (
        <p className="success" role="status">
          {messages[result]}
        </p>
      )}
      <span className="eyebrow">MEMBERSHIP, MADE CLEAR</span>
      <h1>Plans and benefits.</h1>
      <p className="intro">
        See the price, inclusions, limits and cancellation terms together.
        Payments are not connected in this demo.
      </p>

      <section className="membership-plans">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE OPTIONS</span>
            <h2>Club plans</h2>
          </div>
        </div>
        {!plans.length && <p>No membership plans have been published yet.</p>}
        <div className="membership-plan-grid">
          {plans.map((plan) => (
            <article className="membership-plan-card" key={plan.id}>
              <span className="eyebrow">{plan.name}</span>
              <h3>£{(plan.monthly_price_pence / 100).toFixed(2)}</h3>
              <p>per month</p>
              <dl>
                <dt>Included</dt>
                <dd>{plan.inclusions}</dd>
                <dt>Limits</dt>
                <dd>{plan.limits_text}</dd>
                <dt>Grooming allowance</dt>
                <dd>{plan.grooming_credits_per_period} credits per period</dd>
                <dt>Additional dogs</dt>
                <dd>{plan.additional_dog_terms}</dd>
                <dt>Renewal</dt>
                <dd>{plan.renewal_terms}</dd>
                <dt>Cancellation</dt>
                <dd>{plan.cancellation_terms}</dd>
              </dl>
            </article>
          ))}
        </div>
      </section>

      {manager && (
        <section className="membership-manager-grid">
          <div>
            <span className="eyebrow">MANAGER SETUP</span>
            <h2>Create a plan</h2>
            <MembershipPlanForm club={club.id} slug={slug} />
          </div>
          <div>
            <span className="eyebrow">DEMO ENTITLEMENT</span>
            <h2>Assign a membership</h2>
            <DemoMembershipForm
              club={club.id}
              slug={slug}
              plans={plans}
              accounts={accounts}
              start={inputDate(0)}
              end={inputDate(30)}
            />
          </div>
        </section>
      )}

      <section className="membership-list">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {manager ? "CLUB MEMBERSHIPS" : "YOUR MEMBERSHIP"}
            </span>
            <h2>Current status</h2>
          </div>
        </div>
        {!membershipData.subscriptions.length && (
          <p>No current membership record.</p>
        )}
        {membershipData.subscriptions.map((subscription) => {
          const ledger = membershipData.ledger.filter(
            (entry) => entry.subscription_id === subscription.id,
          );
          const email = accounts.find(
            (item) => item.id === subscription.account_id,
          )?.email;
          return (
            <article className="membership-card" key={subscription.id}>
              <div className="membership-card-heading">
                <div>
                  <span className="eyebrow">
                    {subscriptionLabels[subscription.state]}
                  </span>
                  <h3>{subscription.plan_name}</h3>
                  {email && <p>{email}</p>}
                </div>
                <div className="credit-balance">
                  <strong>{subscription.remaining_grooming_credits}</strong>
                  <span>grooming credits</span>
                </div>
              </div>
              <p>
                Period: {displayDate(subscription.period_starts_on)} to{" "}
                {displayDate(subscription.period_ends_on)}
              </p>
              {subscription.cancellation_effective_on && (
                <p className="cancellation-date">
                  Cancellation takes effect on{" "}
                  {displayDate(subscription.cancellation_effective_on)}.
                </p>
              )}
              <p className="demo-payment-note">
                Demo entitlement · no payment-provider confirmation
              </p>
              <details className="benefit-history">
                <summary>Benefit history ({ledger.length})</summary>
                <ol>
                  {ledger.map((entry) => (
                    <li key={entry.id}>
                      {entry.delta > 0 ? "+" : ""}
                      {entry.delta} · {entry.entry_type} · {entry.reason}
                    </li>
                  ))}
                </ol>
              </details>
              {manager && subscription.state !== "ended" && (
                <MembershipAdminForms
                  club={club.id}
                  slug={slug}
                  subscription={subscription.id}
                  idempotencyKey={randomUUID()}
                />
              )}
              {["active", "payment_issue"].includes(subscription.state) && (
                <CancelMembershipForm
                  club={club.id}
                  slug={slug}
                  subscription={subscription.id}
                />
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
