"use server";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { createClub,updateBrand,editableClub,ClubConfigurationError } from "@/lib/branding";
import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export type BrandFormState={error?:string};
function message(error:unknown) {if(error instanceof ClubConfigurationError)return error.message;if(error instanceof ZodError)return error.issues[0].message;return "Unable to save club settings. Please try again.";}
export async function createClubAction(_state:BrandFormState,form:FormData):Promise<BrandFormState> {
 const account=await requireAccount();let slug:string;
 try {slug=await createClub(await database(),account.id,Object.fromEntries(form));}catch(error){return {error:message(error)};}
 revalidatePath("/platform");redirect(`/platform/${slug}?created=1`);
}
export async function updateBrandAction(slug:string,version:number,returnToPlatform:boolean,_state:BrandFormState,form:FormData):Promise<BrandFormState> {
 const account=await requireAccount();const db=await database();const club=await editableClub(db,account.id,slug);
 if(!club)return {error:"You cannot edit this club’s settings."};
 try{await updateBrand(db,account.id,club.id,version,Object.fromEntries(form));}catch(error){return {error:message(error)};}
 revalidatePath("/club/[slug]","layout");revalidatePath("/p/[slug]/[id]","page");revalidatePath("/platform","layout");
 redirect(returnToPlatform?`/platform/${slug}?saved=1`:`/club/${slug}/settings?saved=1`);
}
