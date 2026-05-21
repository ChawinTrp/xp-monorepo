import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Node, NodeDocument } from './node.entity';
import { getMasteryTier, getNextTierThreshold } from '@xp/shared';

@Injectable()
export class PropagationService {
  constructor(@InjectModel(Node.name) private nodeModel: Model<NodeDocument>) {}

  async onTaskCompleted(taskId: string): Promise<Node[]> {
    const task = await this.nodeModel.findById(taskId).exec();
    if (!task) throw new NotFoundException(`Node ${taskId} not found`);
    if (task.type !== 'TASK') throw new Error('onTaskCompleted called on non-TASK node');
    if (task.status === 'DONE') return [task];

    const meta = { ...(task.metadata ?? {}) } as Record<string, unknown>;
    const creditedHours =
      (meta.actualHours as number) ?? (meta.estimatedHours as number) ?? 0;

    meta.completedAt = new Date().toISOString();
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
    return task;
  }

  async checkInRoutine(routineId: string): Promise<Node[]> {
    const routine = await this.nodeModel.findById(routineId).exec();
    if (!routine) throw new NotFoundException(`Node ${routineId} not found`);
    if (routine.type !== 'ROUTINE')
      throw new Error('checkInRoutine called on non-ROUTINE node');

    const meta = { ...(routine.metadata ?? {}) } as Record<string, unknown>;

    // Idempotent: check if already checked in today
    const history = (meta.history as boolean[]) ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const lastCheckIn = meta.lastCheckInDate as string | undefined;
    if (lastCheckIn === today) {
      // Already checked in today — return as-is
      return [routine];
    }

    // Update history + streak
    history.push(true);
    meta.history = history;
    meta.lastCheckInDate = today;

    const streak = ((meta.streak as number) ?? 0) + 1;
    meta.streak = streak;
    meta.bestStreak = Math.max(streak, (meta.bestStreak as number) ?? 0);
    meta.thisWeek = ((meta.thisWeek as number) ?? 0) + 1;

    // Compute hours: actualHours (timer) ?? parseTarget(target) ?? 0
    const creditedHours =
      (meta.actualHours as number) ?? this.parseTarget(meta.target as string) ?? 0;

    meta.creditedHours = creditedHours;

    // Clear timer data for next session
    meta.timeEntries = [];
    meta.actualHours = undefined;

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
}
