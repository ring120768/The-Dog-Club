import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { editableClub, isPlatformOwner } from "@/lib/branding";
import { paymentAccountFor } from "@/lib/stripe-memberships";
import { BrandForm } from "@/components/brand-form";
import { StripeAccountForm } from "@/components/stripe-account-form";

export default async function Operator({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string; created?: string }>;
}) {
  const { slug } = await params;
  const account = await requireAccount();
  const db = await database();
  if (!(await isPlatformOwner(db, account.id))) notFound();
  const club = await editableClub(db, account.id, slug);
  if (!club) notFound();
  const [query, paymentAccount] = await Promise.all([
    searchParams,
    paymentAccountFor(db, club.id),
  ]);
  return (
    <main className="platform-main">
      <Link className="inline-link" href="/platform">
        ← All clubs
      </Link>
      {(query.saved || query.created) && (
        <p className="success" role="status">
          {query.created
            ? "Club created and manager assigned. Their club access is ready."
            : "Club branding saved."}
        </p>
      )}
      <div className="platform-heading">
        <div>
          <span className="eyebrow">OPERATOR IDENTITY</span>
          <h1>{club.name}</h1>
          <p>
            /club/{club.slug} · Configuration version {club.version}
          </p>
        </div>
      </div>
      <BrandForm club={club} platform />
      <StripeAccountForm club={club.id} slug={slug} current={paymentAccount} />
    </main>
  );
}
