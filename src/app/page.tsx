import { isPlatformOwner } from "@/lib/branding";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
export default async function Home() {
  const account = await requireAccount();
  const db=await database();
  if(await isPlatformOwner(db,account.id)) redirect("/platform");
  const clubs = await clubsFor(db, account.id);
  if (clubs[0]) redirect(`/club/${clubs[0].slug}`);
  return (
    <main>
      <h1>No club membership yet</h1>
      <p>Contact your club to arrange access.</p>
    </main>
  );
}
