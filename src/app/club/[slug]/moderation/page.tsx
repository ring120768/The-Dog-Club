import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import { moderationQueue } from "@/lib/community";
import {
  restoreCommunityAction,
  reviewCommunityAction,
} from "@/app/community-actions";

const londonDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));

export default async function ModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ review?: string }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug && item.role === "manager",
  );
  if (!club) notFound();
  const reports = await moderationQueue(db, account.id, club.id);
  const openReports = reports.filter((report) => report.status === "open");
  const reviewedReports = reports.filter((report) => report.status !== "open");
  const reviewAction = reviewCommunityAction.bind(null, slug);
  const restoreAction = restoreCommunityAction.bind(null, slug);
  const { review } = await searchParams;

  return (
    <main className="club-main moderation-page">
      {review && (
        <p
          className={review.includes("error") ? "error" : "success"}
          role="status"
        >
          {review === "saved"
            ? "The report decision and audit event were saved."
            : review === "restored"
              ? "The profile is visible again."
              : "That moderation change could not be saved."}
        </p>
      )}
      <span className="eyebrow">COMMUNITY SAFETY</span>
      <h1>Moderation queue.</h1>
      <p className="intro">
        Review member reports, record a reason and temporarily hide a profile
        when the club needs time to investigate.
      </p>

      <section className="moderation-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">NEEDS REVIEW</span>
            <h2>
              Open reports <span className="count">{openReports.length}</span>
            </h2>
          </div>
        </div>
        {openReports.length === 0 ? (
          <div className="empty-card">
            <h3>All clear.</h3>
            <p>There are no open community reports.</p>
          </div>
        ) : (
          <div className="moderation-list">
            {openReports.map((report) => (
              <article className="moderation-card" key={report.id}>
                <div>
                  <span className="eyebrow">
                    {report.photo_id ? "PHOTO" : "PROFILE"} REPORT
                  </span>
                  <h3>{report.dog_name}</h3>
                  <p>
                    <strong>{report.reason.replaceAll("_", " ")}</strong> ·{" "}
                    {londonDate(report.created_at)}
                  </p>
                  <p>{report.details || "No additional details supplied."}</p>
                </div>
                <form action={reviewAction} className="moderation-form">
                  <input type="hidden" name="reportId" value={report.id} />
                  <label>
                    Decision
                    <select name="decision" defaultValue="resolve">
                      <option value="resolve">Resolve, leave visible</option>
                      <option value="hide">Resolve and hide profile</option>
                      <option value="dismiss">Dismiss report</option>
                    </select>
                  </label>
                  <label>
                    Outcome and reason
                    <textarea
                      name="outcome"
                      required
                      maxLength={1000}
                      rows={3}
                    />
                  </label>
                  <button className="button" type="submit">
                    Save decision
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="moderation-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">AUDIT HISTORY</span>
            <h2>Reviewed reports</h2>
          </div>
        </div>
        {reviewedReports.length === 0 ? (
          <p>No reviewed reports yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dog</th>
                  <th>Decision</th>
                  <th>Outcome</th>
                  <th>Visibility</th>
                </tr>
              </thead>
              <tbody>
                {reviewedReports.map((report) => (
                  <tr key={report.id}>
                    <td>{report.dog_name}</td>
                    <td>{report.status}</td>
                    <td>{report.outcome}</td>
                    <td>
                      {report.moderation_hidden ? (
                        <form action={restoreAction} className="restore-form">
                          <input
                            type="hidden"
                            name="dogId"
                            value={report.dog_id}
                          />
                          <input
                            name="reason"
                            required
                            maxLength={1000}
                            aria-label={`Reason for restoring ${report.dog_name}`}
                            placeholder="Reason for restoring"
                          />
                          <button className="text-button" type="submit">
                            Restore
                          </button>
                        </form>
                      ) : (
                        "Visible"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
