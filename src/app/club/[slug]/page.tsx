import { photoUrl } from "@/lib/photo-contract";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ArrowUpRight, LockKeyhole, Users, Globe } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor, dogsFor } from "@/lib/dogs";
import { DogAvatar } from "@/components/dog-avatar";
export default async function ClubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find((c) => c.slug === slug);
  if (!club) notFound();
  const dogs = await dogsFor(db, account.id, club.id);
  const mine = dogs.filter((d) => d.owner_id === account.id);
  const community = dogs.filter(
    (d) => d.owner_id !== account.id && d.audience !== "private",
  );
  const { saved } = await searchParams;
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
                <Link href={`/club/${slug}/dogs/${dog.id}`}>
                  Edit profile <ArrowUpRight size={16} />
                </Link>
              </div>
              <Link
                className="public-link"
                href={`/club/${slug}/applications/${dog.id}`}
              >
                Grooming application →
              </Link>
              <Link
                className="public-link"
                href={`/club/${slug}/bookings?dog=${dog.id}`}
              >
                Book grooming →
              </Link>
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
      <section className="community">
        <div>
          <span className="eyebrow">FAMILIAR SNIFFS</span>
          <h2>Meet the neighbours.</h2>
          <p>
            Dog-first introductions, with their humans’ details kept private.
          </p>
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
            </article>
          ))}
          {community.length === 0 && (
            <p>Your club’s shared profiles will appear here.</p>
          )}
        </div>
      </section>
      <div className="coming-next">
        <span className="eyebrow">GROWING WITH YOUR CLUB</span>
        <p>
          Memberships, café services and payments are coming in later
          milestones.
        </p>
        <span>Not yet connected</span>
      </div>
    </main>
  );
}
