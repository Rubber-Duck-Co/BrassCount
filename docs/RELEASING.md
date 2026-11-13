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

## Releasing from GitHub Actions

`.github/workflows/release.yml` builds one signed bundle from a version-bump
commit and moves that same bundle through the tracks:

| Job          | Play track     | GitHub environment | Gate               |
| ------------ | -------------- | ------------------ | ------------------ |
| `build`      | —              | `internal`         | none               |
| `internal`   | Internal       | `internal`         | none               |
| `staging`    | Closed (alpha) | `staging`          | required reviewers |
| `production` | Production     | `production`       | required reviewers |

Production is a full release to every user; there is no staged rollout.

### Starting a release

- **Minor and major bumps release on their own.** After the bot tags the bump
  commit, `versioning.yml` starts the release workflow for it.
- **A patch is released by hand.** Actions → Release (Google Play) → Run
  workflow, on `main`. Leave `sha` empty for the tip of `main`, or give the
  full 40-character SHA of the version-bump commit to release.

The workflow only accepts a commit that is on `main`, changes `VERSION.txt` (a
bump commit, the only kind with a version of its own) and is not older than the
upload-key signing setup.

### Secrets and variables

| Name                                | Where                                             | Value                                           |
| ----------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| `BRASSCOUNT_UPLOAD_KEYSTORE_BASE64` | `internal` environment, or the repository         | The upload keystore, base64-encoded on one line |
| `BRASSCOUNT_UPLOAD_STORE_PASSWORD`  | same                                              | Keystore password                               |
| `BRASSCOUNT_UPLOAD_KEY_ALIAS`       | same                                              | Key alias                                       |
| `BRASSCOUNT_UPLOAD_KEY_PASSWORD`    | same                                              | Key password                                    |
| `PLAY_SERVICE_ACCOUNT_JSON`         | all three environments, or the repository         | The Play service account's JSON key             |
| `PLAY_RELEASE_STATUS` (variable)    | repository; only until the app is first published | `draft`                                         |

An environment's secrets are only visible to jobs that name that environment.

Encode the keystore with `base64 -w0 brasscount-upload.keystore` (Git Bash).

The service account needs release permission for the app in Play Console →
Users and permissions.

### Keeping the keys out of public logs

The repository is public, so the logs and artifacts of every run are too.

- **GitHub masks a secret's exact value in logs**, and nothing in the workflow
  prints one. A secret reaches only the single step that needs it.
- **Store each secret as one line.** Masking works on the stored value, so
  encode the keystore with `-w0` and minify the service account key
  (`jq -c . key.json`) before pasting it.
- **Never re-run a release job with debug logging enabled**, and never add
  `--info`, `--debug`, `--verbose` or `set -x` to a step that holds a secret.
- **Secrets cannot reach a pull request from a fork**, and the workflow only
  starts by `workflow_dispatch`, which needs write access to the repository.
- **Prefer environment secrets over repository secrets**, with each
  environment restricted to `main`: a workflow on any other branch then cannot
  read them.
- **Actions are pinned to commit SHAs**, and fastlane and every gem it loads
  are pinned with checksums by `android/Gemfile.lock`. Update them
  deliberately, reading the release notes, not by moving back to a tag or
  loosening the lock: run `bundle lock --update fastlane` in `android/`, then
  review the diff. The lock lists only the `x86_64-linux` platform the
  runners use; strip any platform your machine adds before committing it.
- **No release job restores a cache**, because another workflow could have
  written it.
- **The artifact** holds the bundle and the R8 mapping, both of which describe
  public source. The keystore is never part of it, and is deleted from the runner after the build.
- **If a key ever shows in a log**, deleting the run is not enough: rotate the
  service account key, or ask Play support to reset the upload key.

### Things to know

- **Name the environments exactly `internal`, `staging` and `production`.**
  GitHub creates an unknown environment on first use with no reviewers, so a
  misspelt name removes the approval.
- **Restrict each environment to `main`** (Deployment branches and tags).
- **Until the app has been published once**, Play only accepts draft releases
  through the API. Set the `PLAY_RELEASE_STATUS` variable to `draft`, finish
  each release in Play Console, and delete the variable afterwards.
- **A run waiting for approval expires after 30 days.**
- **Do not approve an older waiting run after a newer version has shipped.**
- **Releasing an older commit is not a rollback.** Play does not serve a lower
  versionCode to someone who has a higher one; ship a new version instead.
- **One release runs at a time.** A run waiting for approval holds the queue,
  and GitHub keeps only one run waiting behind it: starting a third cancels
  the one already queued. Reject or cancel a waiting run you no longer want.

### Finishing a release that stopped part-way

Each Play step is a lane in `android/fastlane/Fastfile` that first asks Play
whether the build is already on its target track, and skips itself if so. When
an approval expired, was rejected by mistake, or a job failed, start the
workflow again with the same `sha`: it rebuilds the bundle (same versionCode),
skips the upload and any promotion that already happened, and waits for the
remaining approvals.

This only works while the build is still on the track it is promoted from. Once
a newer version has replaced it on internal or closed testing, finish the old
one in Play Console or ship the newer one instead. A draft counts as being on
its track, so while `PLAY_RELEASE_STATUS` is `draft`, finish drafts in Play
Console rather than by dispatching again.
