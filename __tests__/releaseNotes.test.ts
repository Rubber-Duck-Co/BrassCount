import {
  buildNotes,
  buildPlayNotes,
  parseCommit,
  parseLog,
  releaseNotes,
} from '../scripts/release-notes';

const merge = (subject: string, body = '') => ({ subject, body });

describe('parseCommit', () => {
  it('reads the type, scope, text and PR number from a merge subject', () => {
    expect(
      parseCommit(merge('feat(timer): time the draw from the beep (#202)')),
    ).toEqual({
      type: 'feat',
      scope: 'timer',
      text: 'Time the draw from the beep',
      pr: '202',
    });
  });

  it('drops the #minor and #major bump markers', () => {
    expect(
      parseCommit(merge('feat(redesign): Range Card redesign #minor (#222)'))
        .text,
    ).toBe('Range Card redesign');
    expect(parseCommit(merge('feat: new storage #major (#9)')).text).toBe(
      'New storage',
    );
  });

  it('reads the PR title from the body of a default merge message', () => {
    expect(
      parseCommit(
        merge(
          'Merge pull request #12 from owner/fix/timer-reset',
          '\nfix(timer): reset the clock on a new run\n\nDetails',
        ),
      ),
    ).toEqual({
      type: 'fix',
      scope: 'timer',
      text: 'Reset the clock on a new run',
      pr: '12',
    });
  });

  it('keeps the subject of a default merge message with no body', () => {
    expect(
      parseCommit(merge('Merge pull request #12 from owner/branch')),
    ).toMatchObject({ type: undefined, pr: '12' });
  });

  it('accepts any scope, a missing scope and a capitalised type', () => {
    expect(
      parseCommit(merge('feat(timer/ui): split the readout (#1)')),
    ).toEqual({
      type: 'feat',
      scope: 'timer/ui',
      text: 'Split the readout',
      pr: '1',
    });
    expect(parseCommit(merge('Fix: handle a missing mic'))).toEqual({
      type: 'fix',
      scope: undefined,
      text: 'Handle a missing mic',
      pr: undefined,
    });
  });

  it('takes the PR number only from the end of the subject', () => {
    expect(
      parseCommit(merge('fix: undo (#3) from the timer (#14)  ')),
    ).toMatchObject({ text: 'Undo (#3) from the timer', pr: '14' });
  });

  it('keeps a subject that is not a conventional commit as plain text', () => {
    expect(parseCommit(merge('update the readme'))).toEqual({
      type: undefined,
      scope: undefined,
      text: 'Update the readme',
      pr: undefined,
    });
  });
});

