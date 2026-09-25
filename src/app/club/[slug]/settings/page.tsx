import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { editableClub } from "@/lib/branding";
import { clubsFor } from "@/lib/dogs";
import { BrandForm } from "@/components/brand-form";
export default async function Settings({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{saved?:string}>}){const {slug}=await params;const account=await requireAccount();const db=await database();if(!(await clubsFor(db,account.id)).some(c=>c.slug===slug&&c.role==='manager'))notFound();const club=await editableClub(db,account.id,slug);if(!club)notFound();const {saved}=await searchParams;return <main className="club-main">{saved&&<p className="success" role="status">Club branding saved.</p>}<div className="platform-heading"><div><span className="eyebrow">YOUR CLUB’S IDENTITY</span><h1>A familiar welcome.</h1><p>Update the details your members see across the club.</p></div></div><BrandForm club={club}/></main>;}
