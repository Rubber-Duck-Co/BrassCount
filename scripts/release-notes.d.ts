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

export function parseCommit(commit: Commit): ParsedCommit;
export function buildNotes(input: NotesInput): string;