describe('buildNotes', () => {
  const base = {
    tag: 'v0.2.0',
    previous: 'v0.1.0',
    repo: 'owner/repo',
    date: '24 November 2026',
  };

  it('groups changes into New, Fixes and a collapsed Maintenance list', () => {
    const notes = buildNotes({
      ...base,
      commits: [
        merge('chore: bump version (minor) [skip ci]'),
        merge('ci(release): add a beta stage (#8)'),
        merge('fix(timer): keep the last word (#4)'),
        merge('feat(editor): hold-and-drag step reordering (#3)'),
        merge('chore: bump version (patch) [skip ci]'),
      ],
    });

    expect(notes).toBe(
      [
        'Released to Google Play on 24 November 2026.',
        '',
        '### New',
        '',
        '- **Editor:** Hold-and-drag step reordering (#3)',
        '',
        '### Fixes',
        '',
        '- **Timer:** Keep the last word (#4)',
        '',
        '<details><summary>Maintenance (1)</summary>',
        '',
        '- **Release:** Add a beta stage (#8)',
        '',
        '</details>',
        '',
        '**Full changelog:** [v0.1.0...v0.2.0](https://github.com/owner/repo/compare/v0.1.0...v0.2.0)',
        '',
      ].join('\n'),
    );
  });

  it('files perf under Fixes, add under New and counts Maintenance', () => {
    const notes = buildNotes({
      ...base,
      commits: [
        merge('perf(history): load runs lazily (#7)'),
        merge('add: a drill template'),
        merge('docs: explain calibration (#6)'),
        merge('test(timer): cover the reset (#5)'),
      ],
    });

    expect(notes).toContain('### New\n\n- A drill template\n');
    expect(notes).toContain(
      '### Fixes\n\n- **History:** Load runs lazily (#7)\n',
    );
    expect(notes).toContain('<summary>Maintenance (2)</summary>');
  });

  it('leaves out sections with no changes', () => {
    const notes = buildNotes({
      ...base,
      commits: [merge('fix: handle a missing mic (#5)')],
    });

    expect(notes).toContain('### Fixes\n\n- Handle a missing mic (#5)');
    expect(notes).not.toContain('### New');
    expect(notes).not.toContain('Maintenance');
  });

  it('says there were no changes when the range holds only bumps', () => {
    const notes = buildNotes({
      ...base,
      commits: [merge('chore: bump version (patch) [skip ci]')],
    });

    expect(notes).toContain('No changes since v0.1.0.');
    expect(notes).not.toContain('###');
  });

  it('writes one line instead of the whole history for the first release', () => {
    const notes = buildNotes({
      ...base,
      previous: undefined,
      commits: [merge('feat: everything (#1)')],
    });

    expect(notes).toBe(
      'Released to Google Play on 24 November 2026.\n\nThe first release of BrassCount on Google Play.\n',
    );
  });
});

describe('parseLog', () => {
  it('splits git log records into subjects and bodies', () => {
    const log =
      'feat: a (#2)\x1f### Summary\r\n\r\nText\n\x1e\n' +
      'chore: bump version (patch) [skip ci]\x1f\x1e\n';

    expect(parseLog(log)).toEqual([
      { subject: 'feat: a (#2)', body: '### Summary\r\n\r\nText' },
      { subject: 'chore: bump version (patch) [skip ci]', body: '' },
    ]);
  });

  it('returns no commits for an empty log', () => {
    expect(parseLog('')).toEqual([]);
  });
});

describe('releaseNotes', () => {
  const now = new Date('2026-11-24T12:00:00Z');
  const env = { GITHUB_REPOSITORY: 'owner/repo' };

  it('reads the log for the range between the two tags', () => {
    const readLog = jest.fn(() => 'fix: keep the split (#4)\x1f\x1e');

    const notes = releaseNotes(['v0.2.0', 'v0.1.0'], { env, readLog, now });

    expect(readLog).toHaveBeenCalledWith('v0.1.0..v0.2.0');
    expect(notes).toContain('Released to Google Play on 24 November 2026.');
    expect(notes).toContain('- Keep the split (#4)');
  });

  it('reads no log for the first release', () => {
    const readLog = jest.fn(() => '');

    releaseNotes(['v0.1.0'], { env: {}, readLog, now });

    expect(readLog).not.toHaveBeenCalled();
  });

  it('rejects a missing tag', () => {
    expect(() => releaseNotes([], { env, now })).toThrow(Error);
  });

  it('rejects a missing repository when there is a previous tag', () => {
    expect(() =>
      releaseNotes(['v0.2.0', 'v0.1.0'], { env: {}, readLog: () => '', now }),
    ).toThrow(Error);
  });
});

