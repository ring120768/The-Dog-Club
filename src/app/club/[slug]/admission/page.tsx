import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import { admissionDashboard, admissionPassLookup } from "@/lib/admissions";
import { membershipAccountsFor } from "@/lib/memberships";
import { OnboardingError } from "@/lib/onboarding";
import {
  AdmissionCheckInForm,
  AdmissionCheckOutForm,
  AdmissionSettingsForm,
  CreateAdmissionPassForm,
  DogAdmissionForm,
} from "@/components/admission-forms";

const displayTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));

const messages: Record<string, string> = {
  "pass-created": "Your private admission pass is ready.",
  "capacity-saved": "Venue capacity saved.",
  "eligibility-saved": "Dog admission decision saved with its audit record.",
  "checked-in": "Admission confirmed. Occupancy has been updated.",
  "checked-out": "Checkout recorded. Capacity is available again.",
};

export default async function AdmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pass?: string; admission?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  if (!club) notFound();
  const manager = club.role === "manager";
  const data = await admissionDashboard(db, account.id, club.id);
  const accounts = manager
    ? await membershipAccountsFor(db, account.id, club.id)
    : [];
  let lookup: Awaited<ReturnType<typeof admissionPassLookup>> | null = null;
  let lookupError = "";
  if (manager && query.pass) {
    try {
      lookup = await admissionPassLookup(db, account.id, club.id, query.pass);
    } catch (error) {
      lookupError =
        error instanceof OnboardingError
          ? error.message
          : "Enter a valid admission pass.";
    }
  }
  const emailFor = (id: string) =>
    accounts.find((item) => item.id === id)?.email ?? "Club member";

  return (
    <main className="club-main admission-page">
      {query.admission && messages[query.admission] && (
        <p className="success" role="status">
          {messages[query.admission]}
        </p>
      )}
      <span className="eyebrow">FRONT DOOR</span>
      <h1>{manager ? "Admission and capacity." : "Your club pass."}</h1>
      <p className="intro">
        {manager
          ? "Check membership, dog approval and live capacity before anyone enters."
          : "Show this private code to reception. It contains no profile or care information."}
      </p>

      {manager ? (
        <>
          <section className="admission-manager-grid">
            <div>
              <span className="eyebrow">OPERATOR-APPROVED LIMITS</span>
              <h2>Venue capacity</h2>
              <AdmissionSettingsForm
                club={club.id}
                slug={slug}
                humans={data.settings?.human_capacity ?? 0}
                dogs={data.settings?.dog_capacity ?? 0}
              />
            </div>
            <div>
              <span className="eyebrow">LIVE OCCUPANCY</span>
              <h2>Who is inside</h2>
              <div className="occupancy-card">
                <div>
                  <strong>{data.occupancy.humans}</strong>
                  <span>
                    humans / {data.settings?.human_capacity ?? "not set"}
                  </span>
                </div>
                <div>
                  <strong>{data.occupancy.dogs}</strong>
                  <span>dogs / {data.settings?.dog_capacity ?? "not set"}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="admission-section">
            <span className="eyebrow">RECEPTION</span>
            <h2>Look up a member pass</h2>
            <form method="get" className="pass-lookup admission-panel">
              <label>
                Admission pass
                <input
                  name="pass"
                  required
                  minLength={16}
                  maxLength={24}
                  defaultValue={query.pass ?? ""}
                  autoComplete="off"
                />
              </label>
              <button className="button">Look up</button>
            </form>
            {lookupError && <p className="error">{lookupError}</p>}
            {lookup && (
              <article className="pass-result">
                <div>
                  <span className="eyebrow">
                    {lookup.membershipUsable
                      ? "MEMBERSHIP VALID"
                      : "MEMBERSHIP NOT USABLE"}
                  </span>
                  <h3>{lookup.pass.email}</h3>
                  <p>Pass {lookup.pass.code.match(/.{1,4}/g)?.join(" ")}</p>
                </div>
                {lookup.activeVisitId ? (
                  <div>
                    <p className="success">This member is already inside.</p>
                    <AdmissionCheckOutForm
                      club={club.id}
                      slug={slug}
                      visit={lookup.activeVisitId}
                    />
                  </div>
                ) : (
                  <AdmissionCheckInForm
                    club={club.id}
                    slug={slug}
                    code={lookup.pass.code}
                    dogs={lookup.dogs}
                    disabled={!lookup.membershipUsable || !data.settings}
                  />
                )}
              </article>
            )}
          </section>

          <section className="admission-section">
            <span className="eyebrow">ACTIVITY-SPECIFIC REVIEW</span>
            <h2>Dog admission decisions</h2>
            <div className="admission-decision-list">
              {data.eligibilities.map((dog) => (
                <article key={dog.dog_id}>
                  <div>
                    <h3>{dog.dog_name}</h3>
                    <p>
                      {emailFor(dog.owner_id)} · {dog.status ?? "Not reviewed"}
                    </p>
                    {dog.reason && <small>{dog.reason}</small>}
                  </div>
                  <DogAdmissionForm
                    club={club.id}
                    slug={slug}
                    dog={dog.dog_id}
                    status={dog.status}
                  />
                </article>
              ))}
            </div>
          </section>

          <section className="admission-section">
            <span className="eyebrow">ACTIVE VISITS</span>
            <h2>Current admissions</h2>
            {!data.visits.some((visit) => visit.status === "active") && (
              <p>No one is currently checked in.</p>
            )}
            {data.visits
              .filter((visit) => visit.status === "active")
              .map((visit) => (
                <article className="active-admission" key={visit.id}>
                  <div>
                    <h3>{emailFor(visit.account_id)}</h3>
                    <p>
                      {visit.human_count} human
                      {visit.human_count === 1 ? "" : "s"} · {visit.dog_count}{" "}
                      dog{visit.dog_count === 1 ? "" : "s"}
                    </p>
                    <small>
                      {visit.dog_names || "No dogs"} · entered{" "}
                      {displayTime(visit.checked_in_at)}
                    </small>
                  </div>
                  <AdmissionCheckOutForm
                    club={club.id}
                    slug={slug}
                    visit={visit.id}
                  />
                </article>
              ))}
          </section>
        </>
      ) : (
        <>
          <section className="member-pass-card">
            <span className="eyebrow">
              {data.membershipUsable
                ? "MEMBERSHIP READY"
                : "MEMBERSHIP REQUIRED"}
            </span>
            {data.pass ? (
              <>
                <strong>{data.pass.code.match(/.{1,4}/g)?.join(" ")}</strong>
                <p>Reception uses this code to find your admission record.</p>
              </>
            ) : (
              <>
                <h2>Create your private pass</h2>
                <p>
                  The code identifies your account to signed-in reception staff
                  only.
                </p>
                <CreateAdmissionPassForm club={club.id} slug={slug} />
              </>
            )}
          </section>
          <section className="admission-section">
            <span className="eyebrow">YOUR DOGS</span>
            <h2>Club admission status</h2>
            <div className="admission-decision-list">
              {data.eligibilities.map((dog) => (
                <article key={dog.dog_id}>
                  <div>
                    <h3>{dog.dog_name}</h3>
                    <p>{dog.status ?? "Not reviewed"}</p>
                    {dog.reason && <small>{dog.reason}</small>}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="admission-section">
            <span className="eyebrow">VISIT HISTORY</span>
            <h2>Your admissions</h2>
            {!data.visits.length && <p>No club admissions recorded yet.</p>}
            {data.visits.map((visit) => (
              <article className="active-admission" key={visit.id}>
                <div>
                  <h3>
                    {visit.status === "active" ? "Inside now" : "Checked out"}
                  </h3>
                  <p>
                    {visit.human_count} human
                    {visit.human_count === 1 ? "" : "s"} · {visit.dog_count} dog
                    {visit.dog_count === 1 ? "" : "s"}
                  </p>
                  <small>
                    {visit.dog_names || "No dogs"} ·{" "}
                    {displayTime(visit.checked_in_at)}
                  </small>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
