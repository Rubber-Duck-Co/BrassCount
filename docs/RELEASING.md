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

Never commit it (`*.keystore`, `*.jks` and `*.p12` are git-ignored apart from
`debug.keystore`). The upload key is not the app signing key, so if it leaks
you can ask Play to reset it without losing the app.

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

The Play API cannot create a release for an app that has none, so the first
bundle was uploaded by hand: Play Console → Testing → Internal testing →
Create release, accepting Play App Signing. After that the workflows below
publish.

## Release workflows

Both are manual (Actions → pick the workflow → Run workflow).

| Workflow          | Run it from | What it does                                                                                    |
| ----------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `Release to UAT`  | `main`      | Lints, type-checks and tests, builds a signed AAB and publishes it to internal testing          |
| `Release to PROD` | a `v*` tag  | Promotes to production the release UAT put on the internal track; it builds and uploads nothing |

To release:

1. Merge to `main`, and wait for the Version Bump workflow to finish so
   `VERSION.txt` has the new version. Run **Release to UAT** and test the build
   from the internal testing link.
2. Tag that same commit with its version and push the tag. In this repo the
   bot has so far tagged only minor and major bumps (there are no tags for
   0.32.1 and later), so check first, and create the tag yourself if it is
   missing:

   ```bash
   git ls-remote --tags origin 'v0.33.*'
   git tag v0.33.1 <commit-that-went-to-UAT>
   git push origin v0.33.1
   ```

3. Run **Release to PROD**, choosing the tag in "Use workflow from". Its
   checks run first, then a reviewer approves the promotion.

PROD runs its checks before anyone is asked to approve. It refuses a tag that
is not on `main`, that has moved since the run started, or whose name differs
from `VERSION.txt` at that commit. It then asks Play to put that version on
production, and refuses unless the internal track holds it in a completed
release built from the tag's commit (UAT writes the commit into the release
name), so a build that never reached testers cannot be promoted. What reaches
production is the bundle testers got; nothing is rebuilt.

Notes:

- Play rejects a versionCode it has already seen, so each version is published
  to UAT once; a new release needs a new merge. Do not re-run a successful UAT
  run. A re-run after a failed publish, for example a Play outage, is fine.
- PROD can only promote what is on the internal track now. Publishing a newer
  version to UAT replaces the older one there, after which the older tag can no
  longer be promoted.
- Promotion is a 100% rollout. Play replaces the production track's releases
  with the one promoted, so it supersedes a staged rollout or draft already
  there. Use Play Console if you want a staged rollout.
- `PLAY_RELEASE_STATUS=draft` on UAT uploads a draft that is not rolled out,
  so PROD cannot promote it. On PROD, `draft` leaves the production release
  unpublished until you roll it out in Play Console. Set the variable on one
  environment, not on the whole repository, because the two mean different
  things.
- A workflow runs the copy of its file in the commit it was started from, so a
  fix to `release-prod.yml` on `main` does not reach an existing tag. A
  failed `v0.33.0` needs a new version.
- The first production release is promoted by hand in Play Console from the
  hand-uploaded internal build: its release name has no commit in it, so the
  PROD workflow refuses it.
- Anyone who can push a `v*` tag starts PROD from that tag's own copy of the
  workflow. The tag ruleset (below) and the required reviewer are what enforce
  who may release; the checks inside the workflow do not protect against a
  tag on a malicious commit.

## One-time setup

1. **Two service accounts.** In Google Cloud, enable the Google Play Android
   Developer API and create two service accounts, each with a JSON key:
   - a **UAT** account, invited in Play Console under Users and permissions
     with permission to release to **testing tracks only**;
   - a **PROD** account, with permission to release to **production**.

   Keeping them apart means code running in the UAT job cannot publish to
   production and skip PROD's approval. Check the exact permission names in
   Play Console when you invite them.

2. **GitHub environments** (Settings → Environments). Create both, with their
   protections and secrets, before the first run: a workflow that names an
   environment which does not exist creates it with no protection at all.
   - `UAT`: deployment branches limited to `main`; add a required reviewer.
   - `PROD`: deployment tags limited to `v*`; add a required reviewer.
   - On both, tick "Prevent self-review" if more than one person can approve.
3. **Tag protection.** In Settings → Rules, add a tag ruleset for `v*` that
   limits who can create tags and blocks moving or deleting them, so only a
   trusted person can name a release. The version bot's GitHub App also needs
   to be a bypass actor, or the ruleset will stop it creating its own tags.
   Anything that bypasses the rules can make a release tag, so keep that app's
   credentials usable only from `main`, for example as secrets of a
   `main`-limited environment rather than organisation-wide secrets.
4. **Secrets.**

   | Secret                                                             | Environment | Value                                   |
   | ------------------------------------------------------------------ | ----------- | --------------------------------------- |
   | `UPLOAD_KEYSTORE_BASE64`                                           | UAT         | `base64 -w0 brasscount-upload.keystore` |
   | `UPLOAD_STORE_PASSWORD`, `UPLOAD_KEY_ALIAS`, `UPLOAD_KEY_PASSWORD` | UAT         | the values used to create the keystore  |
   | `PLAY_SERVICE_ACCOUNT_JSON`                                        | UAT         | the JSON key of the **UAT** account     |
   | `PLAY_SERVICE_ACCOUNT_JSON`                                        | PROD        | the JSON key of the **PROD** account    |

   PROD never builds, so it holds no keystore.

5. **Optional variables.** `PLAY_TRACK` on UAT (`alpha` for closed testing; the
   workflow refuses anything but `internal` or `alpha`), and then
   `PLAY_SOURCE_TRACK` on PROD set to the same track. `PLAY_RELEASE_STATUS` on
   either environment (`draft` until Play has accepted the app for release,
   then `completed`).

## What the pipeline trusts

The workflows pin their actions to commits (`r0adkll/upload-google-play`
receives the UAT service account key); update a hash deliberately when you
upgrade one. The UAT job installs dependencies and runs Gradle in the same job
as the signing secrets, so a malicious dependency on `main` could read the
upload key and its passwords and could choose what goes onto the internal
track. That key alone cannot publish, and the UAT service account can only
reach testing tracks, but PROD promotes whatever UAT put on internal, so
testing the build, and the PROD reviewer, are the check on its contents. Keep
dependencies reviewed (`npm audit`, Dependabot).

PROD uses `.github/scripts/promote-play-release.sh`, which needs only `bash`,
`curl`, `openssl` and `jq` and talks to Play's REST API directly.