describe('buildPlayNotes', () => {
  it('lists New and Fixes as plain text without maintenance or PR numbers', () => {
    const notes = buildPlayNotes({
      previous: 'v0.1.0',
      commits: [
        merge('chore: bump version (minor) [skip ci]'),
        merge('ci(release): add a beta stage (#8)'),
        merge('fix(timer): keep the last word (#4)'),
        merge('feat(editor): hold-and-drag step reordering #minor (#3)'),
        merge('feat: export runs (#2)'),
      ],
    });

    expect(notes).toBe(
      [
        'New',
        '• Editor: Hold-and-drag step reordering',
        '• Export runs',
        'Fixes',
        '• Timer: Keep the last word',
      ].join('\n'),
    );
  });

  it('cuts whole lines to stay within 500 characters', () => {
    const commits = Array.from({ length: 30 }, (_, index) =>
      merge(
        `fix(timer): correct the split rounding case number ${index} (#${index})`,
      ),
    );

    const notes = buildPlayNotes({ previous: 'v0.1.0', commits });

    expect(notes.length).toBeLessThanOrEqual(500);
    expect(notes.startsWith('Fixes\n• Timer: Correct')).toBe(true);
    expect(notes.endsWith('\n…and more')).toBe(true);
    expect(notes).not.toContain('number 29');
  });

  it('keeps text of exactly 500 characters whole', () => {
    // 'Fixes\n• ' is 8 characters.
    const notes = buildPlayNotes({
      previous: 'v0.1.0',
      commits: [merge(`fix: ${'a'.repeat(492)}`)],
    });

    expect(notes).toBe(`Fixes\n• A${'a'.repeat(491)}`);
    expect(notes).toHaveLength(500);
  });

  it('keeps a line when it and the suffix make exactly 500 characters', () => {
    // 'Fixes\n• ' + 482 + '\n…and more' is 500.
    const notes = buildPlayNotes({
      previous: 'v0.1.0',
      commits: [
        merge(`fix: ${'a'.repeat(482)}`),
        merge(`fix: ${'b'.repeat(40)}`),
      ],
    });

    expect(notes).toBe(`Fixes\n• A${'a'.repeat(481)}\n…and more`);
    expect(notes).toHaveLength(500);
  });

  it('falls back to a generic line when the first change alone is too long', () => {
    const notes = buildPlayNotes({
      previous: 'v0.1.0',
      commits: [merge(`fix: ${'a'.repeat(493)}`)],
    });

    expect(notes).toBe('Bug fixes and improvements.');
  });

  it('removes backticks from the plain text', () => {
    expect(
      buildPlayNotes({
        previous: 'v0.1.0',
        commits: [merge('fix(history): handle `null` splits (#3)')],
      }),
    ).toBe('Fixes\n• History: Handle null splits');
  });

  it('does not end on a heading when the cut falls after one', () => {
    // Nine features fill the limit up to the Fixes heading, but not its first line.
    const notes = buildPlayNotes({
      previous: 'v0.1.0',
      commits: [
        ...Array.from({ length: 9 }, (_, index) =>
          merge(`feat: a long description of feature ${index} for the timer`),
        ),
        ...Array.from({ length: 3 }, (_, index) =>
          merge(`fix: a long description of fix number ${index} for the timer`),
        ),
      ],
    });

    expect(notes).not.toContain('Fixes');
    expect(notes.endsWith('feature 8 for the timer\n…and more')).toBe(true);
  });

  it('says bug fixes and improvements when there is only maintenance', () => {
    expect(
      buildPlayNotes({
        previous: 'v0.1.0',
        commits: [merge('ci: cache nothing (#9)')],
      }),
    ).toBe('Bug fixes and improvements.');
  });

  it('says first release when there is no previous tag', () => {
    expect(buildPlayNotes({ previous: undefined, commits: [] })).toBe(
      'First release.',
    );
  });
});

describe('releaseNotes --play', () => {
  it('writes the Play notes for the range without needing the repository', () => {
    const readLog = jest.fn(() => 'fix: keep the split (#4)\x1f\x1e');

    const notes = releaseNotes(['--play', 'abc123', 'v0.1.0'], {
      env: {},
      readLog,
    });

    expect(readLog).toHaveBeenCalledWith('v0.1.0..abc123');
    expect(notes).toBe('Fixes\n• Keep the split');
  });
});
