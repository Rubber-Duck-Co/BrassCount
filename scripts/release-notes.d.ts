export interface Commit {
  subject: string;
  body: string;
}

export interface ParsedCommit {
  type: string | undefined;
  scope: string | undefined;
  text: string;
  pr: string | undefined;
}

export interface NotesInput {
  tag: string;
  previous: string | undefined;
  commits: readonly Commit[];
  repo: string | undefined;
  date: string;
}

export interface ReleaseNotesOptions {
  env?: Record<string, string | undefined>;
  /** Returns `git log` output for a range in the script's record format. */
  readLog?: (range: string) => string;
  now?: Date;
}

export function parseCommit(commit: Commit): ParsedCommit;
export function buildNotes(input: NotesInput): string;
export function parseLog(log: string): Commit[];
export function releaseNotes(
  args: readonly string[],
  options?: ReleaseNotesOptions,
): string;
