---
name: brasscount-e2e
description: Full end-to-end test of the BrassCount Android app on the local emulator. Runs the automated gate (lint, typecheck, Jest, Kotlin tests), boots the Medium_Phone emulator, installs a debug build with synthetic microphone input, drives every screen through adb (drills, editor, calibration, timed runs, saving, history, profile, appearance, dark mode, large text, lifecycle), cleans up its test data, closes the emulator and reports pass/fail with evidence. Use whenever the user asks to test BrassCount end to end, run the e2e or a full regression, "test everything on the emulator", smoke-test a branch before a PR or release, or check the whole app still works, even if they don't say "e2e".
argument-hint: '[optional focus, e.g. "timer and history only"]'
---

# BrassCount end-to-end test

Test the app as a shooter would use it, on the emulator, from a clean start to a clean finish, and report what works and what does not. You are a tester here, not a developer: when something is broken, record it with enough evidence to reproduce it and keep going. **Do not change app code to fix what you find.** The user will decide what to fix after reading the report.

Focus requested by the user (may be empty, meaning everything): $ARGUMENTS

A focus narrows the test plan to those areas (plus anything they depend on, such as a drill to run). Setup and teardown always happen in full.

## Ground rules

- **The emulator holds the user's own data** (their profile, drills and runs). Never `pm clear` the app or wipe the emulator. Everything the test creates is named with the `ZZE2E` prefix and removed at the end; everything it changes (profile name, handle, appearance, font scale, night mode) is written down first and put back.
- **Every test-only change to the repo goes through `scripts/patches.mjs`**, which backs files up and restores them byte for byte. The working tree must end exactly as it started; the user may have uncommitted work in it.
- **The checkout, emulator and Metro may be shared.** The patches change files in this working tree, and every build installs over the app on the emulator, so a run disturbs anyone else using them, such as another Claude session working on a branch here. If an emulator is already running, or the working tree has uncommitted changes, ask the user once before the first patch whether anyone else is using them. If someone is, wait or stop; do not test around them.
- **Teardown always runs**, including after a failed build, a crash, or running out of things you can test. If you stop early for any reason, do the teardown section before reporting.
- Read `.claude/CLAUDE.md` before testing: it describes what each screen is meant to do, and it is the authority when it and the test plan disagree. Also read the memory note on emulator testing if it is loaded; it records traps hit on this machine.

The two scripts, run from the repo root with Node (Git Bash or PowerShell both work):

```bash
D="node .claude/skills/brasscount-e2e/scripts/device.mjs"     # emulator, app, UI, logs
P="node .claude/skills/brasscount-e2e/scripts/patches.mjs"    # test-only patches
```

In Git Bash, `ANDROID_HOME` holds the unexpanded `%LOCALAPPDATA%\Android\Sdk`, and `device.mjs` stops on it. Run `export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"` once in each Git Bash command that calls `$D`, since shell state does not carry between commands.

Each documents its commands in the header comment at the top of the file; read that once. Keep scratch files (screenshots, logs) in your scratchpad directory, not the repo.

## 1. Preflight

1. `$P status`. If patches from an interrupted run are still applied, `$P restore-all` and tell the user in the report.
2. Record `git status --porcelain` and `git branch --show-current`; teardown compares against this.
3. `$P begin` (records the start time the cleanup uses).
4. Look at what this branch changed (`git diff main...HEAD --stat` and the uncommitted diff). The areas it touches get extra depth: try their edge cases, not only the plan's checks.

## 2. Automated gate

Run these and record each result; carry on to the emulator whatever they say, since a failing unit test is itself a finding:

```bash
npm run lint
npm run typecheck
npm run test:ci
cd android && ./gradlew.bat testDebugUnitTest      # from Git Bash, not PowerShell
```

For formatting, check only the files the branch touches (`npx prettier --check <files>`): a full `format:check` reports dozens of files locally because Git checks them out as CRLF, and CI passes anyway.

## 3. Bring up the emulator and app

