import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { join } from 'path';

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

function history30(pattern: boolean[]): boolean[] {
  const out: boolean[] = [];
  for (let i = 0; i < 30; i++) out.push(pattern[i % pattern.length]);
  return out;
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

  // ── SKILLS (from Second Brain Skills Roadmap) ──
  const skillBackend = await Node.create({
    title: 'Backend Development', type: 'SKILL', mainParent: dev._id,
    metadata: { level: 7, xp: 3400, xpToNext: 5000, sparkline: [40, 55, 60, 45, 70, 80, 75, 90, 85, 95], weekGain: 120, tags: ['nestjs', 'go'] },
  });
  const skillMongo = await Node.create({
    title: 'MongoDB & GraphQL', type: 'SKILL', mainParent: dev._id,
    metadata: { level: 6, xp: 2800, xpToNext: 4000, sparkline: [30, 35, 50, 45, 55, 60, 70, 65, 75, 80], weekGain: 85 },
  });
  const skillGoWasm = await Node.create({
    title: 'Go WASM', type: 'SKILL', mainParent: dev._id,
    metadata: { level: 3, xp: 800, xpToNext: 2000, sparkline: [10, 15, 20, 25, 15, 30, 20, 35, 25, 40], weekGain: 40 },
  });
  const skillForex = await Node.create({
    title: 'Forex Trading (XAUUSD)', type: 'SKILL', mainParent: finance._id,
    metadata: { level: 5, xp: 2100, xpToNext: 3500, sparkline: [20, 30, 25, 40, 35, 50, 45, 55, 60, 50], weekGain: 65 },
  });
  const skillEnglish = await Node.create({
    title: 'English', type: 'SKILL', mainParent: learning._id,
    metadata: { level: 8, xp: 4200, xpToNext: 5500, sparkline: [50, 55, 60, 58, 65, 70, 68, 72, 75, 78], weekGain: 30 },
  });
  const skillPublicSpeech = await Node.create({
    title: 'Public Speaking', type: 'SKILL', mainParent: learning._id,
    metadata: { level: 2, xp: 450, xpToNext: 1500, sparkline: [5, 8, 10, 12, 15, 10, 18, 14, 20, 16], weekGain: 15 },
  });
  const skillPhotoshop = await Node.create({
    title: 'Photoshop & Design', type: 'SKILL', mainParent: creative._id,
    metadata: { level: 4, xp: 1600, xpToNext: 3000, sparkline: [15, 20, 25, 30, 22, 35, 28, 40, 32, 38], weekGain: 25 },
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
    { title: 'Implement Graph view Phase 6', mainParent: projXP._id, status: 'DONE', progress: 100, metadata: { priority: 'high', xpAwarded: 120, completedAt: '2 days ago', overdue: false } },
    { title: 'Build Routine node type', mainParent: projXP._id, status: 'IN_PROGRESS', progress: 40, metadata: { priority: 'high', due: 'Today', overdue: false }, parents: [tagUI._id] },
    { title: 'Seed database with Second Brain data', mainParent: projXP._id, status: 'IN_PROGRESS', progress: 60, metadata: { priority: 'medium', due: 'Today', overdue: false } },
    { title: 'Design Obsidian sync service', mainParent: projXP._id, status: 'TODO', progress: 0, metadata: { priority: 'medium', due: 'Next week', overdue: false } },
    { title: 'Progress propagation engine', mainParent: projXP._id, status: 'TODO', progress: 0, metadata: { priority: 'high', due: '2026-06-15', overdue: false } },
    { title: 'Set up Go WASM build pipeline', mainParent: projAura._id, status: 'TODO', progress: 0, metadata: { priority: 'medium', overdue: false }, parents: [tagDevops._id] },
    { title: 'Write Aura core logic in Go', mainParent: projAura._id, status: 'TODO', progress: 0, metadata: { priority: 'high', overdue: false } },
    { title: 'Prepare onboarding docs', mainParent: projIntern._id, status: 'TODO', progress: 0, metadata: { priority: 'low', due: '2026-05-30', overdue: false }, parents: [tagDocs._id] },
    { title: 'Review company tech stack', mainParent: projIntern._id, status: 'TODO', progress: 0, metadata: { priority: 'medium', due: '2026-05-28', overdue: false } },
    { title: 'Build NPV model spreadsheet', mainParent: projNanoki._id, status: 'TODO', progress: 0, metadata: { priority: 'medium', overdue: false } },
    { title: 'Deploy API to GCP', mainParent: projXP._id, status: 'TODO', progress: 0, metadata: { priority: 'low', due: '2026-06-20', overdue: false }, parents: [tagDeploy._id, tagDevops._id] },
    { title: 'Fix Kanban drag-drop edge case', mainParent: projXP._id, status: 'TODO', progress: 0, metadata: { priority: 'high', due: 'Yesterday', overdue: true }, parents: [tagUrgent._id, tagUI._id] },
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
  const routines = [
    {
      title: 'Morning Read', mainParent: learning._id,
      metadata: { cadence: 'daily', streak: 14, bestStreak: 21, group: 'Morning', target: '30 min', thisWeek: 5, weekTarget: 7, history: history30([true, true, true, true, true, false, true]) },
    },
    {
      title: 'Meditate', mainParent: health._id,
      metadata: { cadence: 'daily', streak: 9, bestStreak: 30, group: 'Morning', target: '10 min', thisWeek: 4, weekTarget: 7, history: history30([true, true, false, true, true, true, false]) },
    },
    {
      title: 'Gym (PPL)', mainParent: health._id,
      description: 'Push/Pull/Legs split. Min 4 sessions/week. 172cm / 62kg.',
      metadata: { cadence: 'weekly', streak: 6, bestStreak: 12, group: 'Fitness', target: '4x/week', thisWeek: 3, weekTarget: 4, history: history30([true, false, true, false, true, false, true]) },
    },
    {
      title: 'Journal', mainParent: personal._id,
      metadata: { cadence: 'daily', streak: 3, bestStreak: 14, group: 'Evening', target: '15 min', thisWeek: 3, weekTarget: 7, history: history30([false, true, false, true, false, true, true]) },
    },
    {
      title: 'Deep Work Block', mainParent: dev._id,
      description: 'Focused coding session — no notifications, no context switching.',
      metadata: { cadence: 'daily', streak: 8, bestStreak: 18, group: 'Work', target: '2 hours', thisWeek: 5, weekTarget: 6, history: history30([true, true, true, false, true, true, true]) },
    },
    {
      title: 'Weekly Review', mainParent: personal._id,
      metadata: { cadence: 'weekly', streak: 4, bestStreak: 10, group: 'Planning', target: '1x/week', thisWeek: 1, weekTarget: 1, history: history30([false, false, false, false, false, false, true]) },
    },
    {
      title: 'Call Parents', mainParent: relationships._id,
      metadata: { cadence: 'weekly', streak: 7, bestStreak: 15, group: 'Family', target: '1x/week', thisWeek: 1, weekTarget: 1, history: history30([false, false, false, true, false, false, false]) },
    },
    {
      title: 'Budget Review', mainParent: finance._id,
      metadata: { cadence: 'monthly', streak: 3, bestStreak: 6, group: 'Finance', target: '1x/month', thisWeek: 0, weekTarget: 0, history: history30([false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true]) },
    },
    {
      title: 'Run', mainParent: health._id,
      description: '5K easy run or interval training.',
      metadata: { cadence: 'weekly', streak: 2, bestStreak: 8, group: 'Fitness', target: '3x/week', thisWeek: 2, weekTarget: 3, history: history30([true, false, false, true, false, false, true]) },
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
