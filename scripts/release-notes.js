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
const PR_SUFFIX = / \(#(\d+)\)$/;
const BUMP_MARKER = /\s*#(?:minor|major)\b/g;
const CONVENTIONAL = /^(\w+)(?:\(([\w-]+)\))?!?: (.+)$/;

const capitalise = text => text.charAt(0).toUpperCase() + text.slice(1);

function parseCommit({ subject, body }) {
  let title = subject;
  let pr;
  const merge = DEFAULT_MERGE.exec(subject);
  if (merge) {
    pr = merge[1];
    const firstLine = body.split('\n').find(line => line.trim());
    title = firstLine ? firstLine.trim() : subject;
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
  return { type: match[1], scope: match[2], text: capitalise(match[3]), pr };
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

// Only main's own commits: the PR merges and bumps, not the branches' work.
function readCommits(range) {
  const log = execFileSync(
    'git',
    ['log', '--first-parent', '--format=%s%x1f%b%x1e', range],
    { encoding: 'utf8' },
  );
  return log
    .split('\x1e')
    .map(record => record.trim())
    .filter(Boolean)
    .map(record => {
      const [subject, body = ''] = record.split('\x1f');
      return { subject, body };
    });
}

function main([tag, previous]) {
  if (!tag) {
    throw new Error('Usage: release-notes.js <tag> [previous-tag]');
  }
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const commits = previous ? readCommits(`${previous}..${tag}`) : [];
  const repo = process.env.GITHUB_REPOSITORY;
  process.stdout.write(buildNotes({ tag, previous, commits, repo, date }));
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { parseCommit, buildNotes };
