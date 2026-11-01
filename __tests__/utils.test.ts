import {
  dbfsToLevel,
  formatDate,
  formatDateTime,
  formatElapsed,
  formatLevel,
  formatSeconds,
  formatSignedFigure,
  formatSignedSeconds,
  formatTimeAgo,
  pluralize,
  spokenDateTime,
  spokenLevel,
  spokenSeconds,
  spokenTimeAgo,
} from '@utils/format';
import { generateId } from '@utils/id';
import { getTimestamp } from '@utils/timestamp';

describe('format utilities', () => {
  it('formats elapsed time', () => {
    expect(formatElapsed(0)).toBe('0.00');
    expect(formatElapsed(65.25)).toBe('1:05.25');
    expect(formatElapsed(-1)).toBe('0.00');
  });

  it('formats seconds', () => {
    expect(formatSeconds(1.236)).toBe('1.24s');
  });

  describe('levels', () => {
    it('maps -60 dBFS to 0 and full scale to 100 on the level scale', () => {
      expect(dbfsToLevel(-60)).toBe(0);
      expect(dbfsToLevel(-30)).toBe(50);
      expect(dbfsToLevel(0)).toBe(100);
    });

    it('clamps a reading outside -60 to 0 dBFS to the ends of the level scale', () => {
      expect(dbfsToLevel(-60.1)).toBe(0);
      expect(dbfsToLevel(-160)).toBe(0);
      expect(dbfsToLevel(3)).toBe(100);
    });

    it('rounds a level to a whole number, never -0', () => {
      // 49.5 rounds up and 49.17 down, so floor or ceil would fail one.
      expect(dbfsToLevel(-30.3)).toBe(50);
      expect(dbfsToLevel(-30.5)).toBe(49);
      expect(Object.is(dbfsToLevel(-60.4), 0)).toBe(true);
    });

    it('formats a level on the 0 to 100 scale, or a dash when there is none', () => {
      expect(formatLevel(-12.4, 'level')).toBe('79');
      expect(formatLevel(-60, 'level')).toBe('0');
      expect(formatLevel(-160, 'level')).toBe('0');
      expect(formatLevel(0, 'level')).toBe('100');
      expect(formatLevel(null, 'level')).toBe('—');
    });

    it('formats a level in whole dBFS, or a dash when there is none', () => {
      expect(formatLevel(-12.4, 'dbfs')).toBe('-12 dBFS');
      expect(formatLevel(-12.6, 'dbfs')).toBe('-13 dBFS');
      expect(formatLevel(0, 'dbfs')).toBe('0 dBFS');
      expect(formatLevel(-0.4, 'dbfs')).toBe('0 dBFS');
      expect(formatLevel(-160, 'dbfs')).toBe('-160 dBFS');
      expect(formatLevel(null, 'dbfs')).toBe('—');
    });

    it('words a level on the 0 to 100 scale for a screen reader', () => {
      expect(spokenLevel(-12.4, 'level')).toBe('level 79');
      expect(spokenLevel(-160, 'level')).toBe('level 0');
      expect(spokenLevel(null, 'level')).toBe('not set');
    });

    it('words a dBFS level for a screen reader', () => {
      expect(spokenLevel(-12.4, 'dbfs')).toBe('minus 12 decibels full scale');
      expect(spokenLevel(0, 'dbfs')).toBe('0 decibels full scale');
      expect(spokenLevel(-0.4, 'dbfs')).toBe('0 decibels full scale');
      expect(spokenLevel(null, 'dbfs')).toBe('not set');
    });
  });

  it('formats dates and handles invalid input', () => {
    expect(formatDate('invalid-date')).toBe('—');
    expect(formatDate('2026-08-15T00:00:00.000Z')).toContain('2026');
  });

  it('pluralizes nouns', () => {
    expect(pluralize(1, 'drill')).toBe('1 drill');
    expect(pluralize(3, 'drill')).toBe('3 drills');
  });
});

describe('spokenSeconds', () => {
  it('says a duration in words', () => {
    expect(spokenSeconds(0.25)).toBe('0.25 seconds');
    expect(spokenSeconds(1.5)).toBe('1.5 seconds');
    expect(spokenSeconds(60)).toBe('60 seconds');
  });

  it('says exactly one second in the singular', () => {
    expect(spokenSeconds(1)).toBe('1 second');
  });
});

describe('formatSignedSeconds', () => {
  it('shows a longer time with a plus and a shorter one with a minus', () => {
    expect(formatSignedSeconds(0.7)).toBe('+0.70s');
    expect(formatSignedSeconds(-0.08)).toBe('-0.08s');
    expect(formatSignedSeconds(12.346)).toBe('+12.35s');
  });

  it('shows no difference without a sign', () => {
    expect(formatSignedSeconds(0)).toBe('0.00s');
  });

  it('never shows a signed zero for a difference too small to show', () => {
    expect(formatSignedSeconds(-0.004)).toBe('0.00s');
    expect(formatSignedSeconds(0.004)).toBe('0.00s');
  });
});

describe('formatSignedFigure', () => {
  it('shows a longer time with a plus and a shorter one with a true minus', () => {
    expect(formatSignedFigure(0.11)).toBe('+0.11');
    expect(formatSignedFigure(-0.01)).toBe('−0.01');
    expect(formatSignedFigure(12.346)).toBe('+12.35');
  });

  it('shows no difference without a sign', () => {
    expect(formatSignedFigure(0)).toBe('0.00');
  });

  it('never shows a signed zero for a difference too small to show', () => {
    expect(formatSignedFigure(-0.004)).toBe('0.00');
    expect(formatSignedFigure(0.004)).toBe('0.00');
  });
});

