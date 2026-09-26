# Mobile secure-session implementation

Date: 26/09/2026

## Outcome

A signed-in member remains signed in across an ordinary app restart until the existing eight-hour server session expires or is revoked. The app never stores the password. iOS stores the session record in Keychain with a this-device-only accessibility class; Android encrypts it with an AES-GCM key held by Android Keystore. Browser previews remain memory-only.

A member can see their active mobile sessions from a signed-in device and revoke another device. The server exposes a random public session ID and a bounded generic device label; it never exposes token hashes or bearer tokens. Password recovery revokes every web and mobile session for that account.

## Security boundaries

- The server remains authoritative for expiry and revocation; native storage does not extend a session.
- Only the raw bearer token, server origin, public session ID and expiry are stored locally.
- iOS uses `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.
- Android uses AES/GCM/NoPadding with a non-exportable Android Keystore key; only ciphertext and IV enter private preferences.
- Android app backup is disabled so encrypted session material is not copied between devices.
- Session listing and revocation require a current bearer session and are account-scoped.
- Cross-account or unknown session IDs return the same result and reveal nothing.
- Explicit sign-out revokes the server token and clears native storage even if the network request fails.
- A 401 response clears stale native storage immediately.

## Acceptance

1. Sign in on iOS and Android, terminate the app, relaunch and return to the club picker without entering the password.
2. Confirm no password is present in native storage and the database retains only the token digest.
3. Sign in on a second device, revoke the first session and confirm its next API call returns 401 and clears local storage.
4. Complete password recovery and confirm both web and mobile sessions stop resolving.
5. TypeScript, isolated tests, production web build, Capacitor sync, Android debug build and unsigned iOS simulator build pass.

Production schema and deployment remain outside this checkpoint.
