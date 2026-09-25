import { currentAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { readPhoto, photoResponse } from "@/lib/photos";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      scope: string;
      club: string;
      dog: string;
      photo: string;
    }>;
  },
) {
  const { scope, club, dog, photo } = await params;
  if (scope !== "members" && scope !== "public") return photoResponse(null);
  const account = scope === "members" ? await currentAccount() : null;
  if (scope === "members" && !account) return photoResponse(null);
  const content = await readPhoto(
    await database(),
    account?.id ?? null,
    scope,
    club,
    dog,
    photo,
  );
  return photoResponse(content);
}