describe('date and time', () => {
  const MORNING = '2026-08-15T09:05:00.000Z';
  const LATER = '2026-08-15T09:47:00.000Z';

  it('shows the date, then the time of day', () => {
    const shown = formatDateTime(MORNING);

    expect(shown.startsWith(`${formatDate(MORNING)} · `)).toBe(true);
    // Hour and minute, in whichever of 12 or 24 hour form the device uses.
    expect(shown.split(' · ')[1]).toMatch(/\d{1,2}\D\d{2}/);
  });

  it('tells two runs made on the same day apart', () => {
    expect(formatDate(MORNING)).toBe(formatDate(LATER));
    expect(formatDateTime(MORNING)).not.toBe(formatDateTime(LATER));
  });

  it('shows a dash for text that is not a time', () => {
    expect(formatDateTime('invalid-date')).toBe('—');
  });

  it('words a date and time for a screen reader', () => {
    const spoken = spokenDateTime(MORNING);

    expect(spoken).toContain('2026');
    expect(spoken).toContain(' at ');
    // The month in full, and no dot for the reader to trip on.
    expect(spoken).toContain('August');
    expect(spoken).not.toContain('·');
  });

  it('says so when the text is not a time', () => {
    expect(spokenDateTime('invalid-date')).toBe('an unknown date');
  });
});

describe('time ago', () => {
  const NOW = Date.parse('2026-10-12T12:00:00.000Z');
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  /** The ISO-8601 time `ms` before `NOW`. */
  const ago = (ms: number): string => new Date(NOW - ms).toISOString();

  it('says just now for anything under a minute', () => {
    expect(formatTimeAgo(ago(0), NOW)).toBe('just now');
    expect(formatTimeAgo(ago(MINUTE - 1), NOW)).toBe('just now');
  });

  it('counts in the largest unit that fits', () => {
    expect(formatTimeAgo(ago(MINUTE), NOW)).toBe('1m ago');
    expect(formatTimeAgo(ago(59 * MINUTE), NOW)).toBe('59m ago');
    expect(formatTimeAgo(ago(HOUR), NOW)).toBe('1h ago');
    expect(formatTimeAgo(ago(23 * HOUR), NOW)).toBe('23h ago');
    expect(formatTimeAgo(ago(DAY), NOW)).toBe('1d ago');
    expect(formatTimeAgo(ago(6 * DAY), NOW)).toBe('6d ago');
    expect(formatTimeAgo(ago(7 * DAY), NOW)).toBe('1w ago');
    expect(formatTimeAgo(ago(29 * DAY), NOW)).toBe('4w ago');
    expect(formatTimeAgo(ago(30 * DAY), NOW)).toBe('1mo ago');
    expect(formatTimeAgo(ago(364 * DAY), NOW)).toBe('12mo ago');
    expect(formatTimeAgo(ago(365 * DAY), NOW)).toBe('1y ago');
    expect(formatTimeAgo(ago(800 * DAY), NOW)).toBe('2y ago');
  });

  it('rounds down, so a time is never made out to be older than it is', () => {
    expect(formatTimeAgo(ago(2 * DAY - 1), NOW)).toBe('1d ago');
    expect(formatTimeAgo(ago(2 * HOUR - 1), NOW)).toBe('1h ago');
  });

  it('says just now for a time stamped by a clock that was ahead', () => {
    expect(formatTimeAgo(ago(-3 * DAY), NOW)).toBe('just now');
    expect(spokenTimeAgo(ago(-3 * DAY), NOW)).toBe('just now');
  });

  it('shows a dash for text that is not a time', () => {
    expect(formatTimeAgo('invalid-date', NOW)).toBe('—');
  });

  it('measures from the current time when none is given', () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    try {
      expect(formatTimeAgo(ago(3 * HOUR))).toBe('3h ago');
      expect(spokenTimeAgo(ago(3 * HOUR))).toBe('3 hours ago');
    } finally {
      jest.useRealTimers();
    }
  });

  it('words a time ago for a screen reader', () => {
    expect(spokenTimeAgo(ago(30_000), NOW)).toBe('just now');
    expect(spokenTimeAgo(ago(MINUTE), NOW)).toBe('1 minute ago');
    expect(spokenTimeAgo(ago(5 * HOUR), NOW)).toBe('5 hours ago');
    expect(spokenTimeAgo(ago(DAY), NOW)).toBe('1 day ago');
    expect(spokenTimeAgo(ago(15 * DAY), NOW)).toBe('2 weeks ago');
    expect(spokenTimeAgo(ago(90 * DAY), NOW)).toBe('3 months ago');
    expect(spokenTimeAgo(ago(365 * DAY), NOW)).toBe('1 year ago');
    expect(spokenTimeAgo('invalid-date', NOW)).toBe('at an unknown time');
  });
});

describe('timestamp utility', () => {
  it('returns a valid ISO timestamp', () => {
    const timestamp = getTimestamp();

    expect(timestamp).toBe(new Date(timestamp).toISOString());
  });
});

describe('uuid generate utility', () => {
  it('generates a valid UUID v4', () => {
    const id = generateId();

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('generates unique IDs', () => {
    expect(generateId()).not.toBe(generateId());
  });
});
