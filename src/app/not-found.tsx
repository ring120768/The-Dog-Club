import Link from "next/link";
export default function NotFound() {
  return (
    <main className="form-page">
      <h1>This page isn’t available.</h1>
      <p>
        The profile may be private, or your account may not have access to this
        club.
      </p>
      <Link className="button" href="/">
        Back to your club
      </Link>
    </main>
  );
}
