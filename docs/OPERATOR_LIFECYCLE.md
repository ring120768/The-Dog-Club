# Operator lifecycle

The platform owner controls five audited states. A state change never deletes or silently changes memberships, bookings, payments or member benefits.

| State      | Tenant access                                                                            | Growth and commerce                                         | Records and export                                        |
| ---------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| Onboarding | Managers and invited staff configure the operator; members cannot enter                  | Staff setup is allowed; member invitations are blocked      | Platform owner can review configuration                   |
| Trial      | Normal access for a clearly labelled non-live trial                                      | Synthetic workflows are allowed                             | Synthetic records remain attributable to the operator     |
| Active     | Normal tenant access after explicit live-readiness confirmation                          | Live operation is permitted only after the external review  | Operational records remain attributable to the operator   |
| Restricted | Existing users retain access so paid services and outstanding obligations can be handled | New member and staff invitations are blocked                | Records are retained for continuity and controlled export |
| Closed     | Ordinary tenant and public-profile access is disabled                                    | No new invitations; closed is final in the current workflow | Records remain intact for platform-led export/offboarding |

Onboarding can move to trial only when all five operator-readiness checks pass. Moving to active also requires all five checks and an explicit acknowledgement that production, payments, support and operational readiness were reviewed outside the application. That acknowledgement is an audit control, not automated proof that every external system is safe.

Allowed transitions are onboarding → trial/closed; trial → onboarding/active/restricted/closed; active → restricted/closed; and restricted → active/closed. Closed operators cannot be silently reopened. Each event records actor, reason, prior state, new state and the readiness snapshot used at the time.

The current controlled-export wording describes the retention boundary. A packaged, permissioned export and tested restore procedure still need implementation before WL-08 or full offboarding can be called complete.
