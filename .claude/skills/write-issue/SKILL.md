---
name: write-issue
description: Write and file a GitHub issue for this repo from a rough description, using the matching issue template and linking blocked-by / blocking relationships to existing issues. Invoke manually with /write-issue, optionally with a type, e.g. "/write-issue bug", "/write-issue feature the timer drifts", or no type to have it inferred.
argument-hint: '[bug|feature|chore|docs|question|idea] [what the issue is about]'
disable-model-invocation: true
---

# Write Issue

File a well-formed GitHub issue: the right template, a body that fills its sections properly, and dependency links to related issues. The user invoked this on purpose, so do the whole job, but confirm before anything is posted, because an issue is public to everyone with repo access and notifies people.

Arguments from the user (may be empty): $ARGUMENTS

## 1. Work out the type and the subject

- If the first word of the arguments names a type (`bug`, `feature`, `chore`, `docs`/`documentation`, `question`, `idea`/`suggestion`), that is the type and the rest is the subject. Accept near-synonyms (`defect` → bug, `enhancement` → feature, `task`/`refactor` → chore).
- Otherwise infer the type from the subject. If the subject is also empty, take it from the recent conversation (what was just discussed or found). If there is nothing to go on, ask the user what the issue is about, once.
- Inference guide: something broken or behaving differently from what was intended is a bug; new or changed behaviour is a feature; internal upkeep (refactors, dependency bumps, CI, tooling, cleanup) is a chore; wrong or missing docs is docs; "how do I…" is a question; a vague "it would be nice if…" with no commitment is an idea. When two fit, pick the one the user's wording leans toward, and say which you picked and why in the confirmation step. Do not interrogate the user over it.

## 2. Find and read the template

Templates live in `.github/ISSUE_TEMPLATE/`. List the directory and read the one that matches the type; do not assume what is in it, since templates change. Match on the template's `name`, `title` prefix and `labels`, not just the filename (here `suggestion.yml` is the "Idea" template and `bug_report.yml` the bug one).

Why this matters: the title prefix and label drive the project's triage and release labelling, and the section headings keep issues consistent. An issue that ignores the template is noise the maintainer has to fix by hand.

From the template take:

- **Title**: its `title:` prefix (e.g. `[FEATURE] `) followed by a short, specific summary. No trailing period.
- **Labels**: its `labels:` list.
- **Body**: one `### <label>` heading per form field, in the template's order, with the content under it. `gh issue create` cannot submit a YAML form, so build the markdown body yourself from the fields' `label:` values. For a Markdown template (`.md` with front matter), use its body as the skeleton.
- Fill every field marked `required: true`. For optional fields, fill them when you have something real to say and leave them out when you would only be padding; never invent reproduction steps, versions or motivations the user did not give you and the repo does not show. If a required field cannot be filled from what you know, ask the user for exactly that.
- Use each field's `description` and `placeholder` to understand what belongs there.

If there is no template for the type, or the repo has no templates, write a plain issue with a clear title, a short summary, and the details a reader needs to act (for a bug: steps, expected, actual).

Ground the body in the codebase when that makes it better: name the real file, screen or function involved after checking it exists. Keep it concise, written for a maintainer who has not seen this conversation.

## 3. Check existing issues for relationships

Before drafting is final, look for related issues so dependencies are recorded properly instead of rediscovered later.

1. Identify the repo: `gh repo view --json nameWithOwner --jq .nameWithOwner`.
2. List open issues: `gh issue list --state open --limit 200 --json number,title,labels,body`. Also search by the subject's key terms, including closed issues, with `gh issue list --state all --search "<terms>" --limit 30 --json number,title,state`, so you spot duplicates and recently finished prerequisites.
3. Decide, for each plausible candidate, which of these is true, being strict:
   - **Blocked by** an open issue: this work cannot start or finish until that one is done (it needs its code, decision or infrastructure).
   - **Blocks** an open issue: that issue cannot proceed until this one is done.
   - **Duplicate**: it already covers the same thing. Do not file a new issue; show the user the existing one and ask how to proceed.
   - **Merely related**: same area or theme but no ordering. Mention it in the body as `Related: #N` if it helps a reader, but do not create a dependency link.
4. Closed issues are never blockers. A shared topic is not a dependency; only link when finishing one genuinely gates the other, because false links make the dependency graph untrustworthy.

## 4. Confirm, then create

Show the user the draft before posting: title, labels, the full body, and the dependencies you intend to set (each as "blocked by #N — reason" or "blocks #N — reason"), plus the type you chose if you inferred it. Ask for a go-ahead. If they edit something, apply it and proceed without re-asking unless the change is large.

After approval:

1. Write the body to a file in the scratchpad directory and create the issue with `gh issue create --title ... --label ... --body-file ...`. A body file avoids shell-quoting damage to backticks and multi-line text. Capture the new issue number from the URL it prints.
2. Set the dependencies with GitHub's blocked-by relationship, not just a "Blocked by #N" line in the body. The API takes the blocker's **numeric id**, not its issue number:

   ```bash
   # numeric id of the blocking issue
   BLOCKER_ID=$(gh api repos/{owner}/{repo}/issues/<blocker-number> --jq .id)
   # record "<blocked-number> is blocked by <blocker-number>"
   gh api -X POST repos/{owner}/{repo}/issues/<blocked-number>/dependencies/blocked_by -F issue_id=$BLOCKER_ID
   ```

   - New issue is blocked by #N: `<blocked-number>` is the new issue, the blocker is #N.
   - New issue blocks #N: `<blocked-number>` is #N, the blocker is the new issue.
   - Use `-F` (not `-f`) so the id is sent as a number.

3. Verify each link by reading it back: `gh api repos/{owner}/{repo}/issues/<blocked-number>/dependencies/blocked_by --jq '.[].number'` should list the blocker. If a call fails (for example the API is unavailable for the repo), say so and fall back to a clear `Blocked by #N` line added to the issue body, telling the user it is not a formal link.

## 5. Report

Reply briefly: the issue URL, the template and labels used, and each dependency link with a note that it was verified. If you skipped a candidate because it was only related or a duplicate, say so in a line. Do not restate the whole body.

## Guardrails

- Create exactly the issue(s) the user asked for. Do not edit, comment on, close or relabel other issues; dependency links are the only change to existing issues, and they are shown in the confirmation first.
- Never put secrets, tokens, local file paths from the user's machine, or personal data in an issue body.
- If `gh` is not authenticated or the repo has no GitHub remote, stop and tell the user what is missing rather than guessing.
