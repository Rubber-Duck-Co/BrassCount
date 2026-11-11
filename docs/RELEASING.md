# Releasing to Google Play

The app is published as `com.rubberduckco.brasscount` (the `applicationId` in
`android/app/build.gradle`). The Kotlin `namespace` stays `com.brasscount.app`;
the two do not need to match. The package name cannot change once published.

## Upload key

Play App Signing splits the keys: you sign bundles with an **upload key** and
Google holds the **app signing key** that devices see. Create the upload key
once, outside the repo, and back up the file and both passwords:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore brasscount-upload.keystore -alias brasscount-upload -keyalg RSA -keysize 2048 -validity 10000
```

Never commit it (`*.keystore` is git-ignored apart from `debug.keystore`).

## Building a bundle locally

Put the four values in `~/.gradle/gradle.properties`:

```properties
BRASSCOUNT_UPLOAD_STORE_FILE=C:/path/to/brasscount-upload.keystore
BRASSCOUNT_UPLOAD_STORE_PASSWORD=...
BRASSCOUNT_UPLOAD_KEY_ALIAS=brasscount-upload
BRASSCOUNT_UPLOAD_KEY_PASSWORD=...
```

`BRASSCOUNT_UPLOAD_STORE_FILE` must be an absolute path to an existing file; a
relative one would resolve against `android/app`, and the build refuses it.

Then run `npm run android:bundle`. The AAB is
`android/app/build/outputs/bundle/release/app-release.aab`.

`bundleRelease` fails at once without those properties, so a bundle signed with
the debug key can never reach Play. `npm run android:release` still builds an
APK without them, signed with the debug key, for checking a release build on a
device. Release builds run R8; keep rules go in `android/app/proguard-rules.pro`.

## First upload

The Play API cannot create a release for an app that has none, so upload the
first bundle by hand: Play Console → Testing → Internal testing → Create
release. Accept Play App Signing when asked.
