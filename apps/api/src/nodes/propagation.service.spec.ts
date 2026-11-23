import { PropagationService } from './propagation.service';
import { logicalDateStr, addDays } from '@xp/shared';

const today = logicalDateStr();

function setup(metadata: Record<string, unknown>) {
  const mk = (n: any) => ({ ...n, markModified: () => {}, save: async () => {} });
  const nodes: Record<string, any> = {
    r: mk({ _id: 'r', type: 'ROUTINE', parents: ['s'], metadata }),
    s: mk({ _id: 's', type: 'SKILL', parents: [], metadata: { totalHours: 10 } }),
  };
  const model = { findById: (id: string) => ({ exec: async () => nodes[id] ?? null }) };
  return {
    svc: new PropagationService(model as any),
    meta: () => nodes.r.metadata,
    skill: () => nodes.s.metadata.totalHours,
    checked: () => (nodes.r.metadata.checkIns ?? []).some((c: any) => c.date === today),
  };
}

const steps = { scoring: 'steps', steps: ['rites', 'sun', 'shower', 'read'], stepGoal: 3, target: '30 min' };
const hours = { scoring: 'hours', target: '3 hours' };

describe('setRoutineProgress', () => {
  it('scores 2 of 3 steps without checking in, then checks in at the goal', async () => {
    const t = setup(steps);
    await t.svc.setRoutineProgress('r', { steps: ['sun', 'rites', 'sun', 'bogus'] });
    expect(t.meta().progressLog[0]).toMatchObject({ date: today, steps: ['rites', 'sun'] });
    expect(t.meta().progressLog[0].score).toBeCloseTo(2 / 3);
    expect(t.checked()).toBe(false);
    expect(t.meta().streak).toBe(0);
    await t.svc.setRoutineProgress('r', { steps: ['rites', 'sun', 'read'] });
    expect(t.checked()).toBe(true);
    expect(t.meta().streak).toBe(1);
    expect(t.skill()).toBeCloseTo(10.5);
  });

  it('credits partial hours once, and takes them back when lowered', async () => {
    const t = setup(hours);
    await t.svc.setRoutineProgress('r', { hours: 2 });
    expect(t.checked()).toBe(false);
    expect(t.skill()).toBe(12);
    await t.svc.setRoutineProgress('r', { hours: 4 });
    expect(t.checked()).toBe(true);
    expect(t.skill()).toBe(14);
    await t.svc.setRoutineProgress('r', { hours: 0 });
    expect(t.checked()).toBe(false);
    expect(t.meta().progressLog).toEqual([]);
    expect(t.skill()).toBe(10);
  });

  it('Done on partial work tops up, and undo returns to the partial', async () => {
    const t = setup(steps);
    await t.svc.setRoutineProgress('r', { steps: ['rites'] });
    const partial = t.skill();
    await t.svc.checkInRoutine('r');
    expect(t.skill()).toBeCloseTo(10.5);
    await t.svc.undoCheckInRoutine('r');
    expect(t.checked()).toBe(false);
    expect(t.skill()).toBeCloseTo(partial);
    expect(t.meta().progressLog).toHaveLength(1);
  });

  it('stopping the timer banks hours, and does not complete a steps routine', async () => {
    const start = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const h = setup({ ...hours, progressLog: [{ date: today, hours: 0.5, score: 1 / 6, credited: 0.5 }], timeEntries: [{ start }] });
    await h.svc.stopTimer('r');
    expect(h.meta().progressLog[0].hours).toBeCloseTo(2.5);
    expect(h.checked()).toBe(false);
    expect(h.meta().timeEntries).toEqual([]);
    const st = setup({ ...steps, timeEntries: [{ start }] });
    await st.svc.stopTimer('r');
    expect(st.checked()).toBe(false);
  });

  it('rejects unscored routines and bad hours', async () => {
    await expect(setup({ target: '3 hours' }).svc.setRoutineProgress('r', { hours: 1 })).rejects.toThrow('no steps');
    await expect(setup(hours).svc.setRoutineProgress('r', { hours: 25 })).rejects.toThrow('between');
    await expect(setup(hours).svc.setRoutineProgress('r', { hours: NaN })).rejects.toThrow('between');
  });

  it('plain routines behave as before, and older tap times survive', async () => {
    const t = setup({ target: '15 min', checkIns: [{ date: addDays(today, -1), hours: 0.25, at: 'X' }] });
    await t.svc.checkInRoutine('r');
    expect(t.meta().checkIns[0].at).toBe('X');
    expect(t.meta().streak).toBe(2);
    expect(t.skill()).toBe(10.25);
    await t.svc.undoCheckInRoutine('r');
    expect(t.meta().streak).toBe(1);
    expect(t.skill()).toBe(10);
  });
});
