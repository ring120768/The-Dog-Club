"use client";
import { useActionState,useState } from "react";
import { createClubAction,updateBrandAction } from "@/app/branding-actions";
import { palettes,type BrandInput } from "@/lib/brand-contract";
import type { Club } from "@/lib/dogs";
import { ClubMark } from "./club-mark";
import { DogAvatar } from "./dog-avatar";
export function BrandForm({club,platform=false}:{club?:Club;platform?:boolean}) {
 const [draft,setDraft]=useState<BrandInput>({name:club?.name??"",tagline:club?.tagline??"",location:club?.location??"",colour:(club?.colour??"#235448") as BrandInput["colour"],emblem:club?.emblem??"paw",avatar_tone:club?.avatar_tone??"sand"});
 const [slug,setSlug]=useState("");const [manager,setManager]=useState("manager@demo.invalid");
 const action=club?updateBrandAction.bind(null,club.slug,club.version,platform):createClubAction;
 const [state,submit,pending]=useActionState(action,{});
 return <div className="brand-workspace"><form action={submit} className="profile-form"><fieldset className="editor-fields" disabled={pending}>
 {[["name","Club name",80],["tagline","Welcome tagline",160],["location","Location label",120]].map(([field,label,max])=><label key={field}>{label}<input name={String(field)} required maxLength={Number(max)} value={draft[field as keyof BrandInput]} onChange={event=>setDraft({...draft,[field]:event.target.value})}/></label>)}
 {!club&&<><label>Club web address<input name="slug" value={slug} onChange={e=>setSlug(e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={48} required placeholder="e.g. park-paws"/><small>/club/{slug||"your-club"} · This address stays fixed after creation.</small></label><label>Initial manager’s registered email<input name="managerEmail" type="email" required maxLength={254} value={manager} onChange={e=>setManager(e.target.value)}/><small>The account must already exist. No invitation or email will be sent.</small></label></>}
 <fieldset><legend>Colour palette</legend><div className="palette-options">{palettes.map(p=><label key={p.value} className="palette-option"><input type="radio" name="colour" value={p.value} checked={draft.colour===p.value} onChange={()=>setDraft({...draft,colour:p.value})}/><span className="palette-swatch" style={{background:p.value}}/>{p.name}</label>)}</div><small>Selected to keep the club’s light text readable.</small></fieldset>
 <label>Club emblem<select name="emblem" value={draft.emblem} onChange={e=>setDraft({...draft,emblem:e.target.value as BrandInput["emblem"]})}><option value="paw">Paw print</option><option value="dog">Dog</option><option value="heart">Heart</option><option value="sparkles">Sparkles</option></select></label>
 <label>Illustration tone<select name="avatar_tone" value={draft.avatar_tone} onChange={e=>setDraft({...draft,avatar_tone:e.target.value as BrandInput["avatar_tone"]})}><option value="sand">Biscuit</option><option value="sage">Sage</option><option value="rose">Rose</option></select></label>
 </fieldset>{state.error&&<p className="error" role="alert">{state.error}</p>}<button className="button" disabled={pending}>{pending?"Saving…":club?"Save club branding":"Create club and assign manager"}</button></form>
 <aside className="brand-preview" aria-label="Brand preview" style={{"--brand":draft.colour} as React.CSSProperties}><span className="eyebrow">LIVE PREVIEW · NOT SAVED YET</span><div className="brand-preview-card"><div className="club-logo"><ClubMark emblem={draft.emblem}/><span>{draft.name||"Your club name"}</span></div><div className="brand-preview-hero"><DogAvatar colour={draft.avatar_tone}/><h2>A place for<br/>your pack.</h2><p>{draft.tagline||"Your welcome tagline"}</p></div><p className="preview-location">{draft.location||"Your location"}</p></div><small>This identity appears across member, manager and public profile pages. Existing dogs keep their own chosen illustrations.</small></aside></div>;
}
