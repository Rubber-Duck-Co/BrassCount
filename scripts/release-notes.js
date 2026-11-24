#!/usr/bin/env node
// Prints the GitHub release notes for a tag, built from the PR merge commits
// on main since the previous tag.
//   node scripts/release-notes.js <tag> [previous-tag]
const { execFileSync } = require('node:child_process');

const SECTIONS = [
  { title: 'New', types: ['feat', 'add'] },
  { title: 'Fixes', types: ['fix', 'perf'] },
];
const BUMP_COMMIT = /^chore: bump version\b/;
// GitHub's "Default message" merge subject; the PR title is then the body.
const DEFAULT_MERGE = /^Merge pull request #(\d+) from \S+$/;
const PR_SUFFIX = /\s+\(#(\d+)\)$/;
const BUMP_MARKER = /\s*#(?:minor|major)\b/g;
const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?!?:\s+(.+)$/;
// Record and field separators in the git log format.
const RECORD = '\x1e';
const FIELD = '\x1f';

const capitalise = text => text.charAt(0).toUpperCase() + text.slice(1);

function parseCommit({ subject, body }) {
  let title = subject.trim();
  let pr;
  const merge = DEFAULT_MERGE.exec(title);
  if (merge) {
    pr = merge[1];
    const firstLine = body.split('\n').find(line => line.trim());
    title = firstLine ? firstLine.trim() : title;
  }
  const suffix = PR_SUFFIX.exec(title);
  if (suffix) {
    pr = suffix[1];
    title = title.slice(0, suffix.index);
  }
  title = title.replace(BUMP_MARKER, '').trim();
  const match = CONVENTIONAL.exec(title);
  if (!match) {
    return { type: undefined, scope: undefined, text: capitalise(title), pr };
  }
  return {
    type: match[1].toLowerCase(),
    scope: match[2],
    text: capitalise(match[3]),
    pr,
  };
}

function formatEntry({ scope, text, pr }) {
  const label = scope ? `**${capitalise(scope)}:** ` : '';
  return `- ${label}${text}${pr ? ` (#${pr})` : ''}`;
}

function buildNotes({ tag, previous, commits, repo, date }) {
  const lines = [`Released to Google Play on ${date}.`];
  if (!previous) {
    lines.push('', 'The first release of BrassCount on Google Play.');
    return `${lines.join('\n')}\n`;
  }

  const entries = commits
    .filter(commit => !BUMP_COMMIT.test(commit.subject))
    .map(parseCommit);
  if (entries.length === 0) {
    lines.push('', `No changes since ${previous}.`);
  }
  const maintenance = entries.filter(
    entry => !SECTIONS.some(section => section.types.includes(entry.type)),
  );
  for (const section of SECTIONS) {
    const items = entries.filter(entry => section.types.includes(entry.type));
    if (items.length > 0) {
      lines.push('', `### ${section.title}`, '', ...items.map(formatEntry));
    }
  }
  if (maintenance.length > 0) {
    lines.push(
      '',
      `<details><summary>Maintenance (${maintenance.length})</summary>`,
      '',
      ...maintenance.map(formatEntry),
      '',
      '</details>',
    );
  }
  const compare = `https://github.com/${repo}/compare/${previous}...${tag}`;
  lines.push('', `**Full changelog:** [${previous}...${tag}](${compare})`);
  return `${lines.join('\n')}\n`;
}

function parseLog(log) {
  return log
    .split(RECORD)
    .map(record => record.trim())
    .filter(Boolean)
    .map(record => {
      const [subject, body = ''] = record.split(FIELD);
      return { subject, body: body.trim() };
    });
}

// Only main's own commits: the PR merges and bumps, not the branches' work.
const readGitLog = range =>
  execFileSync(
    'git',
    ['log', '--first-parent', `--format=%s${FIELD}%b${RECORD}`, range],
    // Merge commits carry the whole PR description.
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

function releaseNotes(
  [tag, previous],
  { env = process.env, readLog = readGitLog, now = new Date() } = {},
) {
  if (!tag) {
    throw new Error('Usage: release-notes.js <tag> [previous-tag]');
  }
  const repo = env.GITHUB_REPOSITORY;
  if (previous && !repo) {
    throw new Error('GITHUB_REPOSITORY (owner/name) is not set.');
  }
  const date = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const commits = previous ? parseLog(readLog(`${previous}..${tag}`)) : [];
  return buildNotes({ tag, previous, commits, repo, date });
}

if (require.main === module) {
  try {
    process.stdout.write(releaseNotes(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`release-notes: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseCommit, buildNotes, parseLog, releaseNotes };
