# Dog profile photos — 25/09/2026

## Outcome
Owners can add, replace or remove one profile photo while editing their dog. The saved image follows the profile audience everywhere: own pack, community cards, public profile pages and direct image requests. Saving profile details, audience and photo is atomic. Existing profiles/data survive the schema upgrade.

## Design
- Accept JPEG, PNG and static WebP, up to 5 MiB and 20 million decoded pixels. Decode actual bytes; do not trust filenames or browser MIME declarations. Reject SVG, animation and unsupported/invalid inputs.
- Auto-orient, resize within 1200 × 1200 without enlargement and encode WebP. Strip embedded EXIF/GPS and other metadata. Retain no original filename or source bytes.
- Store one normalised image per dog in a tenant-scoped PostgreSQL table in the local development adapter, outside the public directory. This supports atomic updates and permission tests. A managed private object-storage adapter is still a production milestone.
- Generate a new immutable photo ID for every replacement. Old photo URLs stop resolving. Removal clears the row. Images are never stored in browser local storage.
- Image endpoints re-check current membership/profile audience on every request and return `Cache-Control: private, no-store` for success and denial. Bypass Next image optimisation to prevent shared image caching. Public-image paths always use the anonymous public projection, regardless of a visitor's session.
- Public viewers can save images they are permitted to view. Changing visibility prevents subsequent downloads from this application; it cannot recall saved copies.
- Owners control publication; managers can view private photos in their own club but cannot replace/remove members' photos. Unknown, unauthorised, revoked and superseded photo URLs all return 404.

## Acceptance
Cover add/replace/remove/keep, profile+photo atomic rollback, hostile tenant/dog/photo substitution, owner/member/manager/anonymous access, private and members-only revocation, no-store HTTP headers, metadata stripping, wrong MIME/extension, invalid/oversized/multipage images, migration re-run and persistence. The editor provides a preview, clear limits and errors without losing typed text.

No gallery, image moderation service, photo cropping UI, HEIC conversion or production storage is claimed by this increment. Profile illustrations remain a fallback.

References: https://sharp.pixelplumbing.com/api-output/ and https://sharp.pixelplumbing.com/api-constructor/; installed Next.js docs for authenticated images and Server Actions request limits.
