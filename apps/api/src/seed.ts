import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { getWeekStart, localDateStr } from '@xp/shared';

dotenv.config({ path: join(__dirname, '..', '.env') });
if (!process.env.MONGO_URI) {
  dotenv.config({ path: 'C:\\Projects\\XP\\xp-monorepo\\apps\\api\\.env' });
}

const NodeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    type: { type: String, required: true, enum: ['DOMAIN', 'SKILL', 'PROJECT', 'TASK', 'PERSON', 'TAG', 'ROUTINE'] },
    mainParent: { type: mongoose.Schema.Types.ObjectId, ref: 'Node' },
    parents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Node' }],
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Node' }],
    status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
    progress: { type: Number, default: 0 },
    description: String,
    metadata: { type: Object },
  },
  { timestamps: true },
);

const Node = mongoose.model('Node', NodeSchema);

type CheckIn = { date: string; hours: number };

/**
 * Generate realistic check-ins ending YESTERDAY (so the user can click "today" fresh).
 * Each entry records the date AND the hours spent that day (jittered around `baseHours`).
 * - `streak` consecutive days starting from yesterday (inclusive)
 * - Plus older random check-ins within the last 60 days at ~`olderHitRate`
 */
function generateCheckIns(
  streak: number,
  baseHours: number,
  olderHitRate = 0.6,
  lookbackDays = 60,
): CheckIn[] {
  const out: CheckIn[] = [];
  const today = new Date();
  const hoursFor = () => {
    if (baseHours <= 0) return 0;
    // ±30% jitter, rounded to 0.05h
    const jitter = baseHours * (0.7 + Math.random() * 0.6);
    return Math.round(jitter * 20) / 20;
  };
  // Recent consecutive streak — START AT YESTERDAY so today is empty
  for (let i = 1; i <= streak; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push({ date: localDateStr(d), hours: hoursFor() });
  }
  // Older days, with miss days
  for (let i = streak + 1; i <= lookbackDays; i++) {
    if (Math.random() < olderHitRate) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      out.push({ date: localDateStr(d), hours: hoursFor() });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function thisWeekFromCheckIns(checkIns: CheckIn[]): number {
  const weekStart = getWeekStart(localDateStr());
  return checkIns.filter(c => c.date >= weekStart).length;
}

/** Parse a routine target string like "30 min" / "2 hours" into hours. */
function parseTargetHours(target: string): number {
  const lower = target.toLowerCase().trim();
  const min = lower.match(/^(\d+)\s*(min|minutes?|m)$/);
  if (min) return parseFloat(min[1]) / 60;
  const hr = lower.match(/^([\d.]+)\s*(hours?|h|hr|hrs)$/);
  if (hr) return parseFloat(hr[1]);
  return 0;
}

async function seed() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/xp-database';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  await Node.deleteMany({});
  console.log('Cleared existing nodes');

  // ── DOMAINS (root) ──
  const life = await Node.create({ title: 'Life', type: 'DOMAIN', description: 'Root domain — everything starts here.' });
  const work = await Node.create({ title: 'Work', type: 'DOMAIN', mainParent: life._id, description: 'Career, professional growth, and employment.' });
  const personal = await Node.create({ title: 'Personal', type: 'DOMAIN', mainParent: life._id, description: 'Personal life, relationships, hobbies.' });
  const learning = await Node.create({ title: 'Learning', type: 'DOMAIN', mainParent: life._id, description: 'Continuous learning and skill development.' });
  const health = await Node.create({ title: 'Health & Fitness', type: 'DOMAIN', mainParent: life._id, description: 'Physical and mental well-being.' });
  const finance = await Node.create({ title: 'Finance', type: 'DOMAIN', mainParent: life._id, description: 'Financial literacy, trading, budgeting.' });
  const creative = await Node.create({ title: 'Creative', type: 'DOMAIN', mainParent: life._id, description: 'Design, art, and creative expression.' });

  // ── DOMAINS (sub) ──
  const dev = await Node.create({ title: 'Dev', type: 'DOMAIN', mainParent: work._id, description: 'Software development and engineering.' });
  const career = await Node.create({ title: 'Career', type: 'DOMAIN', mainParent: work._id, description: 'Job search, internships, professional network.' });
  const relationships = await Node.create({ title: 'Relationships', type: 'DOMAIN', mainParent: personal._id, description: 'Friends, family, and social connections.' });

  // Wire children arrays
  await Node.findByIdAndUpdate(life._id, { children: [work._id, personal._id, learning._id, health._id, finance._id, creative._id] });
  await Node.findByIdAndUpdate(work._id, { children: [dev._id, career._id] });
  await Node.findByIdAndUpdate(personal._id, { children: [relationships._id] });

  // ── TAGS ──
  const tagUrgent = await Node.create({ title: 'urgent', type: 'TAG', metadata: { color: '#f38ba8' } });
  const tagDeploy = await Node.create({ title: 'deploy', type: 'TAG', metadata: { color: '#a6e3a1' } });
  const tagUI = await Node.create({ title: 'ui', type: 'TAG', metadata: { color: '#89b4fa' } });
  const tagDocs = await Node.create({ title: 'docs', type: 'TAG', metadata: { color: '#f9e2af' } });
  const tagDevops = await Node.create({ title: 'devops', type: 'TAG', metadata: { color: '#fab387' } });
  const tagQuality = await Node.create({ title: 'quality', type: 'TAG', metadata: { color: '#cba6f7' } });
  const tagEmail = await Node.create({ title: 'email', type: 'TAG', metadata: { color: '#f5c2e7' } });

  // ── SKILLS (from Second Brain Skills Roadmap — hours-based mastery) ──
  const skillBackend = await Node.create({
    title: 'Backend Development', type: 'SKILL', mainParent: dev._id,
    metadata: { totalHours: 820, level: 'skilled', hoursToNext: 180, tags: ['nestjs', 'go'] },
  });
  const skillMongo = await Node.create({
    title: 'MongoDB & GraphQL', type: 'SKILL', mainParent: dev._id,
    metadata: { totalHours: 450, level: 'skilled', hoursToNext: 550 },
  });
  const skillGoWasm = await Node.create({
    title: 'Go WASM', type: 'SKILL', mainParent: dev._id,
    metadata: { totalHours: 35, level: 'familiar', hoursToNext: 265 },
  });
  const skillForex = await Node.create({
    title: 'Forex Trading (XAUUSD)', type: 'SKILL', mainParent: finance._id,
    metadata: { totalHours: 280, level: 'familiar', hoursToNext: 20 },
  });
  const skillEnglish = await Node.create({
    title: 'English', type: 'SKILL', mainParent: learning._id,
    metadata: { totalHours: 5200, level: 'master', hoursToNext: 4800 },
  });
  const skillPublicSpeech = await Node.create({
    title: 'Public Speaking', type: 'SKILL', mainParent: learning._id,
    metadata: { totalHours: 12, level: 'unfamiliar', hoursToNext: 8 },
  });
  const skillPhotoshop = await Node.create({
    title: 'Photoshop & Design', type: 'SKILL', mainParent: creative._id,
    metadata: { totalHours: 160, level: 'familiar', hoursToNext: 140 },
  });

  // Wire skill children to domains
  await Node.findByIdAndUpdate(dev._id, { $push: { children: { $each: [skillBackend._id, skillMongo._id, skillGoWasm._id] } } });
  await Node.findByIdAndUpdate(finance._id, { $push: { children: skillForex._id } });
  await Node.findByIdAndUpdate(learning._id, { $push: { children: { $each: [skillEnglish._id, skillPublicSpeech._id] } } });
  await Node.findByIdAndUpdate(creative._id, { $push: { children: skillPhotoshop._id } });

  // ── PROJECTS ──
  const projXP = await Node.create({
    title: 'Project XP', type: 'PROJECT', mainParent: dev._id, status: 'IN_PROGRESS', progress: 60,
    description: 'Personal life operating system — The Game + The Orchestra. Phase 6 active.',
    metadata: { startDate: '2025-01-15', dueDate: '2026-12-31' },
  });
  const projAura = await Node.create({
    title: 'Aura', type: 'PROJECT', mainParent: dev._id, status: 'IN_PROGRESS', progress: 25,
    description: 'Go WASM skill tracker — full logic replacement for solo_leveling.',
    metadata: { startDate: '2026-03-01' },
  });
  const projIntern = await Node.create({
    title: 'Accenture Internship', type: 'PROJECT', mainParent: career._id, status: 'IN_PROGRESS', progress: 10,
    description: 'Developer/AD track internship. 1 Jun – 31 Jul 2026.',
    metadata: { startDate: '2026-06-01', dueDate: '2026-07-31' },
  });
  const projNanoki = await Node.create({
    title: 'Nanoki Feasibility', type: 'PROJECT', mainParent: finance._id, status: 'TODO', progress: 0,
    description: 'Business feasibility study — NPV/IRR modelling.',
  });

  await Node.findByIdAndUpdate(dev._id, { $push: { children: { $each: [projXP._id, projAura._id] } } });
  await Node.findByIdAndUpdate(career._id, { $push: { children: projIntern._id } });
  await Node.findByIdAndUpdate(finance._id, { $push: { children: projNanoki._id } });

  // ── TASKS ──
  const tasks = [
    { title: 'Implement Graph view Phase 6', mainParent: projXP._id, status: 'DONE', progress: 100, metadata: { priority: 'high', estimatedHours: 12, creditedHours: 12, completedAt: '2026-05-18T18:00:00Z' } },
    { title: 'Build Routine node type', mainParent: projXP._id, status: 'IN_PROGRESS', progress: 40, metadata: { priority: 'high', estimatedHours: 6, due: '2026-05-20' }, parents: [tagUI._id] },
    { title: 'Seed database with Second Brain data', mainParent: projXP._id, status: 'IN_PROGRESS', progress: 60, metadata: { priority: 'medium', estimatedHours: 3, due: '2026-05-20' } },
    { title: 'Design Obsidian sync service', mainParent: projXP._id, status: 'TODO', progress: 0, metadata: { priority: 'medium', estimatedHours: 8, due: '2026-05-27' } },
    { title: 'Progress propagation engine', mainParent: projXP._id, status: 'TODO', progress: 0, metadata: { priority: 'high', estimatedHours: 10, due: '2026-06-15' } },
    { title: 'Set up Go WASM build pipeline', mainParent: projAura._id, status: 'TODO', progress: 0, metadata: { priority: 'medium', estimatedHours: 4 }, parents: [tagDevops._id] },
    { title: 'Write Aura core logic in Go', mainParent: projAura._id, status: 'TODO', progress: 0, metadata: { priority: 'high', estimatedHours: 40 } },
    { title: 'Prepare onboarding docs', mainParent: projIntern._id, status: 'TODO', progress: 0, metadata: { priority: 'low', estimatedHours: 2, due: '2026-05-30' }, parents: [tagDocs._id] },
    { title: 'Review company tech stack', mainParent: projIntern._id, status: 'TODO', progress: 0, metadata: { priority: 'medium', estimatedHours: 3, due: '2026-05-28' } },
    { title: 'Build NPV model spreadsheet', mainParent: projNanoki._id, status: 'TODO', progress: 0, metadata: { priority: 'medium', estimatedHours: 8 } },
    { title: 'Deploy API to GCP', mainParent: projXP._id, status: 'TODO', progress: 0, metadata: { priority: 'low', estimatedHours: 5, due: '2026-06-20' }, parents: [tagDeploy._id, tagDevops._id] },
    { title: 'Fix Kanban drag-drop edge case', mainParent: projXP._id, status: 'TODO', progress: 0, metadata: { priority: 'high', estimatedHours: 1.5, due: '2026-05-19' }, parents: [tagUrgent._id, tagUI._id] },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskDocs: any[] = [];
  for (const t of tasks) {
    const doc = await Node.create({ ...t, type: 'TASK' });
    taskDocs.push(doc);
  }

  // Wire tasks to project children
  const xpTaskIds = taskDocs.filter(t => [0, 1, 2, 3, 4, 10, 11].includes(taskDocs.indexOf(t))).map(t => t._id);
  const auraTaskIds = taskDocs.filter(t => [5, 6].includes(taskDocs.indexOf(t))).map(t => t._id);
  const internTaskIds = taskDocs.filter(t => [7, 8].includes(taskDocs.indexOf(t))).map(t => t._id);
  const nanokiTaskIds = taskDocs.filter(t => [9].includes(taskDocs.indexOf(t))).map(t => t._id);

  await Node.findByIdAndUpdate(projXP._id, { $push: { children: { $each: xpTaskIds } } });
  await Node.findByIdAndUpdate(projAura._id, { $push: { children: { $each: auraTaskIds } } });
  await Node.findByIdAndUpdate(projIntern._id, { $push: { children: { $each: internTaskIds } } });
  await Node.findByIdAndUpdate(projNanoki._id, { $push: { children: { $each: nanokiTaskIds } } });

  // Wire tags' children (reverse link)
  for (const t of taskDocs) {
    if (t.parents && t.parents.length > 0) {
      for (const pid of t.parents) {
        await Node.findByIdAndUpdate(pid, { $addToSet: { children: t._id } });
      }
    }
  }

  // ── ROUTINES (from Second Brain Routines.md) ──
  // Helper to build routine metadata with date-aligned check-ins
  const buildRoutineMeta = (opts: {
    cadence: string; streak: number; bestStreak: number; group: string;
    target: string; weekTarget: number; olderHitRate?: number;
  }) => {
    const baseHours = parseTargetHours(opts.target);
    const checkIns = generateCheckIns(opts.streak, baseHours, opts.olderHitRate);
    return {
      cadence: opts.cadence, streak: opts.streak, bestStreak: opts.bestStreak,
      group: opts.group, target: opts.target, weekTarget: opts.weekTarget,
      thisWeek: thisWeekFromCheckIns(checkIns),
      lastCheckInDate: checkIns.length ? checkIns[checkIns.length - 1].date : null,
      checkIns,
    };
  };

  const routines = [
    {
      title: 'Morning Read', mainParent: learning._id,
      metadata: buildRoutineMeta({ cadence: 'daily', streak: 14, bestStreak: 21, group: 'Morning', target: '30 min', weekTarget: 7, olderHitRate: 0.75 }),
    },
    {
      title: 'Meditate', mainParent: health._id,
      metadata: buildRoutineMeta({ cadence: 'daily', streak: 9, bestStreak: 30, group: 'Morning', target: '10 min', weekTarget: 7, olderHitRate: 0.65 }),
    },
    {
      title: 'Gym (PPL)', mainParent: health._id,
      description: 'Push/Pull/Legs split. Min 4 sessions/week. 172cm / 62kg.',
      metadata: buildRoutineMeta({ cadence: 'weekly', streak: 0, bestStreak: 12, group: 'Fitness', target: '4x/week', weekTarget: 4, olderHitRate: 0.55 }),
    },
    {
      title: 'Journal', mainParent: personal._id,
      metadata: buildRoutineMeta({ cadence: 'daily', streak: 3, bestStreak: 14, group: 'Evening', target: '15 min', weekTarget: 7, olderHitRate: 0.5 }),
    },
    {
      title: 'Deep Work Block', mainParent: dev._id,
      description: 'Focused coding session — no notifications, no context switching.',
      metadata: buildRoutineMeta({ cadence: 'daily', streak: 8, bestStreak: 18, group: 'Work', target: '2 hours', weekTarget: 6, olderHitRate: 0.7 }),
    },
    {
      title: 'Weekly Review', mainParent: personal._id,
      metadata: buildRoutineMeta({ cadence: 'weekly', streak: 0, bestStreak: 10, group: 'Planning', target: '1x/week', weekTarget: 1, olderHitRate: 0.15 }),
    },
    {
      title: 'Call Parents', mainParent: relationships._id,
      metadata: buildRoutineMeta({ cadence: 'weekly', streak: 0, bestStreak: 15, group: 'Family', target: '1x/week', weekTarget: 1, olderHitRate: 0.15 }),
    },
    {
      title: 'Budget Review', mainParent: finance._id,
      metadata: buildRoutineMeta({ cadence: 'monthly', streak: 0, bestStreak: 6, group: 'Finance', target: '1x/month', weekTarget: 0, olderHitRate: 0.05 }),
    },
    {
      title: 'Run', mainParent: health._id,
      description: '5K easy run or interval training.',
      metadata: buildRoutineMeta({ cadence: 'weekly', streak: 0, bestStreak: 8, group: 'Fitness', target: '3x/week', weekTarget: 3, olderHitRate: 0.4 }),
    },
  ];

  const routineDocs = [];
  for (const r of routines) {
    const doc = await Node.create({ ...r, type: 'ROUTINE' });
    routineDocs.push(doc);
  }

  // Wire routines to domain children
  const routinesByParent: Record<string, mongoose.Types.ObjectId[]> = {};
  for (const r of routineDocs) {
    const pid = r.mainParent?.toString();
    if (pid) {
      (routinesByParent[pid] ??= []).push(r._id as mongoose.Types.ObjectId);
    }
  }
  for (const [pid, rids] of Object.entries(routinesByParent)) {
    await Node.findByIdAndUpdate(pid, { $push: { children: { $each: rids } } });
  }

  // ── PEOPLE ──
  const people = [
    { title: 'Alice Chen', mainParent: relationships._id, metadata: { initials: 'AC', email: 'alice@example.com', circle: 'Close Friends', role: 'Designer', nextCatchup: '2026-05-22', relativeDate: 'in 3 days', catchupState: 'upcoming' } },
    { title: 'Hana Sato', mainParent: relationships._id, metadata: { initials: 'HS', email: 'hana@example.com', circle: 'Core Team', role: 'PM', nextCatchup: '2026-05-20', relativeDate: 'tomorrow', catchupState: 'upcoming' } },
    { title: 'Bob Rivera', mainParent: relationships._id, metadata: { initials: 'BR', email: 'bob@example.com', circle: 'Work', role: 'Backend Dev', nextCatchup: '2026-05-17', relativeDate: '2 days ago', catchupState: 'overdue' } },
    { title: 'Maya Johnson', mainParent: relationships._id, metadata: { initials: 'MJ', circle: 'Family', role: 'Sister', nextCatchup: '2026-05-25', relativeDate: 'in 6 days', catchupState: 'upcoming' } },
    { title: 'Liam Park', mainParent: relationships._id, metadata: { initials: 'LP', email: 'liam@example.com', circle: 'Close Friends', role: 'ML Engineer', nextCatchup: '2026-05-15', relativeDate: '4 days ago', catchupState: 'overdue' } },
    { title: 'Nook (Mom)', mainParent: relationships._id, metadata: { initials: 'NK', circle: 'Family', role: 'Parent', phone: '+66-xxx', nextCatchup: '2026-05-21', relativeDate: 'in 2 days', catchupState: 'upcoming' } },
  ];

  const personDocs = [];
  for (const p of people) {
    const doc = await Node.create({ ...p, type: 'PERSON' });
    personDocs.push(doc);
  }
  await Node.findByIdAndUpdate(relationships._id, { $push: { children: { $each: personDocs.map(p => p._id) } } });

  // ── Summary ──
  const counts = await Node.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]);
  console.log('\nSeed complete:');
  for (const c of counts) console.log(`  ${c._id}: ${c.count}`);
  const total = counts.reduce((s: number, c: { count: number }) => s + c.count, 0);
  console.log(`  Total: ${total} nodes`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
