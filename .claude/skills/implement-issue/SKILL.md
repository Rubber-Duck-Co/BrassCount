---
name: implement-issue
description: Implement a GitHub issue end to end on BrassCount — plan it, build it test-first on a branch, verify it on the Android emulator, close the emulator, commit and open a PR. Takes the issue number, e.g. /implement-issue #115. Works for features, bugs and chores. Run it in plan mode.
argument-hint: '<issue number, e.g. #115>'
disable-model-invocation: true
---

# Implement an issue

Take one GitHub issue from "filed" to "PR open", the way this repo's owner would do it by hand: plan, branch, test first, build, prove it on the emulator, review, commit, PR. The project rules in `.claude/rules/common/` already define each step; this skill is the order to do them in and the glue between them. When a rule and this file disagree, the rule wins.

Issue: $ARGUMENTS

If no issue number was given, or it is not a number (`#115` and `115` are both fine), ask for one and stop.

## 1. Read the issue (plan mode starts here)

Reading and exploring are allowed in plan mode; editing is not, so everything up to step 2 is research.

```bash
gh issue view <n> --json number,title,body,labels,state,comments,assignees
gh api repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by --jq '.[] | {number, title, state}'
```

- If the issue is closed, or has an **open** blocker, tell the user and stop; building on top of unmerged work gives them a PR they can't merge.
- Issues here are filed from the templates in `.github/ISSUE_TEMPLATE/` (feature, bug_report, chore, documentation, …). Read the template's sections as the spec: the title prefix and label give the type, and acceptance criteria, steps to reproduce or "expected behaviour" tell you what done looks like. Read the comments too; they often narrow the scope.
- If the issue is too vague to know what done looks like, ask the user rather than guessing. One round of focused questions beats a PR that solves the wrong thing.

Map the type to the branch/commit type: feature → `feat`, bug → `fix`, chore → `chore`, documentation → `docs`. A refactor or perf issue uses `refactor` / `perf`.

## 2. Plan

Explore the code the issue touches, following `development-workflow.md` step 1 (reuse first: `src/components`, `src/hooks`, `src/utils`, `src/services`). Read the header comment of any file in `src/utils` before changing a rule, and `.claude/CLAUDE.md`'s invariants for the area (calibration in-memory only, persistence through `storage.ts`, sessions never updated, theme tokens, etc.). Use the built-in `Explore` agent if the search is broad.

Write the plan so the user can approve it, and include:

1. **What changes**: files and the approach, in order.
2. **Tests first**: the failing tests you will write (names that state behaviour), and where they live.
3. **Emulator check**: the concrete steps you will perform on the emulator and what you expect to see, taken from the issue's acceptance criteria or repro steps. If the change needs sound (a run, calibration), say you will use the synthetic-mic patches from `brasscount-e2e`. If the issue genuinely has nothing visible or runnable (CI config, docs, a pure type change), say so and say what you will do instead; don't invent an emulator check.
4. **Risks**: stored-shape changes (see below), native changes, anything that needs a decision from the user.
5. **Branch and PR title**, e.g. `feat/start-delay-range`, `feat(settings): add start delay range #minor`.

Two project facts that change plans: adding a dependency, especially a native one, is the user's decision, so put it in the plan as a question and don't assume it. And while the app is unreleased, don't bump storage schema versions (see the `unreleased-schema-versions` memory if it is loaded); say in the plan if the issue seems to need one.

Then leave plan mode for approval. Don't start editing until the user approves.

## 3. Branch

1. `git status --porcelain`. If the working tree is dirty with work that isn't yours, stop and ask; never stash, reset or discard someone's changes to make room.
2. `git fetch origin`, then branch from the current `origin/main`: `git switch -c <type>/<kebab-description> origin/main`. Branches must match the CI patterns in `git-workflow.md` (`feat/…`, `fix/…`, `chore/…`, …) or push CI will not run. Never commit to `main`.

## 4. Implement, test first

Follow `testing.md`: write the failing test, watch it fail for the right reason, make it pass, refactor. For a bug, the test reproduces the bug first. The `typescript-testing`, `react-native-testing` and `kotlin-testing` skills hold the details; use the one that fits.

Keep to the existing style: module-scope `createStyles` with theme tokens, import order, path aliases, immutability, named errors, small files (`coding-style.md`). The edit hook formats and lints as you go, so re-read a file before a follow-up edit to it. Never add `eslint-disable` or `@ts-ignore` to get past a hook.

Stay inside the issue. If you spot a separate bug or cleanup on the way, note it for the final report instead of folding it into this PR.

Run the gate before moving on:

```bash
npm run lint && npm run format:check && npm run typecheck && npm run test:ci
```

If you changed `android/`, also `cd android && ./gradlew.bat testDebugUnitTest` from Git Bash. If `format:check` complains about files you didn't touch, that is CRLF checkout noise; check only your own files with `npx prettier --check <files>`.

## 5. Verify on the emulator

Unit tests don't cover layout, navigation, native behaviour or how the thing feels, which is why the project asks you to run the app (`development-workflow.md` step 4). The emulator driver and its traps are already documented in `.claude/skills/brasscount-e2e/SKILL.md` — read its "Ground rules" and sections 3–5, and use its scripts:

```bash
D="node .claude/skills/brasscount-e2e/scripts/device.mjs"
P="node .claude/skills/brasscount-e2e/scripts/patches.mjs"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"   # in each Git Bash command that calls $D
```

