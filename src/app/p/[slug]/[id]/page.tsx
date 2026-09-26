import { photoUrl } from "@/lib/photo-contract";
import { notFound } from "next/navigation";
import { ClubMark } from "@/components/club-mark";
import { database } from "@/lib/database";
import { publicDog, type Club } from "@/lib/dogs";
import { DogAvatar } from "@/components/dog-avatar";
import { isDemoMode } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default async function PublicProfile({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const db = await database();
  const club = (
    await db.query<Club>("SELECT * FROM clubs WHERE slug=$1", [slug])
  ).rows[0];
  if (!club) notFound();
  const dog = await publicDog(db, club.id, id);
  if (!dog) notFound();
  return (
    <main
      className="public-profile"
      style={{ "--brand": club.colour } as React.CSSProperties}
    >
      <div className="wordmark">
        <ClubMark emblem={club.emblem} />
        {club.name}
      </div>
      {isDemoMode() && <span className="badge">FICTIONAL DEMO PROFILE</span>}
      <DogAvatar
        large
        colour={dog.avatar}
        name={dog.name}
        photoSrc={
          dog.photo_id
            ? photoUrl("public", club.id, id, dog.photo_id)
            : undefined
        }
      />
      <span className="eyebrow">PLEASED TO SNIFF YOU</span>
      <h1>I’m {dog.name}.</h1>
      <p className="dog-breed">{dog.breed}</p>
      <p>{dog.bio}</p>
      <footer>
        Part of the pack at {club.name}.<br />
        Their human’s details stay private.
      </footer>
    </main>
  );
}
