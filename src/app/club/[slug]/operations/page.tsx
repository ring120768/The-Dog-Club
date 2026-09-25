import { DogAvatar } from "@/components/dog-avatar";
import { photoUrl } from "@/lib/photo-contract";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database, scoped } from "@/lib/database";
import { clubsFor, dogsFor } from "@/lib/dogs";
export default async function Operations({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find(
    (c) => c.slug === slug && c.role === "manager",
  );
  if (!club) notFound();
  const dogs = await dogsFor(db, account.id, club.id);
  const care = await scoped(
    db,
    account.id,
    club.id,
    false,
    async (tx) =>
      (
        await tx.query<{ dog_id: string; notes: string }>(
          "SELECT dog_id,notes FROM care_notes",
        )
      ).rows,
  );
  return (
    <main className="club-main">
      <span className="eyebrow">MANAGER WORKSPACE</span>
      <h1>Your club, at a glance.</h1>
      <p className="intro">
        {dogs.length} dog profiles · Access restricted to this club.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dog</th>
              <th>Breed</th>
              <th>Social visibility</th>
              <th>Private care note</th>
            </tr>
          </thead>
          <tbody>
            {dogs.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="manager-dog">
                    <DogAvatar
                      colour={d.avatar}
                      name={d.name}
                      photoSrc={
                        d.photo_id
                          ? photoUrl("members", club.id, d.id, d.photo_id)
                          : undefined
                      }
                    />
                    <span>{d.name}</span>
                  </div>
                </td>
                <td>{d.breed}</td>
                <td>{d.audience}</td>
                <td>
                  {care.find((c) => c.dog_id === d.id)?.notes ?? "Not recorded"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="coming-next">
        <p>
          Rotas, clocking, payroll, bookings and integrations remain on the
          roadmap.
        </p>
        <span>Not yet connected</span>
      </div>
    </main>
  );
}
