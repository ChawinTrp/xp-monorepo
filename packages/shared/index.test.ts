import {
  localDateStr,
  parseLocalDate,
  getWeekStart,
  getWeekDates,
  logicalDateStr,
  addDays,
  DAY_CUTOFF_HOUR,
  dayWon,
  weekWon, weekPenalty,
  WIN_RULES,
} from './index';

describe('parseLocalDate', () => {
  it('returns local midnight for a YYYY-MM-DD string', () => {
    const d = parseLocalDate('2026-06-11');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June (0-indexed)
    expect(d.getDate()).toBe(11);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });
});

describe('localDateStr', () => {
  it('round-trips with parseLocalDate', () => {
    for (const s of ['2026-06-11', '2026-01-01', '2025-12-31', '2024-02-29']) {
      expect(localDateStr(parseLocalDate(s))).toBe(s);
    }
  });

  it('zero-pads single-digit month and day', () => {
    expect(localDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('getWeekStart (Sunday-start)', () => {
  it('returns the same date for a Sunday input', () => {
    // 2026-06-07 is a Sunday
    expect(getWeekStart('2026-06-07')).toBe('2026-06-07');
  });

  it('returns the preceding Sunday for a Saturday input', () => {
    // 2026-06-13 is a Saturday
    expect(getWeekStart('2026-06-13')).toBe('2026-06-07');
  });

  it('rolls back across a month boundary', () => {
    // 2026-05-01 is a Friday; its week starts Sunday 2026-04-26
    expect(getWeekStart('2026-05-01')).toBe('2026-04-26');
  });

  it('rolls back across a year boundary', () => {
    // 2026-01-01 is a Thursday; its week starts Sunday 2025-12-28
    expect(getWeekStart('2026-01-01')).toBe('2025-12-28');
  });
});

describe('getWeekDates', () => {
  it('returns 7 consecutive local dates Sun..Sat across a month boundary', () => {
    // 2026-06-28 is a Sunday; the week spans into July
    expect(getWeekDates('2026-06-28')).toEqual([
      '2026-06-28',
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
    ]);
  });

  it('starts at the given Sunday and stays within the month when no boundary is crossed', () => {
    const dates = getWeekDates('2026-06-07');
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-06-07');
    expect(dates[6]).toBe('2026-06-13');
  });
});

describe('logicalDateStr (5am cutoff)', () => {
  it('cutoff constant is 5am', () => {
    expect(DAY_CUTOFF_HOUR).toBe(5);
  });

  it('maps an instant just before 5am back to the previous calendar day', () => {
    // 2026-06-14 04:59 local → still the 13th's logical day
    expect(logicalDateStr(new Date(2026, 5, 14, 4, 59, 59))).toBe('2026-06-13');
  });

  it('maps 5:00am exactly to the same calendar day', () => {
    expect(logicalDateStr(new Date(2026, 5, 14, 5, 0, 0))).toBe('2026-06-14');
  });

  it('maps midday to the same calendar day', () => {
    expect(logicalDateStr(new Date(2026, 5, 14, 12, 0, 0))).toBe('2026-06-14');
  });

  it('rolls back across a month boundary before 5am', () => {
    // 2026-07-01 02:00 local → still June 30th's logical day
    expect(logicalDateStr(new Date(2026, 6, 1, 2, 0, 0))).toBe('2026-06-30');
  });

  it('rolls back across a year boundary before 5am', () => {
    // 2026-01-01 03:00 local → still 2025-12-31's logical day
    expect(logicalDateStr(new Date(2026, 0, 1, 3, 0, 0))).toBe('2025-12-31');
  });
});

describe('addDays', () => {
  it('shifts a date string forward', () => {
    expect(addDays('2026-06-13', 1)).toBe('2026-06-14');
  });

  it('shifts backward with a negative offset', () => {
    expect(addDays('2026-06-13', -1)).toBe('2026-06-12');
  });

  it('crosses a month boundary', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('round-trips with its own inverse', () => {
    expect(addDays(addDays('2026-03-15', 10), -10)).toBe('2026-03-15');
  });
});

describe('win rules', () => {
  it('dayWon requires both routine and task thresholds', () => {
    expect(dayWon(WIN_RULES.routineThreshold, WIN_RULES.taskThreshold)).toBe(true);
    expect(dayWon(WIN_RULES.routineThreshold - 1, WIN_RULES.taskThreshold)).toBe(false);
    expect(dayWon(WIN_RULES.routineThreshold, WIN_RULES.taskThreshold - 1)).toBe(false);
  });

  it('weekWon requires the week target of won days', () => {
    expect(weekWon(WIN_RULES.weekTarget)).toBe(true);
    expect(weekWon(WIN_RULES.weekTarget - 1)).toBe(false);
  });
});

describe('weekPenalty', () => {
  const wk = (won: boolean[]) =>
    ['2026-09-20','2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-26']
      .map((date, i) => ({ date, won: won[i] }));

  it('charges 100 per past lost day, nothing for today or the future', () => {
    const r = weekPenalty(wk([true, false, true, false, false, false, false]), '2026-09-23');
    expect(r).toEqual({ lostDays: 1, weekLost: false, owed: 100 });
  });

  it('locks the 300 the moment the week can no longer reach 4 wins', () => {
    // Sun–Wed lost, Thu today: max reachable = 3 < 4
    const r = weekPenalty(wk([false, false, false, false, false, false, false]), '2026-09-24');
    expect(r).toEqual({ lostDays: 4, weekLost: true, owed: 700 });
  });

  it('ignores days before the contract start and never loses a pre-contract week', () => {
    // week of 09-13 with contract starting 09-19: no past day counts, no week penalty
    const pre = ['2026-09-13','2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18','2026-09-19']
      .map((date) => ({ date, won: false }));
    expect(weekPenalty(pre, '2026-09-19')).toEqual({ lostDays: 0, weekLost: false, owed: 0 });
  });

  it('owes nothing on a clean week', () => {
    expect(weekPenalty(wk([true, true, true, true, true, true, true]), '2026-09-26').owed).toBe(0);
  });
});
