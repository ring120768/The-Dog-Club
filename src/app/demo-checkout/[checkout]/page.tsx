import { notFound } from "next/navigation";
import { database } from "@/lib/database";
import { demoServiceCheckoutFor } from "@/lib/demo-service-payments";
import { isDemoMode } from "@/lib/runtime";
import { finishDemoServicePayment } from "./actions";

const londonDateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Europe/London",
});

export default async function DemoCheckoutPage({
  params,
}: {
  params: Promise<{ checkout: string }>;
}) {
  if (!isDemoMode()) notFound();
  const { checkout: id } = await params;
  const checkout = await demoServiceCheckoutFor(await database(), id);
  if (!checkout) notFound();
  const active = checkout.status === "open";
  const pay = finishDemoServicePayment.bind(null, checkout.id, "paid");
  const fail = finishDemoServicePayment.bind(null, checkout.id, "failed");
  return (
    <main className="demo-checkout-page">
      <section className="demo-checkout-card" aria-labelledby="checkout-title">
        <div className="demo-checkout-brand">
          <span aria-hidden="true">🐾</span>
          <div>
            <strong>{checkout.clubName}</strong>
            <small>Secure demo checkout</small>
          </div>
        </div>
        <div className="demo-checkout-banner">
          DEMONSTRATION · NO MONEY OR CARD DATA
        </div>
        <h1 id="checkout-title">
          {active ? "Complete your booking" : "Checkout updated"}
        </h1>
        <p className="demo-checkout-intro">
          {active
            ? "Your grooming appointment is held while you complete this demonstration payment."
            : checkout.status === "confirmed"
              ? "Demo payment complete. Your grooming appointment is confirmed."
              : checkout.status === "failed"
                ? "The demo payment was declined and the appointment hold was released."
                : checkout.status === "late_paid"
                  ? "The demo payment arrived after the hold expired. The club would contact the member."
                  : "The appointment hold has expired. Return to the app to choose another time."}
        </p>
        <dl className="demo-checkout-summary">
          <div>
            <dt>Service</dt>
            <dd>{checkout.serviceName}</dd>
          </div>
          <div>
            <dt>Dog</dt>
            <dd>{checkout.dogName}</dd>
          </div>
          <div>
            <dt>Appointment</dt>
            <dd>{londonDateTime.format(checkout.startsAt)}</dd>
          </div>
          <div className="demo-checkout-total">
            <dt>Total</dt>
            <dd>£{(checkout.amountPence / 100).toFixed(2)}</dd>
          </div>
        </dl>
        {active ? (
          <div className="demo-checkout-actions">
            <form action={pay}>
              <button className="button" type="submit">
                Complete demo payment
              </button>
            </form>
            <form action={fail}>
              <button className="text-button" type="submit">
                Simulate declined payment
              </button>
            </form>
          </div>
        ) : (
          <p className="demo-checkout-return">
            Close this window to return to The Dog Club app and refresh the
            booking status.
          </p>
        )}
        <small className="demo-checkout-disclaimer">
          This screen demonstrates the customer journey only. It does not ask
          for a card number and cannot charge anyone.
        </small>
      </section>
    </main>
  );
}
