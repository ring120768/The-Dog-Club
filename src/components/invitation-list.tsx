import { revokeAction } from "@/app/onboarding-actions";
export function InvitationList({
  items,
}: {
  items: {
    id: string;
    email: string;
    expires_at: string;
    accepted_at: string | null;
    revoked_at: string | null;
  }[];
}) {
  return (
    <section>
      <h2>Recent invitations</h2>
      {!items.length && <p>No invitations yet.</p>}
      {items.map((i) => (
        <article key={i.id}>
          <strong>{i.email}</strong>
          <p>
            {i.accepted_at
              ? "Accepted"
              : i.revoked_at
                ? "Revoked"
                : new Date(i.expires_at).getTime() < Date.now()
                  ? "Expired"
                  : "Awaiting acceptance"}{" "}
            · expires{" "}
            {new Date(i.expires_at).toLocaleString("en-GB", {
              timeZone: "Europe/London",
              hour12: false,
            })}
          </p>
          {!i.accepted_at && !i.revoked_at && (
            <form action={revokeAction.bind(null, i.id)}>
              <button className="text-button">Revoke invitation</button>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}
