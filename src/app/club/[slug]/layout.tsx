import { ClubMark } from "@/components/club-mark";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  Dog,
  DoorOpen,
  House,
  LogOut,
  Settings2,
  ShieldCheck,
  Users,
  UserCog,
} from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import { logoutAction } from "@/app/actions";
import { isDemoMode } from "@/lib/runtime";
export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const account = await requireAccount();
  const clubs = await clubsFor(await database(), account.id);
  const { slug } = await params;
  const club = clubs.find((c) => c.slug === slug);
  if (!club) notFound();
  return (
    <div
      className="shell"
      style={{ "--brand": club.colour } as React.CSSProperties}
    >
      <aside className="sidebar">
        <Link className="club-logo" href={`/club/${slug}`}>
          <ClubMark emblem={club.emblem} size={32} />
          <span>{club.name}</span>
        </Link>
        <p className="eyebrow sidebar-caption">YOUR LITTLE CORNER</p>
        <nav>
          <Link href={`/club/${slug}`}>
            <House size={19} />
            Club home
          </Link>
          <Link href={`/club/${slug}#dogs`}>
            <Dog size={19} />
            The pack
          </Link>
          <Link href={`/club/${slug}/bookings`}>
            <CalendarDays size={19} />
            Grooming bookings
          </Link>
          <Link href={`/club/${slug}/memberships`}>
            <CreditCard size={19} />
            Membership
          </Link>
          <Link href={`/club/${slug}/admission`}>
            <DoorOpen size={19} />
            Club admission
          </Link>
          <Link href={`/club/${slug}/household`}>
            <Users size={19} />
            Household access
          </Link>
          {(club.role === "manager" || club.can_manage_booking_setup) && (
            <>
              {club.role === "manager" && (
                <Link href={`/club/${slug}/operations`}>
                  <ShieldCheck size={19} />
                  Manager overview
                </Link>
              )}
              {(club.role === "manager" || club.can_manage_booking_setup) && (
                <Link href={`/club/${slug}/booking-setup`}>
                  <Settings2 size={19} />
                  Booking setup
                </Link>
              )}
            </>
          )}
          {(club.role === "manager" || club.can_manage_staff) && (
            <>
              {club.role === "manager" && (
                <Link href={`/club/${slug}/settings`}>Club branding</Link>
              )}
              {club.role === "manager" && (
                <Link href={`/club/${slug}/invitations`}>Invite members</Link>
              )}
              <Link href={`/club/${slug}/staff`}>
                <UserCog size={19} />
                Staff access
              </Link>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <p>{club.location}</p>
          <small>{club.tagline}</small>
          {clubs.length > 1 &&
            clubs.map((c) => (
              <Link key={c.id} href={`/club/${c.slug}`}>
                {c.name}
              </Link>
            ))}
          <form action={logoutAction}>
            <button className="text-button">
              <LogOut size={17} />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            MEMBER’S CLUB{" "}
            <span className="muted">
              / {club.role === "manager" ? "Manager" : "Your pack"}
            </span>
          </span>
          {isDemoMode() && <span className="badge">SYNTHETIC DEMO</span>}
        </header>
        {children}
        <footer className="workspace-footer">
          Made for the dogs. And their humans.<span>£ GBP · Europe/London</span>
        </footer>
      </div>
    </div>
  );
}
