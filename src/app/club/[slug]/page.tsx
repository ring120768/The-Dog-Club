import { photoUrl } from "@/lib/photo-contract";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ArrowUpRight, LockKeyhole, Users, Globe } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor, dogsFor } from "@/lib/dogs";
import { blockedCommunityAccounts, searchCommunityDogs } from "@/lib/community";
import {
  blockCommunityAction,
  reportCommunityAction,
  unblockCommunityAction,
} from "@/app/community-actions";
import { DogAvatar } from "@/components/dog-avatar";
export default async function ClubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string; q?: string; community?: string }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find((c) => c.slug === slug);
  if (!club) notFound();
  const dogs = await dogsFor(db, account.id, club.id);
  const mine = dogs.filter((d) => d.can_manage || d.can_book);
  const communityDogs = dogs.filter(
    (d) => !d.can_manage && !d.can_book && d.audience !== "private",
  );
  const blocked = await blockedCommunityAccounts(db, account.id, club.id);
  const { saved, q = "", community: communityMessage } = await searchParams;
  const community = searchCommunityDogs(communityDogs, q);
  const reportAction = reportCommunityAction.bind(null, slug);
  const blockAction = blockCommunityAction.bind(null, slug);
  const unblockAction = unblockCommunityAction.bind(null, slug);
  return (
    <main className="club-main">
      {saved && (
        <p className="success" role="status">
          Profile saved. Your visibility choice is now applied.
        </p>
      )}
      <section className="welcome">
        <div>
          <span className="eyebrow">YOUR CLUB. YOUR PEOPLE. YOUR PACK.</span>
          <h1>
            Life’s better
            <br />
            with <em>good company.</em>
          </h1>
          <p>
            A familiar face, a wagging tail, a place to belong.
            <br />
            {club.tagline}
          </p>
          <Link className="button light" href={`/club/${slug}/dogs/new`}>
            Introduce your dog <Plus size={18} />
          </Link>
        </div>
        <div className="hero-dog">
          <DogAvatar large colour={club.avatar_tone} />
          <span className="hero-note">All paws welcome.</span>
          <span className="orbit">✦</span>
        </div>
      </section>
      <section className="section-heading" id="dogs">
        <div>
          <span className="eyebrow">THE IMPORTANT MEMBERS</span>
          <h2>
            Your little pack <span className="count">{mine.length}</span>
          </h2>
        </div>
        <Link href={`/club/${slug}/dogs/new`} className="inline-link">
          <Plus size={16} />
          Add a dog
        </Link>
      </section>
      <div className="dog-grid">
        {mine.map((dog) => (
          <article className="dog-card" key={dog.id}>
            <DogAvatar
              colour={dog.avatar}
              name={dog.name}
              photoSrc={
                dog.photo_id
                  ? photoUrl("members", club.id, dog.id, dog.photo_id)
                  : undefined
              }
            />
            <div className="dog-info">
              <span className="dog-breed">{dog.breed || "One of a kind"}</span>
              <h3>{dog.name}</h3>
              <p>{dog.bio || "A personality worth getting to know."}</p>
              <div className="card-bottom">
                <span className="audience">
                  {dog.audience === "private" ? (
                    <LockKeyhole size={14} />
                  ) : dog.audience === "members" ? (
                    <Users size={14} />
                  ) : (
                    <Globe size={14} />
                  )}{" "}
                  {dog.audience === "private"
                    ? "Just us"
                    : dog.audience === "members"
                      ? "Our club"
                      : "Public"}
                </span>
                {dog.can_manage && (
                  <Link href={`/club/${slug}/dogs/${dog.id}`}>
                    Edit profile <ArrowUpRight size={16} />
                  </Link>
                )}
              </div>
              {dog.can_manage && (
                <Link
                  className="public-link"
                  href={`/club/${slug}/applications/${dog.id}`}
                >
                  Grooming application →
                </Link>
              )}
              {dog.can_book && (
                <Link
                  className="public-link"
                  href={`/club/${slug}/bookings?dog=${dog.id}`}
                >
                  Book grooming →
                </Link>
              )}
              {dog.audience === "public" && (
                <Link className="public-link" href={`/p/${slug}/${dog.id}`}>
                  Open public profile ↗
                </Link>
              )}
            </div>
          </article>
        ))}
        {mine.length === 0 && (
          <div className="empty-card">
            <h3>Who’s joining the pack?</h3>
            <p>Add your first dog to give them a little corner of the club.</p>
            <Link href={`/club/${slug}/dogs/new`}>Create a profile →</Link>
          </div>
        )}
      </div>
      <section className="community" id="community">
        <div>
          <span className="eyebrow">FAMILIAR SNIFFS</span>
          <h2>Meet the neighbours.</h2>
          <p>
            Dog-first introductions, with their humans’ details kept private.
          </p>
          <form className="community-search" method="get">
            <label htmlFor="community-dog-search">Search by dog name</label>
            <div>
              <input
                id="community-dog-search"
                name="q"
                defaultValue={q}
                maxLength={60}
                placeholder="Try Mabel"
              />
              <button className="button" type="submit">
                Search
              </button>
            </div>
          </form>
          {q && (
            <p className="community-result-count">
              {community.length} {community.length === 1 ? "dog" : "dogs"} found
              {" · "}
              <Link href={`/club/${slug}#community`}>Clear search</Link>
            </p>
          )}
          {communityMessage && (
            <p
              className={
                communityMessage.includes("error") ? "error" : "success"
              }
              role="status"
            >
              {communityMessage === "reported"
                ? "Thanks. The club team can now review your report."
                : communityMessage === "blocked"
                  ? "That household is hidden from your member directory."
                  : communityMessage === "unblocked"
                    ? "The household is visible in your member directory again."
                    : "That change could not be saved. Please try again."}
            </p>
          )}
          {blocked.length > 0 && (
            <details className="blocked-households">
              <summary>Blocked households ({blocked.length})</summary>
              {blocked.map((item) => (
                <form action={unblockAction} key={item.blocked_account_id}>
                  <input
                    type="hidden"
                    name="accountId"
                    value={item.blocked_account_id}
                  />
                  <span>{item.display_label}</span>
                  <button className="text-button" type="submit">
                    Unblock
                  </button>
                </form>
              ))}
            </details>
          )}
        </div>
        <div className="neighbours">
          {community.map((dog) => (
            <article key={dog.id}>
              <DogAvatar
                colour={dog.avatar}
                name={dog.name}
                photoSrc={
                  dog.photo_id
                    ? photoUrl("members", club.id, dog.id, dog.photo_id)
                    : undefined
                }
              />
              <h3>{dog.name}</h3>
              <p>{dog.bio}</p>
              <details className="community-safety">
                <summary>Safety &amp; privacy</summary>
                <form action={reportAction}>
                  <input type="hidden" name="dogId" value={dog.id} />
                  <label>
                    Report
                    <select name="target" defaultValue="profile">
                      <option value="profile">Profile</option>
                      {dog.photo_id && (
                        <option value="photo">Current photo</option>
                      )}
                    </select>
                  </label>
                  <label>
                    Reason
                    <select name="reason" defaultValue="privacy">
                      <option value="privacy">Privacy concern</option>
                      <option value="unsafe_photo">Unsafe photo</option>
                      <option value="harassment">Harassment</option>
                      <option value="false_information">
                        False information
                      </option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Details (optional)
                    <textarea name="details" maxLength={1000} rows={3} />
                  </label>
                  <button className="text-button" type="submit">
                    Send report
                  </button>
                </form>
                <form action={blockAction}>
                  <input type="hidden" name="dogId" value={dog.id} />
                  <button className="text-button danger-text" type="submit">
                    Block this household
                  </button>
                  <small>
                    This hides both households in the member directory. Public
                    profile links can still be opened anonymously.
                  </small>
                </form>
              </details>
            </article>
          ))}
          {community.length === 0 && (
            <p>
              {q
                ? `No shared dog profiles match “${q.slice(0, 60)}”.`
                : "Your club’s shared profiles will appear here."}
            </p>
          )}
        </div>
      </section>
      <div className="coming-next">
        <span className="eyebrow">GROWING WITH YOUR CLUB</span>
        <p>Café services and payments are coming in later milestones.</p>
        <span>Not yet connected</span>
      </div>
    </main>
  );
}
