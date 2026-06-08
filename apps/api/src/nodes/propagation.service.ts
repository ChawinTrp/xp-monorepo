import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Node, NodeDocument } from './node.entity';
import { getMasteryTier, getNextTierThreshold, WIN_RULES, dayWon, weekWon, getWeekDates, getWeekStart, localDateStr, parseLocalDate } from '@xp/shared';
import { CompleteTaskInput } from './dto/complete-task.input';

@Injectable()
export class PropagationService {
  constructor(@InjectModel(Node.name) private nodeModel: Model<NodeDocument>) {}

  async onTaskCompleted(input: CompleteTaskInput): Promise<Node[]> {
    const taskId = input.id;
    const task = await this.nodeModel.findById(taskId).exec();
    if (!task) throw new NotFoundException(`Node ${taskId} not found`);
    if (task.type !== 'TASK') throw new Error('onTaskCompleted called on non-TASK node');
    if (task.status === 'DONE') return [task];

    const meta = { ...(task.metadata ?? {}) } as Record<string, unknown>;
    const creditedHours =
      (meta.actualHours as number) ?? (meta.estimatedHours as number) ?? 0;

    meta.completedAt = new Date().toISOString();
    meta.completedDate = input.completedDate ?? localDateStr();
    meta.creditedHours = creditedHours;

    task.status = 'DONE';
    task.progress = 100;
    task.metadata = meta;
    await task.save();

    const affected: Node[] = [task];
    const visited = new Set<string>([taskId]);

    let currentId = task.mainParent?.toString();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const parent = await this.nodeModel.findById(currentId).exec();
      if (!parent) break;

      switch (parent.type) {
        case 'TASK':
          await this.recalcTaskProgress(parent);
          break;
        case 'PROJECT':
          await this.recalcProjectProgress(parent);
          break;
        case 'SKILL':
          await this.addHoursToSkill(parent, creditedHours);
          break;
        case 'DOMAIN':
          await this.recalcDomainProgress(parent);
          break;
        default:
          // PERSON, TAG, ROUTINE — stop walking
          affected.push(parent);
          return affected;
      }

      affected.push(parent);
      currentId = parent.mainParent?.toString();
    }

    // Phase 2: Credit hours to SKILLs linked via parents[]
    if (creditedHours > 0) {
      const parentIds = (task.parents ?? [])
        .map(p => p.toString())
        .filter(pid => !visited.has(pid));

      for (const pid of parentIds) {
        const parentNode = await this.nodeModel.findById(pid).exec();
        if (!parentNode || parentNode.type !== 'SKILL') continue;
        visited.add(pid);
        await this.addHoursToSkill(parentNode, creditedHours);
        affected.push(parentNode);

        // Walk skill's ancestors to update domain progress
        let ancestorId = parentNode.mainParent?.toString();
        while (ancestorId && !visited.has(ancestorId)) {
          visited.add(ancestorId);
          const ancestor = await this.nodeModel.findById(ancestorId).exec();
          if (!ancestor) break;
          if (ancestor.type === 'DOMAIN') {
            await this.recalcDomainProgress(ancestor);
            affected.push(ancestor);
          }
          ancestorId = ancestor.mainParent?.toString();
        }
      }
    }

