import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor, dogsFor } from "@/lib/dogs";
import { applicationsFor } from "@/lib/applications";
import { ApplicationForm } from "@/components/application-form";
export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const a = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, a.id)).find((c) => c.slug === slug);
  if (!club) notFound();
  const dog = (await dogsFor(db, a.id, club.id)).find(
    (d) => d.id === id && (d.can_manage || club.role === "manager"),
  );
  if (!dog) notFound();
  const application = (await applicationsFor(db, a.id, club.id)).find(
    (d) => d.dog_id === id,
  );
  const review = club.role === "manager" && dog.owner_id !== a.id;
  return (
    <main className="form-page">
      <Link href={`/club/${slug}`}>← Back to club</Link>
      <h1>{dog.name}’s care application</h1>
      <ApplicationForm
        club={club.id}
        dog={dog.id}
        application={application}
        review={review}
      />
    </main>
  );
}
