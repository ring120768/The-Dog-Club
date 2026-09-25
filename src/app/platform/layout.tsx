import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { isPlatformOwner } from "@/lib/branding";
import { logoutAction } from "@/app/actions";
import { ClubMark } from "@/components/club-mark";
export default async function PlatformLayout({children}:{children:React.ReactNode}) {const account=await requireAccount();if(!await isPlatformOwner(await database(),account.id))notFound();return <div className="platform-shell"><header className="platform-header"><Link href="/platform" className="club-logo"><ClubMark/><span>The Dog Club<br/><small>PLATFORM CONSOLE</small></span></Link><div className="platform-header-actions"><span className="badge">LOCAL DEMO</span><form action={logoutAction}><button className="text-button">Sign out</button></form></div></header>{children}</div>;}
