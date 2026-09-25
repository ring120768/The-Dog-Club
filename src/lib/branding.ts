import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scoped } from "./database";
import type { Club } from "./dogs";
import { brandInput,onboardingInput } from "./brand-contract";
export class ClubConfigurationError extends Error {}
export async function isPlatformOwner(db:PGlite,account:string) {return scoped(db,account,"",false,async tx=>(await tx.query("SELECT account_id FROM platform_owners")).rows.length===1);}
export async function platformClubs(db:PGlite,account:string) {
 if(!await isPlatformOwner(db,account)) throw new ClubConfigurationError("Platform access is required.");
 return scoped(db,account,"",false,async tx=>(await tx.query<Club>("SELECT id,slug,name,tagline,colour,location,emblem,avatar_tone,version FROM clubs ORDER BY name")).rows);
}
export async function editableClub(db:PGlite,account:string,slug:string) {
 return scoped(db,account,"",false,async tx=>(await tx.query<Club>(`SELECT id,slug,name,tagline,colour,location,emblem,avatar_tone,version FROM clubs c WHERE slug=$1 AND (EXISTS(SELECT 1 FROM platform_owners) OR EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=c.id AND m.role='manager'))`,[slug])).rows[0]??null);
}
export async function createClub(db:PGlite,account:string,input:unknown) {
 if(!await isPlatformOwner(db,account)) throw new ClubConfigurationError("Platform access is required.");
 const data=onboardingInput.parse(input);
 // Identity lookup is limited to an exact email, after platform authorisation. RLS rechecks the platform grant at write time.
 const manager=(await db.query<{id:string}>("SELECT id FROM accounts WHERE email=$1",[data.managerEmail])).rows[0];
 if(!manager) throw new ClubConfigurationError("That manager does not have an account yet. Use an existing registered account; invitations are not connected yet.");
 const id=randomUUID();
 try {await scoped(db,account,id,false,async tx=>{
  await tx.query("INSERT INTO clubs(id,slug,name,tagline,colour,location,emblem,avatar_tone,created_by,initial_manager_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[id,data.slug,data.name,data.tagline,data.colour,data.location,data.emblem,data.avatar_tone,account,manager.id]);
  await tx.query("INSERT INTO memberships(club_id,account_id,role) VALUES($1,$2,'manager')",[id,manager.id]);
  await tx.query("INSERT INTO club_config_events(club_id,actor_id,action,changes) VALUES($1,$2,'club.created',$3)",[id,account,JSON.stringify({branding:brandInput.parse(data),initialManagerId:manager.id})]);
 });} catch(error) {if((error as {code?:string}).code==='23505') throw new ClubConfigurationError("That club address is already in use. Choose another.");throw error;}
 return data.slug;
}
export async function updateBrand(db:PGlite,account:string,club:string,version:number,input:unknown) {
 const data=brandInput.parse(input);z.number().int().positive().parse(version);
 await scoped(db,account,club,false,async tx=>{
  const result=await tx.query("UPDATE clubs SET name=$1,tagline=$2,colour=$3,location=$4,emblem=$5,avatar_tone=$6,version=version+1 WHERE id=$7 AND version=$8 RETURNING id",[data.name,data.tagline,data.colour,data.location,data.emblem,data.avatar_tone,club,version]);
  if(result.rows.length!==1) throw new ClubConfigurationError("Settings have changed or your access has ended. Reload the page before saving again.");
  await tx.query("INSERT INTO club_config_events(club_id,actor_id,action,changes) VALUES($1,$2,'branding.updated',$3)",[club,account,JSON.stringify(data)]);
 });
}
