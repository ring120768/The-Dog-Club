// Shared UI/server limits. Browser hints never replace server-side byte validation.
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
export type PhotoScope = "members" | "public";
export function photoUrl(
  scope: PhotoScope,
  clubId: string,
  dogId: string,
  photoId: string,
) {
  return `/media/${scope}/${encodeURIComponent(clubId)}/${encodeURIComponent(dogId)}/${encodeURIComponent(photoId)}`;
}
