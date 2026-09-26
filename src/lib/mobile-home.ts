import { scoped, type Db } from "./database";
import type { SubscriptionState } from "./membership-contract";

export type MobileMemberHome = {
  membership: {
    planName: string;
    state: SubscriptionState;
    monthlyPricePence: number;
    inclusions: string;
    limits: string;
    remainingGroomingCredits: number;
    benefitsAvailable: boolean;
    periodEndsOn: string;
    cancellationEffectiveOn: string | null;
  } | null;
  upcomingBookings: {
    id: string;
    dogId: string;
    serviceId: string;
    dogName: string;
    serviceName: string;
    startsAt: string;
    amountDuePence: number;
    groomingCreditsApplied: number;
    paymentState: "membership_credit" | "paid" | "due";
  }[];
};

export async function mobileMemberHomeFor(
  db: Db,
  actor: string,
  club: string,
): Promise<MobileMemberHome> {
  return scoped(db, actor, club, false, async (tx) => {
    // Keep the actor predicates even though RLS is active: a manager using the
    // member client must never receive another household's commercial record.
    const membership = (
      await tx.query<{
        plan_name: string;
        state: SubscriptionState;
        monthly_price_pence: number;
        inclusions: string;
        limits_text: string;
        remaining_grooming_credits: number;
        payment_issue_benefits: boolean;
        period_ends_on: string;
        cancellation_effective_on: string | null;
      }>(
        `SELECT p.name AS plan_name,s.state,p.monthly_price_pence,p.inclusions,p.limits_text,
         p.payment_issue_benefits,s.period_ends_on,s.cancellation_effective_on,
         COALESCE((SELECT sum(l.delta) FROM benefit_ledger l
          WHERE l.club_id=s.club_id AND l.subscription_id=s.id
          AND l.benefit_code='grooming_credit'),0)::int AS remaining_grooming_credits
         FROM member_subscriptions s
         JOIN membership_plans p ON p.club_id=s.club_id AND p.id=s.plan_id
         WHERE s.club_id=$1 AND s.account_id=$2 AND s.state<>'ended'
         ORDER BY s.created_at DESC LIMIT 1`,
        [club, actor],
      )
    ).rows[0];
    const bookings = (
      await tx.query<{
        id: string;
        dog_id: string;
        service_id: string;
        dog_name: string;
        service_name: string;
        starts_at: string;
        amount_due_pence_snapshot: number;
        grooming_credits_applied: number;
        payment_state: "membership_credit" | "paid" | "due";
      }>(
        `SELECT b.id,b.dog_id,b.service_id,d.name AS dog_name,s.name AS service_name,b.starts_at,
         b.amount_due_pence_snapshot,b.grooming_credits_applied,
         CASE
           WHEN b.grooming_credits_applied>0 THEN 'membership_credit'
           WHEN EXISTS(
             SELECT 1 FROM booking_events be
             WHERE be.club_id=b.club_id AND be.booking_id=b.id
             AND be.action='booking.payment_confirmed'
           ) THEN 'paid'
           ELSE 'due'
         END AS payment_state
         FROM grooming_bookings b
         JOIN dogs d ON d.club_id=b.club_id AND d.id=b.dog_id
         JOIN grooming_services s ON s.club_id=b.club_id AND s.id=b.service_id
         WHERE b.club_id=$1 AND b.status='confirmed' AND b.starts_at>=now()
         AND (d.owner_id=$2 OR EXISTS(
           SELECT 1 FROM household_adult_grants h
           WHERE h.club_id=d.club_id AND h.owner_account_id=d.owner_id
           AND h.adult_account_id=$2 AND h.revoked_at IS NULL
           AND h.can_manage_bookings))
         ORDER BY b.starts_at,b.id LIMIT 5`,
        [club, actor],
      )
    ).rows;

    const benefitsAvailable = Boolean(
      membership &&
      (membership.state === "active" ||
        membership.state === "cancellation_scheduled" ||
        (membership.state === "payment_issue" &&
          membership.payment_issue_benefits)),
    );
    return {
      membership: membership
        ? {
            planName: membership.plan_name,
            state: membership.state,
            monthlyPricePence: membership.monthly_price_pence,
            inclusions: membership.inclusions,
            limits: membership.limits_text,
            remainingGroomingCredits: membership.remaining_grooming_credits,
            benefitsAvailable,
            periodEndsOn: membership.period_ends_on,
            cancellationEffectiveOn: membership.cancellation_effective_on,
          }
        : null,
      upcomingBookings: bookings.map((booking) => ({
        id: booking.id,
        dogId: booking.dog_id,
        serviceId: booking.service_id,
        dogName: booking.dog_name,
        serviceName: booking.service_name,
        startsAt: booking.starts_at,
        amountDuePence: booking.amount_due_pence_snapshot,
        groomingCreditsApplied: booking.grooming_credits_applied,
        paymentState: booking.payment_state,
      })),
    };
  });
}
