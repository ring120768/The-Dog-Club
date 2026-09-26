# Member-to-manager demonstration

## Preparation

1. Start the local server with `npm run dev`.
2. Sign in at `http://127.0.0.1:3100/login` as `owner@demo.invalid` using `PawsTogether!26`.
3. Open **Run guided demo**, choose the prepared operator and check that Operator setup reads **Ready**.
4. Return to Operators, expand **Reset demo activity**, tick the confirmation and reset that club.
5. Open the shared iOS/Android shell and set its server to `http://127.0.0.1:3100`.

Every account and record in this walkthrough is fictional. Do not enter customer information.

## Ten-minute story

### 1. Member value

Sign into the mobile shell using the member address shown by the guide and the shared password. Introduce the current membership, remaining grooming credits, upcoming appointments and the member's dog profile. Show how the owner chooses private, members-only or public visibility without exposing care notes or contact information.

### 2. Grooming booking

Choose an approved dog and grooming service, search a date with a published qualified rota, select a live slot and accept the cancellation terms. Explain that staff, station, service duration and clean-up time are checked together before capacity is offered.

For a cash-priced service, continue to the clearly labelled payment demonstration. Complete it and return to the app. Refresh payment status to show the confirmed booking. No card data or money is involved.

### 3. Club operation

Sign out and use the manager address shown by the guide. Open the booking diary and identify the appointment. In Operations, progress the visit through arrival, authorised handover, grooming, ready and verified collection. Point out the manual ready-contact fallback rather than claiming live push or SMS delivery.

### 4. Member control

Return to the member shell and show the updated appointment state. Explain that a future confirmed appointment can be moved atomically to another available slot or cancelled, and an applied whole grooming credit is restored once.

## Boundaries to state aloud

- The payment wall is a simulation and cannot charge anyone.
- Real Stripe sandbox acceptance remains outstanding.
- Ready-contact delivery is a manual fallback; email, SMS and push are not connected.
- Café POS, payroll submission and clocking are not part of this walkthrough.
- Native signing, secure persisted device sessions and App Store/Play Store release remain later gates.

End by switching to a second operator in the guide. Its branding and readiness change from configuration while tenant records remain separate.
