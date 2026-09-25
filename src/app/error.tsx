"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="form-page">
      <h1>We couldn’t load that.</h1>
      <p>
        Please try again. If it continues, ask the local demo administrator to
        check the application.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
