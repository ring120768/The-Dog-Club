import { PawPrint, ArrowUpRight } from "lucide-react";
import { loginAction } from "../actions";
import { DogAvatar } from "@/components/dog-avatar";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="wordmark">
          <PawPrint /> THE DOG CLUB
        </div>
        <span className="eyebrow">A LITTLE MORE TAIL-WAGGING</span>
        <h1>
          Their happy place.
          <br />
          <em>Yours, too.</em>
        </h1>
        <p>A club for muddy paws, good coffee and the people who love them.</p>
        <div className="avatar-pack">
          <DogAvatar large colour="sand" />
          <DogAvatar large colour="rose" />
          <DogAvatar large colour="sage" />
        </div>
        <div className="story-footer">
          GOOD DOGS. GREAT COMPANY. <ArrowUpRight size={20} />
        </div>
      </section>
      <section className="login-panel">
        <span className="badge">LOCAL DEMO · FICTIONAL CLUBS</span>
        <h2>Welcome to the pack.</h2>
        <p>Sign in to make yourself at home.</p>
        <form action={loginAction} className="profile-form">
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              defaultValue="alice@demo.invalid"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              defaultValue="PawsTogether!26"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              Unable to sign in. Check your details, or wait 15 minutes if you
              have tried several times.
            </p>
          )}
          <button className="button">
            Come on in <span>→</span>
          </button>
        </form>
        <details className="demo-accounts">
          <summary>Explore the demo accounts</summary>
          <p>
            Shared demo password: <code>PawsTogether!26</code>
          </p>
          <dl>
            <dt>Platform owner</dt><dd>owner@demo.invalid</dd>
              <dt>Willow member</dt>
            <dd>alice@demo.invalid</dd>
            <dt>Another Willow member</dt>
            <dd>bea@demo.invalid</dd>
            <dt>Willow manager</dt>
            <dd>manager@demo.invalid</dd>
            <dt>Coast & Canine member</dt>
            <dd>coast@demo.invalid</dd>
          </dl>
          <p>Synthetic records only. No payments or messages are sent.</p>
        </details>
      </section>
    </main>
  );
}