1. `$D emulator start`. It reuses a running emulator (and will then leave it running at the end) or boots `Medium_Phone` and waits for it.
2. `$P synth on`, then build and install from **Git Bash** (the PowerShell build fails in `react-native-audio-api`'s prebuilt download):
   ```bash
   cd android && ./gradlew.bat app:installDebug -PreactNativeDevServerPort=8081
   ```
   This takes several minutes; run it in the background and wait for it. If the build fails on the patch, that is a problem with this skill, not the app: `$P synth off`, rebuild, and test what does not need sound, marking the sound areas BLOCKED.
3. Metro, **after** the build: a Gradle build can kill a running Metro. `:react-native-audio-api:downloadPrebuiltBinaries` creates and deletes `node_modules/react-native-audio-api/android/audioapi-binaries-temp`, and Metro's file watcher can die with `ENOENT` on it (it does not every time). So check `$D metro` after every build, not before:
   - If a Metro was running on 8081 before the build, it is probably the user's: never stop it. If the build killed it, tell the user and ask them to restart it, or start one yourself only if they agree.
   - Otherwise start it yourself in the background (`npx react-native start --port 8081`) and note that you started it. Give the background command a long timeout (the full run takes well over an hour): if the background task is stopped at its time limit, the node process can survive it, orphaned, still holding the port. Either way, find it for teardown by its port (`netstat -ano | grep :8081` for the PID), not by the task.
   - If the app later sits on "Loading from 10.0.2.2:8081…", the user's Metro is wedged: see the memory note for the 8082 workaround; do not stop theirs.
4. `$D mic grant`, `$D synth silent`, `$D log-clear`, `$D launch`. Wait a few seconds before the first tap: the tab bar appears a moment before the app takes taps.
5. Baseline. Write down, from the screens: Profile name, handle and the Runs / Drills counters; Settings' Appearance and Level units; History's Runs / Drills counters; the Drills tab's count; and `adb shell settings get system font_scale`. Teardown checks these come back.

### If a patch anchor is missing

`synth on` edits three lines of `AudioCaptureModule.kt` and stops if any of them has changed. Then make the same three hooks by hand, after backing the file up with `$P` (or tell the user and mark the sound areas BLOCKED): call `SyntheticInput.onCaptureStart(reactContext.filesDir)` when a capture starts, `SyntheticInput.onNow(nanos)` inside `now()`, and `SyntheticInput.fill(buffer, framesRead, bufferTime.endNanos)` just before each `emitAmplitude`. Copy `assets/SyntheticInput.kt` into the audio package. Restoring is then `$P synth off` if `$P` made the backup, or `git diff` review if you did.

## 4. How synthetic input works

The emulator has no usable microphone, so the test build replaces what it hears with a script you set at any time with `$D synth …`:

| Script                           | What the app hears                                                                                                      | Used for                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `off`                            | the real (silent) emulator mic                                                                                          |                                                                               |
| `silent`                         | a -80 dBFS noise floor                                                                                                  | "No sound heard", a run with nothing heard                                    |
| `clicks <dBFS> <everyMs>`        | a 2 ms click every `everyMs`                                                                                            | Recalibrate (`-3 500` → threshold about -9), Test passed / failed (`-20 500`) |
| `run <beepMs\|none> <t1> <t2> …` | silence until Start's beep is requested, a 2 kHz beep `beepMs` later, then a -3 dBFS shot `tN` ms after the beep starts | timed runs with a known right answer                                          |

Because the shots are placed at known times, a run's splits have an expected value: split 1 ≈ t1, split N ≈ tN − tN-1. That turns "the timer works" into a measurable check. The test plan gives the tolerances.

## 5. Run the test plan

Read `references/test-plan.md` and work through it in order. It has eleven areas, from navigation through drills, calibration, timed runs, saving, history, profile, display settings and lifecycle.

How to drive the UI well:

- Find things by `testID` (`$D tap btn-start`, `$D text id=text-elapsed`), and fall back to `text=` or `contains=` for rows without one. Take a fresh `$D dump` whenever you are unsure what is on screen. Positions change with font scale and scrolling, so do not reuse coordinates across them.
- While a run is ticking the UI never goes idle and cannot be dumped: use `$D tap-xy` with coordinates from a dump taken just before Start, and read results after the run ends.
- Take a screenshot (`$D screenshot <scratchpad>/name.png`) at each screen you check visually and look at it with the Read tool. Tests and dumps cannot see clipping, overlap, contrast or wrong theme colours; your eyes can.
- A soft keyboard docks after typing (check `adb shell dumpsys input_method | grep mInputShown`) and covers the buttons at the bottom of a form, such as Save: a tap there types a letter into the field instead. Hide it with the keyboard's own chevron (`$D tap-xy 113 2335` on the 1080x2400 AVD), never with Back, which pops the screen when no keyboard or sheet is up.
- While a sheet is open, Back (`$D key 4`) closes it, but if the keyboard is up the first Back only hides the keyboard: press it again. Do not use Escape (`key 111`) on the par sheet: it freezes the drill editor (#125).
- Start waits a random 1–5 s before the beep. Allow for it whenever a check waits for a shot: the first shot of `run 150 1200` can land as late as 6.4 s after Start.
- After the app has been in the background, a "Fast Refresh disconnected" toast can sit over the tab bar and swallow taps; force-stop and relaunch (`$D stop-app`, `$D launch`).
- `$D crashes` after each area. A crash or JS error in the log is a FAIL even if the screen looked right. The `ReactNoCrashSoftException` (`onWindowFocusChange … context is not ready`) logged on every cold start is framework noise, and the emulator's own services (Bluetooth, Chrome) also crash now and then; `crashes` filters both out and says how many lines it ignored.

Judge each check against CLAUDE.md's description of the intended behaviour. When something looks wrong, reproduce it once more before calling it a bug, and note whether it reproduces every time. If a check cannot be done on this emulator (it is 411 dp wide, has a hardware keyboard, plays audio 400 ms late), mark it BLOCKED with the reason instead of guessing.

## 6. Teardown

Do every step, in this order, even when testing stopped early.

1. Put back what you changed on the device: profile name and handle (through the Profile screen), Appearance and Level units (through Settings), `cmd uimode night no` if you changed it, the original font scale (force-stop the app first).
2. `$P synth off`. The native code is now back to normal in the repo.
3. `$D stop-app` first: with the app open, Metro's Fast Refresh loads the cleanup the moment it is applied, and step 4 then logs `removed sessions=0 drills=0`. Then `$P cleanup on`, and rebuild and install from Git Bash as in step 3.2. This one build both drops the patched native code from the emulator and loads the cleanup. Check `$D metro` after the build and restart it as in step 3.3 if it died.
4. `$D log-clear`, `$D launch`, wait ~5 s, `$D log`. Expect a line `BRASSCOUNT-E2E removed sessions=N drills=M; left drills=… sessions=…`. A `cleanup failed` line is a finding; report it and the data left behind.
5. Check the baseline on screen: Drills count, History Runs / Drills and Profile counters and the profile fields all match what you wrote down. No `ZZE2E` drill is listed.
6. `$P cleanup off`, then `$P status` must say no patched files and no e2e markers. `git status --porcelain` must match the preflight snapshot exactly. If it does not, fix that before anything else; leaving test code in the user's tree is the worst outcome of this skill.
7. Relaunch once (`$D stop-app`, `$D launch`, wait until the Timer shows) while Metro serves the clean bundle. The device caches the last dev bundle it loaded, and until it does this the cached one still imports `e2eCleanup`, so the next launch without Metro, or with the user's own Metro on another branch, fails on the missing file.
8. `$D synth off` is unnecessary (the installed build no longer reads it), but remove the file anyway: `adb shell run-as com.brasscount.app rm -f files/e2e-synth.txt`.
9. Stop the Metro you started, if you started one, and only after step 7. Find it by its port (`netstat -ano | grep :8081`), not by its background task, which may already have ended while node kept running; check the PID's start time with `ps -W` and never stop the user's.
10. `$D emulator stop`. It shuts the emulator down gracefully if this run booted it, and leaves an emulator the user already had running alone.

## 7. Report

Report in chat, in this shape. Keep it scannable; the evidence lives in the per-check lines and the screenshot paths.

```markdown
## BrassCount e2e — <branch> @ <short sha> (<date>)

**Result:** <one sentence: e.g. "62 of 66 checks pass; 2 bugs found, 2 blocked.">

### Automated gate

lint ✅ · typecheck ✅ · Jest ✅ (N tests) · Kotlin ✅ · prettier (changed files) ✅

### Bugs found

1. **<short title>** — <area/check id>. Steps: … Expected: … Actual: … Reproduces: every time / 1 of 3. Evidence: <screenshot path, log line>.

### Results by area

| Area                    | Pass | Fail | Blocked | Notes |
| ----------------------- | ---- | ---- | ------- | ----- |
| 1 Launch and navigation | 3    | 0    | 0       |       |
| …                       |      |      |         |       |

### Blocked or not covered

- <check>: <why> (e.g. narrow-phone layout: the AVD is 411 dp wide)

### Cleanup

Test data removed (<sessions>, <drills>); profile, appearance and font scale restored; repo tree matches the start; emulator <stopped / left running because it was already up>.
```

Then list every failing or blocked check in the per-area detail beneath the table (one line each, with its id from the test plan) so the user can find the evidence. Say plainly what was not tested; do not round "untested" up to "works".
