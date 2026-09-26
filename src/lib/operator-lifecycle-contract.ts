export const operatorStates = [
  "onboarding",
  "trial",
  "active",
  "restricted",
  "closed",
] as const;
export type OperatorState = (typeof operatorStates)[number];

export const operatorStatePolicy: Record<
  OperatorState,
  { label: string; access: string; export: string }
> = {
  onboarding: {
    label: "Onboarding",
    access:
      "Managers and invited staff can configure the operator; members cannot enter yet.",
    export: "Configuration can be reviewed by the platform owner.",
  },
  trial: {
    label: "Trial",
    access:
      "Normal tenant access is available for a clearly labelled non-live trial.",
    export: "Synthetic configuration remains attributable to this operator.",
  },
  active: {
    label: "Active",
    access:
      "Normal tenant access is available after an explicit live-readiness confirmation.",
    export: "Operational records remain attributable to the operator.",
  },
  restricted: {
    label: "Restricted",
    access:
      "Existing access and service obligations continue; new member and staff invitations are blocked.",
    export:
      "Records are retained for service continuity and controlled export.",
  },
  closed: {
    label: "Closed",
    access:
      "Ordinary tenant access is disabled; subscriptions and bookings are retained unchanged.",
    export:
      "Platform-led controlled export/offboarding is required before deletion.",
  },
};

export const operatorTransitions: Record<OperatorState, OperatorState[]> = {
  onboarding: ["trial", "closed"],
  trial: ["onboarding", "active", "restricted", "closed"],
  active: ["restricted", "closed"],
  restricted: ["active", "closed"],
  closed: [],
};

export type OperatorLifecycleEvent = {
  from_state: OperatorState;
  to_state: OperatorState;
  reason: string;
  created_at: string;
  actor_email: string;
};