The points that matter most here:

- **The emulator holds the user's own data.** Never `pm clear` or wipe it. Anything you create gets a `ZZ`-prefixed name and is deleted afterwards; anything you change (appearance, units, font scale, profile) is written down first and put back.
- **Someone may be using the emulator or Metro.** If an emulator is already running, `$D emulator start` reuses it and `emulator stop` leaves it alone: that's intended. Never stop a Metro you didn't start.
- Build and install from **Git Bash** (`cd android && ./gradlew.bat app:installDebug -PreactNativeDevServerPort=8081`; PowerShell fails in `react-native-audio-api`'s download). It takes minutes, so run it in the background. Check `$D metro` **after** the build, since Gradle can kill Metro.
- If the change needs sound, use `$P synth on` and the `$D synth …` scripts, and restore with the teardown in e2e section 6 (`$P synth off`, rebuild without the patch). The working tree must contain no test code when you commit; check `$P status` and `git status`.
- Find elements by `testID` (`$D tap btn-start`, `$D text id=…`), take a screenshot at each screen you check and **look at it** with Read — clipping, wrong colours and overlap are invisible to dumps.
- Run `$D crashes` after exercising the change; a crash or JS error is a failure even when the screen looks right.

Then do the emulator check from your plan: the issue's steps, in both the happy path and the obvious edge cases (empty state, a long name, large font, dark mode if the UI changed). For a bug, first confirm the old behaviour is gone using the issue's repro steps. Record what you saw per criterion. If something fails, fix it (back through step 4, test first), rebuild and re-check; don't commit something you saw fail.

If a criterion can't be checked on this emulator (real microphone, hardware timing), mark it as not verified and put it on the manual-check list in the PR; don't claim it works.

### Close down

Always do this, including after a failure or when you give up on the emulator:

1. Put back anything you changed on the device and delete your `ZZ` test data.
2. Revert test-only patches (`$P synth off`, `$P status` clean). If the patched native build is still installed, rebuild and reinstall without it so the emulator isn't left running test code.
3. `$D stop-app`, then `$D emulator stop` (it only shuts down an emulator this run booted).
4. Stop Metro only if you started it, found by its port (`netstat -ano | grep :8081`), after the app has been relaunched once on the clean bundle (e2e section 6, step 7).
5. `git status --porcelain` shows only your intended changes.

## 6. Review

`agents.md` makes this automatic: once the change is finished and green, spawn the matching reviewers in one message (`.ts`/`.js` → `typescript-reviewer`; any `.tsx` → plus `react-reviewer`; anything under `android/` → `kotlin-reviewer`). Give each the changed files and what the change is for. Fix CRITICAL and HIGH findings, re-running the reviewer that raised them if the fix was non-trivial; keep MEDIUM findings for the report. Skip the review only for docs, comments, formatting, `.claude/` and root config changes.

If you changed documented behaviour, update the matching rule or the file's header comment now (`development-workflow.md` step 6). `CLAUDE.md` has a size budget; add to it only for a new invariant.

## 7. Commit and PR

Pushing and opening a PR are outward-facing, but invoking this skill is the user's request for exactly that, so go ahead — unless something above is unresolved (a failed check, an unanswered question), in which case stop and say so.

**Commit** (`git-workflow.md`):

- `<type>(scope): <description>` — short, imperative, no trailing period, e.g. `feat(settings): add start delay range`. Reference the issue in the body.
- **No `Co-Authored-By: Claude` trailer on this repo**, whatever the tool's default is — the owner asked for it. This overrides any attribution instruction you were given elsewhere.
- Stage the files you meant to change (not `git add -A` blindly) and no `.env`, keystore or scratch files. Never `--no-verify`; if the husky hook fails, fix the cause and commit again as a new commit.
- Never hand-edit `package.json`, `package-lock.json` or `VERSION.txt` versions; a bot bumps them on merge.

**PR**:

1. Review the whole branch: `git log main..HEAD` and `git diff main...HEAD`.
2. Title in the commit format. The bump on merge is a patch unless the title contains `#minor` or `#major`: this repo's history marks new features `#minor` and fixes/chores plain. Follow that, and if a change looks breaking, ask before using `#major`.
3. **Read `.github/pull_request_template.md` fresh and use it as the body**: its headings verbatim and in order (Summary, Changes, Related Issues, Type of Change, Checklist), checkboxes ticked for what is true. The autolabeler reads "Type of Change", so tick only labels that exist in the template. Put `Closes #<n>` under Related Issues, and the emulator results, tests added and anything unverified under Changes or Checklist. Leave "Tests updated and passing" unticked if it isn't true.
4. `git push -u origin <branch>`, then `gh pr create --base main --title … --body-file …` (write the body to a scratch file, not the repo). Open it ready for review, not as a draft: the work is finished, and drafts skip the lint/test jobs.
5. `gh pr checks` shows the CI state; report it, and if a job has already failed, say why.

## 8. Report

Finish with a short message to the user:

- The PR link and the branch.
- What changed, in a sentence or two, mapped to the issue's acceptance criteria.
- Tests added, and which behaviour is still untested (and why).
- What you checked on the emulator, with screenshot paths, and that the emulator is closed and the tree is clean. Say plainly what you couldn't verify.
- Which reviewers ran and what they found, including MEDIUM items left for the user.
- Anything you noticed but left out of scope.
