# Shared iOS and Android foundation

## Implemented checkpoints

The repository now contains generated Capacitor 8.4.3 projects in `ios/` and `android/` using the shared application identifier `uk.co.thedogclub.member`. Both platforms bundle the same safe-area-aware development shell and the approved demo dog image. The shell is deliberately honest when it has not been connected to a server.

This checkpoint proves that one source repository can produce both native containers. It does not claim that the web member journey is already a store-ready native experience. Authentication, tenant selection, camera/library upload, push notifications, deep links, accessibility, offline behaviour, account deletion, privacy manifests, final icons/screenshots, signing and store review remain acceptance work.

The next slice adds an end-to-end development journey in that shared shell: a member can enter an approved server address, sign in, choose one of their available clubs and view the dog profiles they are permitted to see. Their own or delegated dog profiles are marked clearly. The client receives a minimal allowlisted projection and never receives owner account IDs, care notes, password hashes or stored session hashes.

Mobile sessions use 256-bit random bearer tokens. Only a SHA-256 digest is stored server-side, sessions expire after eight hours and sign-out revokes the current session immediately. The client keeps the bearer token in JavaScript memory only, so closing or refreshing the app signs the member out. This is deliberately conservative until Keychain/Keystore-backed storage, biometric access and device-loss handling have been reviewed together.

The API accepts the fixed Capacitor origins and optional exact origins from `MOBILE_ALLOWED_ORIGINS`; wildcard CORS is not used. Android and iOS share the same server contract and existing tenant row-level security. The server address field is visible only because this is a development build. A signed release must compile a reviewed HTTPS production endpoint into the app and remove that field.

Capacitor 8.5.2 was not retained because its CLI dependency tree reported a moderate `uuid` advisory through the Xcode parser. Version 8.4.3 has a clean `npm audit` result and builds with the installed toolchains.

## Commands

```bash
npm run mobile:sync
npm run mobile:ios
npm run mobile:android
```

`mobile:sync` copies the current demo image into the bundled shell and synchronises both native projects. Opening a platform IDE is intentionally separate from building or signing a release.

Verified locally:

- Android debug APK: Java 21 and `./gradlew assembleDebug`;
- iOS simulator app: Xcode 26.5, iOS simulator SDK and code signing disabled;
- Capacitor synchronisation for both platforms;
- `npm audit`: zero known vulnerabilities.

Java 25 is installed on the development machine but is too new for the generated Gradle toolchain. Android commands must select the installed Java 21 runtime until the Android toolchain explicitly supports a later release.

## Next mobile vertical slice

Add a dog-detail endpoint and safe photo delivery, then exercise sign-in, club selection, dog detail and photo selection on one iOS simulator and one Android emulator against a reviewed HTTPS non-production deployment. Add camera/library permissions only when their privacy text and server-side upload boundary are ready. Decide shared marketplace listing versus operator-branded releases before creating signing identities or promising individual store listings.
