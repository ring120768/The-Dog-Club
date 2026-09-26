export const subscriptionStates = [
  "active",
  "payment_issue",
  "cancellation_scheduled",
  "ended",
] as const;

export type SubscriptionState = (typeof subscriptionStates)[number];

export const subscriptionLabels: Record<SubscriptionState, string> = {
  active: "Active",
  payment_issue: "Payment issue",
  cancellation_scheduled: "Cancellation scheduled",
  ended: "Ended",
};