    return affected;
  }

  async reopenTask(taskId: string): Promise<Node[]> {
    const task = await this.nodeModel.findById(taskId).exec();
    if (!task) throw new NotFoundException(`Node ${taskId} not found`);
    if (task.type !== 'TASK')
      throw new Error('reopenTask called on non-TASK node');
    if (task.status !== 'DONE') return [task]; // nothing to reopen

    const meta = { ...(task.metadata ?? {}) } as Record<string, unknown>;
    // The exact hours credited at completion time (stored by onTaskCompleted).
    const creditedHours = (meta.creditedHours as number) ?? 0;

    // Reset the task itself.
    delete meta.completedAt;
    delete meta.completedDate;
    delete meta.creditedHours;
    task.status = 'TODO';
    task.metadata = meta;
    task.markModified('metadata');
    // Leaf tasks go back to 0%; parent tasks recompute from children below.
    task.progress = 0;
    await task.save();

    const affected: Node[] = [task];
    const visited = new Set<string>([taskId]);

    // Phase 1: walk mainParent chain, reversing each effect onTaskCompleted applied.
    let currentId = task.mainParent?.toString();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const parent = await this.nodeModel.findById(currentId).exec();
      if (!parent) break;

      switch (parent.type) {
        case 'TASK':
          await this.recalcTaskProgress(parent);
          break;
        case 'PROJECT':
          await this.recalcProjectProgress(parent);
          break;
        case 'SKILL':
          await this.subtractHoursFromSkill(parent, creditedHours);
          break;
        case 'DOMAIN':
          await this.recalcDomainProgress(parent);
          break;
        default:
          // PERSON, TAG, ROUTINE — stop walking
          affected.push(parent);
          return affected;
      }

      affected.push(parent);
      currentId = parent.mainParent?.toString();
    }

    // Phase 2: reverse hours credited to SKILLs linked via parents[].
    if (creditedHours > 0) {
      const parentIds = (task.parents ?? [])
        .map(p => p.toString())
        .filter(pid => !visited.has(pid));

      for (const pid of parentIds) {
        const parentNode = await this.nodeModel.findById(pid).exec();
        if (!parentNode || parentNode.type !== 'SKILL') continue;
        visited.add(pid);
        await this.subtractHoursFromSkill(parentNode, creditedHours);
        affected.push(parentNode);

        let ancestorId = parentNode.mainParent?.toString();
        while (ancestorId && !visited.has(ancestorId)) {
          visited.add(ancestorId);
          const ancestor = await this.nodeModel.findById(ancestorId).exec();
          if (!ancestor) break;
          if (ancestor.type === 'DOMAIN') {
            await this.recalcDomainProgress(ancestor);
            affected.push(ancestor);
          }
          ancestorId = ancestor.mainParent?.toString();
        }
      }
    }

    return affected;
  }

  async startTimer(taskId: string): Promise<Node> {
    const task = await this.nodeModel.findById(taskId).exec();
    if (!task) throw new NotFoundException(`Node ${taskId} not found`);
    if (!['TASK', 'ROUTINE'].includes(task.type))
      throw new Error('Timer only works on TASK and ROUTINE nodes');

    const meta = { ...(task.metadata ?? {}) } as Record<string, unknown>;
    const entries = (meta.timeEntries as { start: string; end?: string }[]) ?? [];

    const openEntry = entries.find(e => !e.end);
    if (openEntry) throw new Error('Timer already running');

    entries.push({ start: new Date().toISOString() });
    meta.timeEntries = entries;
    task.metadata = meta;
    task.markModified('metadata');
    await task.save();
    return task;
  }

  async stopTimer(taskId: string): Promise<Node> {
    const task = await this.nodeModel.findById(taskId).exec();
    if (!task) throw new NotFoundException(`Node ${taskId} not found`);
    if (!['TASK', 'ROUTINE'].includes(task.type))
      throw new Error('Timer only works on TASK and ROUTINE nodes');

    const meta = { ...(task.metadata ?? {}) } as Record<string, unknown>;
    const entries = (meta.timeEntries as { start: string; end?: string }[]) ?? [];

    const openEntry = entries.find(e => !e.end);
    if (!openEntry) throw new Error('No running timer to stop');

    openEntry.end = new Date().toISOString();

    let totalMs = 0;
    for (const e of entries) {
      if (e.end) {
        totalMs += new Date(e.end).getTime() - new Date(e.start).getTime();
      }
    }
    meta.timeEntries = entries;
    meta.actualHours = Math.round((totalMs / 3_600_000) * 100) / 100;
    task.metadata = meta;
    task.markModified('metadata');
    await task.save();

    // For ROUTINEs, stopping the timer also checks in for today,
    // crediting the actual tracked hours (checkInRoutine reads actualHours).
    // If already checked in today, checkInRoutine is a no-op for the date
    // but the session still counts toward the day's record.
    if (task.type === 'ROUTINE') {
      await this.checkInRoutine(taskId);
      const refreshed = await this.nodeModel.findById(taskId).exec();
      if (refreshed) return refreshed;
    }

    return task;
  }

  async checkInRoutine(routineId: string): Promise<Node[]> {
    const routine = await this.nodeModel.findById(routineId).exec();
    if (!routine) throw new NotFoundException(`Node ${routineId} not found`);
    if (routine.type !== 'ROUTINE')
      throw new Error('checkInRoutine called on non-ROUTINE node');

    const meta = { ...(routine.metadata ?? {}) } as Record<string, unknown>;
    const today = localDateStr();

    // Canonical log: one entry per completed day, with the hours spent that day.
    const checkIns = this.readCheckIns(meta);

    // Idempotent: already checked in today
    if (checkIns.some(c => c.date === today)) return [routine];

    // Hours for today: actualHours (timer) ?? parseTarget(target) ?? 0
    const creditedHours =
      (meta.actualHours as number) ?? this.parseTarget(meta.target as string) ?? 0;

    checkIns.push({ date: today, hours: creditedHours });
    checkIns.sort((a, b) => a.date.localeCompare(b.date));
    meta.checkIns = checkIns;
    meta.lastCheckInDate = today;

    // Current streak: count consecutive days ending today
    const dateSet = new Set(checkIns.map(c => c.date));
    let streak = 0;
    const cursor = new Date(today + 'T00:00:00');
    while (dateSet.has(localDateStr(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    meta.streak = streak;
    meta.bestStreak = Math.max(streak, (meta.bestStreak as number) ?? 0);

    // This week (Sun-start): count check-ins since the week's Sunday
    const weekStart = getWeekStart(today);
    meta.thisWeek = checkIns.filter(c => c.date >= weekStart).length;

    // Clear timer data for next session
    meta.timeEntries = [];
    delete (meta as Record<string, unknown>).actualHours;

    routine.metadata = meta;
    routine.markModified('metadata');
    await routine.save();

    const affected: Node[] = [routine];

    // Credit hours to linked SKILLs
    if (creditedHours > 0) {
      const visited = new Set<string>([routineId]);
      const parentIds = (routine.parents ?? [])
        .map(p => p.toString())
        .filter(pid => !visited.has(pid));

      for (const pid of parentIds) {
        const parentNode = await this.nodeModel.findById(pid).exec();
        if (!parentNode || parentNode.type !== 'SKILL') continue;
        visited.add(pid);
        await this.addHoursToSkill(parentNode, creditedHours);
        affected.push(parentNode);

        // Walk skill's ancestors to update domain progress
        let ancestorId = parentNode.mainParent?.toString();
        while (ancestorId && !visited.has(ancestorId)) {
          visited.add(ancestorId);
          const ancestor = await this.nodeModel.findById(ancestorId).exec();
          if (!ancestor) break;
          if (ancestor.type === 'DOMAIN') {
            await this.recalcDomainProgress(ancestor);
            affected.push(ancestor);
          }
          ancestorId = ancestor.mainParent?.toString();
        }
      }
    }

    return affected;
  }

  /**
   * Read the canonical check-in log [{date, hours}], migrating any legacy
   * `checkInDates: string[]` data on the fly (hours unknown → 0).
   */
  private readCheckIns(
    meta: Record<string, unknown>,
  ): { date: string; hours: number }[] {
    const raw = meta.checkIns as { date: string; hours: number }[] | undefined;
    if (Array.isArray(raw)) return raw.map(c => ({ date: c.date, hours: c.hours ?? 0 }));
    const legacy = meta.checkInDates as string[] | undefined;
    if (Array.isArray(legacy)) return legacy.map(d => ({ date: d, hours: 0 }));
    return [];
  }

  async undoCheckInRoutine(routineId: string): Promise<Node[]> {
    const routine = await this.nodeModel.findById(routineId).exec();
    if (!routine) throw new NotFoundException(`Node ${routineId} not found`);
    if (routine.type !== 'ROUTINE')
      throw new Error('undoCheckInRoutine called on non-ROUTINE node');

    const meta = { ...(routine.metadata ?? {}) } as Record<string, unknown>;
    const today = localDateStr();
    const checkIns = this.readCheckIns(meta);

    const todayEntry = checkIns.find(c => c.date === today);
    if (!todayEntry) {
      // Nothing to undo
      return [routine];
    }

    // Reverse exactly the hours logged for today (not a stale scalar)
    const toReverse = todayEntry.hours ?? 0;

    // Remove today's check-in
    const newCheckIns = checkIns.filter(c => c.date !== today);
    meta.checkIns = newCheckIns;

    // Recompute current streak relative to today: today was just removed,
    // so count consecutive days ending YESTERDAY (0 if yesterday wasn't done).
    const dateSet = new Set(newCheckIns.map(c => c.date));
    let streak = 0;
    const cursor = new Date(today + 'T00:00:00');
    cursor.setDate(cursor.getDate() - 1); // start at yesterday
    while (dateSet.has(localDateStr(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    meta.streak = streak;
    meta.lastCheckInDate = newCheckIns.length
      ? newCheckIns[newCheckIns.length - 1].date
      : null;

    // Recompute thisWeek (Sun-start)
    const weekStart = getWeekStart(today);
    meta.thisWeek = newCheckIns.filter(c => c.date >= weekStart).length;

    routine.metadata = meta;
    routine.markModified('metadata');
    await routine.save();

    const affected: Node[] = [routine];

    if (toReverse > 0) {
      const visited = new Set<string>([routineId]);
      const parentIds = (routine.parents ?? []).map(p => p.toString());
      for (const pid of parentIds) {
        if (visited.has(pid)) continue;
        const parentNode = await this.nodeModel.findById(pid).exec();
        if (!parentNode || parentNode.type !== 'SKILL') continue;
        visited.add(pid);
        await this.subtractHoursFromSkill(parentNode, toReverse);
        affected.push(parentNode);

        // Walk skill's ancestors to update domain progress
        let ancestorId = parentNode.mainParent?.toString();
        while (ancestorId && !visited.has(ancestorId)) {
          visited.add(ancestorId);
          const ancestor = await this.nodeModel.findById(ancestorId).exec();
          if (!ancestor) break;
          if (ancestor.type === 'DOMAIN') {
            await this.recalcDomainProgress(ancestor);
            affected.push(ancestor);
          }
          ancestorId = ancestor.mainParent?.toString();
        }
      }
    }

    return affected;
  }

  private async subtractHoursFromSkill(
    skill: NodeDocument,
    hours: number,
  ): Promise<void> {
    const meta = { ...(skill.metadata ?? {}) } as Record<string, unknown>;
    const prevHours = (meta.totalHours as number) ?? 0;
    const newHours = Math.max(0, prevHours - hours);

    meta.totalHours = Math.round(newHours * 100) / 100;
    meta.level = getMasteryTier(newHours);
    const nextThreshold = getNextTierThreshold(newHours);
    meta.hoursToNext = nextThreshold !== null ? nextThreshold - newHours : null;

    skill.metadata = meta;
    skill.markModified('metadata');
    await skill.save();
  }

  private parseTarget(target?: string): number {
    if (!target) return 0;
    const lower = target.toLowerCase().trim();

    // "30 min" | "30 minutes" | "30m"
    const minMatch = lower.match(/^(\d+)\s*(min|minutes?|m)$/);
    if (minMatch) return parseFloat(minMatch[1]) / 60;

    // "2 hours" | "2h" | "1.5 hours"
    const hourMatch = lower.match(/^([\d.]+)\s*(hours?|h|hr|hrs)$/);
    if (hourMatch) return parseFloat(hourMatch[1]);

    // "1x/week", "daily", etc. — no fixed hours
    return 0;
  }

  private async recalcTaskProgress(parent: NodeDocument): Promise<void> {
    if (!parent.children?.length) return;
    const children = await this.nodeModel
      .find({ _id: { $in: parent.children } })
      .exec();
    const done = children.filter(c => c.status === 'DONE').length;
    parent.progress = Math.round((done / children.length) * 100);
    await parent.save();
  }

  private async recalcProjectProgress(project: NodeDocument): Promise<void> {
    if (!project.children?.length) {
      project.progress = 0;
      await project.save();
      return;
    }
    const children = await this.nodeModel
      .find({ _id: { $in: project.children } })
      .exec();
    const done = children.filter(c => c.status === 'DONE').length;
    project.progress = Math.round((done / children.length) * 100);
    await project.save();
  }

  private async addHoursToSkill(
    skill: NodeDocument,
    hours: number,
  ): Promise<void> {
    const meta = { ...(skill.metadata ?? {}) } as Record<string, unknown>;
    const prevHours = (meta.totalHours as number) ?? 0;
    const newHours = prevHours + hours;

    meta.totalHours = Math.round(newHours * 100) / 100;
    meta.level = getMasteryTier(newHours);
    const nextThreshold = getNextTierThreshold(newHours);
    meta.hoursToNext = nextThreshold !== null ? nextThreshold - newHours : null;

    skill.metadata = meta;
    skill.markModified('metadata');
    await skill.save();
  }

  private async recalcDomainProgress(domain: NodeDocument): Promise<void> {
    if (!domain.children?.length) return;
    const children = await this.nodeModel
      .find({ _id: { $in: domain.children } })
      .exec();
    const withProgress = children.filter(c => (c.progress ?? 0) > 0);
    if (withProgress.length === 0) {
      domain.progress = 0;
    } else {
      const sum = withProgress.reduce((acc, c) => acc + (c.progress ?? 0), 0);
      domain.progress = Math.round(sum / withProgress.length);
    }
    await domain.save();
  }

  async getWeekProgress(weekStart?: string): Promise<any> {
    const today = localDateStr();
    const start = weekStart ?? getWeekStart(today);

    const allNodes = await this.nodeModel.find({}).lean();
    const routines = allNodes.filter((n: any) => n.type === 'ROUTINE');
    const tasks = allNodes.filter((n: any) => n.type === 'TASK');

    const week = this.computeWeek(start, routines, tasks);

    // weekWinStreak: consecutive won weeks ending at the current week. The
    // in-progress current week counts only once it is already won, so a week
    // still underway shows the streak of prior weeks rather than zeroing it.
    const currentStart = getWeekStart(today);
    let streak = 0;
    if (this.computeWeek(currentStart, routines, tasks).weekWon) streak++;
    let cursor = this.prevWeekStart(currentStart);
    for (let i = 0; i < 104; i++) {
      if (!this.computeWeek(cursor, routines, tasks).weekWon) break;
      streak++;
      cursor = this.prevWeekStart(cursor);
    }

    return { ...week, weekWinStreak: streak };
  }

  /** Derive a week's day-wins + verdict from already-loaded nodes (pure). */
  private computeWeek(start: string, routines: any[], tasks: any[]) {
    const days = getWeekDates(start).map((date) => {
      const routinesCheckedIn = routines.filter((r: any) => {
        const checkIns: Array<{ date: string }> = (r.metadata as any)?.checkIns ?? [];
        return (r.metadata as any)?.cadence === 'daily' && checkIns.some((c) => c.date === date);
      }).length;

      const tasksCompleted = tasks.filter(
        (t: any) => (t.metadata as any)?.completedDate === date,
      ).length;

      return {
        date,
        won: dayWon(routinesCheckedIn, tasksCompleted),
        routinesCheckedIn,
        routineTarget: WIN_RULES.routineThreshold,
        tasksCompleted,
        taskTarget: WIN_RULES.taskThreshold,
      };
    });

    const wonDays = days.filter((d) => d.won).length;

    return {
      weekStart: start,
      days,
      wonDays,
      weekTarget: WIN_RULES.weekTarget,
      weekWon: weekWon(wonDays),
    };
  }

  private prevWeekStart(weekStart: string): string {
    const d = parseLocalDate(weekStart);
    d.setDate(d.getDate() - 7);
    return localDateStr(d);
  }
}
