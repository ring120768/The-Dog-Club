# Shared iOS and Android foundation

## Implemented checkpoint

The repository now contains generated Capacitor 8.4.3 projects in `ios/` and `android/` using the shared application identifier `uk.co.thedogclub.member`. Both platforms bundle the same safe-area-aware development shell and the approved demo dog image. The shell is deliberately honest when it has not been connected to a server.

This checkpoint proves that one source repository can produce both native containers. It does not claim that the web member journey is already a store-ready native experience. Authentication, tenant selection, camera/library upload, push notifications, deep links, accessibility, offline behaviour, account deletion, privacy manifests, final icons/screenshots, signing and store review remain acceptance work.

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

Build a native-safe API/session contract, then exercise sign-in, club selection, dog list/profile and photo selection on one iOS simulator and one Android emulator. Add native capabilities only when their privacy text, permissions and server-side access boundaries are ready. Decide shared marketplace listing versus operator-branded releases before creating signing identities or promising individual store listings.
