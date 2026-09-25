import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor, dogsFor } from "@/lib/dogs";
import { DogForm } from "@/components/dog-form";
export default async function EditDog({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find((c) => c.slug === slug);
  if (!club) notFound();
  const dog =
    id === "new"
      ? undefined
      : (await dogsFor(db, account.id, club.id)).find(
          (d) => d.id === id && d.owner_id === account.id,
        );
  if (id !== "new" && !dog) notFound();
  return (
    <main className="form-page">
      <Link className="inline-link" href={`/club/${slug}`}>
        ← Back to the pack
      </Link>
      <span className="eyebrow">A FACE EVERYONE WILL REMEMBER</span>
      <h1>{dog ? `A little more ${dog.name}.` : "Meet your newest member."}</h1>
      <p>Let their personality do the talking. You choose who sees it.</p>
      <DogForm club={slug} dog={dog} />
    </main>
  );
}
