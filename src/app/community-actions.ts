"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import {
  blockCommunityProfile,
  reportCommunityProfile,
  restoreCommunityProfile,
  reviewCommunityReport,
  unblockCommunityAccount,
} from "@/lib/community";

async function communityContext(slug: string) {
  const account = await requireAccount();
  const db = await database();
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  if (!club) redirect("/");
  return { account, db, club };
}

function refreshCommunity(slug: string) {
  revalidatePath(`/club/${slug}`);
  revalidatePath(`/club/${slug}/moderation`);
  revalidatePath("/p/[slug]/[id]", "page");
}

export async function reportCommunityAction(slug: string, form: FormData) {
  const { account, db, club } = await communityContext(slug);
  try {
    await reportCommunityProfile(db, account.id, club.id, {
      dogId: String(form.get("dogId") ?? ""),
      target: String(form.get("target") ?? "profile"),
      reason: String(form.get("reason") ?? "other"),
      details: String(form.get("details") ?? ""),
    });
  } catch {
    redirect(`/club/${slug}?community=report-error#community`);
  }
  refreshCommunity(slug);
  redirect(`/club/${slug}?community=reported#community`);
}

export async function blockCommunityAction(slug: string, form: FormData) {
  const { account, db, club } = await communityContext(slug);
  try {
    await blockCommunityProfile(
      db,
      account.id,
      club.id,
      String(form.get("dogId") ?? ""),
    );
  } catch {
    redirect(`/club/${slug}?community=block-error#community`);
  }
  refreshCommunity(slug);
  redirect(`/club/${slug}?community=blocked#community`);
}

export async function unblockCommunityAction(slug: string, form: FormData) {
  const { account, db, club } = await communityContext(slug);
  try {
    await unblockCommunityAccount(
      db,
      account.id,
      club.id,
      String(form.get("accountId") ?? ""),
    );
  } catch {
    redirect(`/club/${slug}?community=unblock-error#community`);
  }
  refreshCommunity(slug);
  redirect(`/club/${slug}?community=unblocked#community`);
}

export async function reviewCommunityAction(slug: string, form: FormData) {
  const { account, db, club } = await communityContext(slug);
  try {
    await reviewCommunityReport(db, account.id, club.id, {
      reportId: String(form.get("reportId") ?? ""),
      decision: String(form.get("decision") ?? ""),
      outcome: String(form.get("outcome") ?? ""),
    });
  } catch {
    redirect(`/club/${slug}/moderation?review=error`);
  }
  refreshCommunity(slug);
  redirect(`/club/${slug}/moderation?review=saved`);
}

export async function restoreCommunityAction(slug: string, form: FormData) {
  const { account, db, club } = await communityContext(slug);
  try {
    await restoreCommunityProfile(
      db,
      account.id,
      club.id,
      String(form.get("dogId") ?? ""),
      String(form.get("reason") ?? ""),
    );
  } catch {
    redirect(`/club/${slug}/moderation?review=restore-error`);
  }
  refreshCommunity(slug);
  redirect(`/club/${slug}/moderation?review=restored`);
}
