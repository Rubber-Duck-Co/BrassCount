import { buildNotes, parseCommit } from '../scripts/release-notes';

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

  it('leaves out sections with no changes', () => {
    const notes = buildNotes({
      ...base,
      commits: [merge('fix: handle a missing mic (#5)')],
    });

    expect(notes).toContain('### Fixes\n\n- Handle a missing mic (#5)');
    expect(notes).not.toContain('### New');
    expect(notes).not.toContain('Maintenance');
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
