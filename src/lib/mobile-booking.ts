import type { Db } from "./database";
import type { SubscriptionState } from "./membership-contract";
import { OnboardingError } from "./onboarding";

export type MobileBookingOptions = {
  dogs: {
    id: string;
    name: string;
    canUseMembershipCredits: boolean;
  }[];
  services: {
    id: string;
    name: string;
    durationMinutes: number;
    pricePence: number;
    cancellationTerms: string;
    membershipCreditEligible: boolean;
    membershipCreditCost: number;
  }[];
  membership: {
    remainingGroomingCredits: number;
    benefitsAvailable: boolean;
  } | null;
};

export async function mobileBookingOptionsFor(
  db: Db,
  actor: string,
  club: string,
): Promise<MobileBookingOptions> {
  return db.transaction(async (tx) => {
    const access = await tx.query(
      `SELECT 1 FROM memberships m
       JOIN clubs c ON c.id=m.club_id AND c.operator_state<>'closed'
       WHERE m.club_id=$1 AND m.account_id=$2`,
      [club, actor],
    );
    if (!access.rows.length) throw new OnboardingError("Club unavailable.");
    // This read mirrors requireEligibleDog. The application RLS policy grants
    // profile managers access, while booking-only household adults also need
    // this result. Explicit actor predicates keep the member response limited
    // to the signed-in household, including when the actor is a club manager.
    const [dogs, services, membership] = await Promise.all([
      tx.query<{
        id: string;
        name: string;
        owner_id: string;
      }>(
        `SELECT d.id,d.name,d.owner_id
         FROM dogs d
         JOIN clubs c ON c.id=d.club_id AND c.operator_state<>'closed'
         JOIN memberships m ON m.club_id=d.club_id AND m.account_id=d.owner_id
         JOIN dog_applications a ON a.club_id=d.club_id AND a.dog_id=d.id
          AND a.activity='grooming' AND a.status='approved'
         WHERE d.club_id=$1 AND (d.owner_id=$2 OR EXISTS(
          SELECT 1 FROM household_adult_grants h
          WHERE h.club_id=d.club_id AND h.owner_account_id=d.owner_id
          AND h.adult_account_id=$2 AND h.revoked_at IS NULL
          AND h.can_manage_bookings))
         ORDER BY d.name,d.id`,
        [club, actor],
      ),
      tx.query<{
        id: string;
        name: string;
        duration_minutes: number;
        price_pence: number;
        cancellation_terms: string;
        membership_credit_eligible: boolean;
        membership_credit_cost: number;
      }>(
        `SELECT id,name,duration_minutes,price_pence,cancellation_terms,
         membership_credit_eligible,membership_credit_cost
         FROM grooming_services
         WHERE club_id=$1 AND active
         ORDER BY name,id`,
        [club],
      ),
      tx.query<{
        state: SubscriptionState;
        payment_issue_benefits: boolean;
        remaining_grooming_credits: number;
      }>(
        `SELECT s.state,p.payment_issue_benefits,
         COALESCE((SELECT sum(l.delta) FROM benefit_ledger l
          WHERE l.club_id=s.club_id AND l.subscription_id=s.id
          AND l.benefit_code='grooming_credit'),0)::int AS remaining_grooming_credits
         FROM member_subscriptions s
         JOIN membership_plans p ON p.club_id=s.club_id AND p.id=s.plan_id
         WHERE s.club_id=$1 AND s.account_id=$2 AND s.state<>'ended'
         ORDER BY s.created_at DESC LIMIT 1`,
        [club, actor],
      ),
    ]);

    const currentMembership = membership.rows[0];
    const benefitsAvailable = Boolean(
      currentMembership &&
      (currentMembership.state === "active" ||
        currentMembership.state === "cancellation_scheduled" ||
        (currentMembership.state === "payment_issue" &&
          currentMembership.payment_issue_benefits)),
    );

    return {
      dogs: dogs.rows.map((dog) => ({
        id: dog.id,
        name: dog.name,
        canUseMembershipCredits: dog.owner_id === actor,
      })),
      services: services.rows.map((service) => ({
        id: service.id,
        name: service.name,
        durationMinutes: service.duration_minutes,
        pricePence: service.price_pence,
        cancellationTerms: service.cancellation_terms,
        membershipCreditEligible: service.membership_credit_eligible,
        membershipCreditCost: service.membership_credit_cost,
      })),
      membership: currentMembership
        ? {
            remainingGroomingCredits:
              currentMembership.remaining_grooming_credits,
            benefitsAvailable,
          }
        : null,
    };
  });
}
