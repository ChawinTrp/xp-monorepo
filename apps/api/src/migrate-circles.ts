import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '..', '.env') });
if (!process.env.MONGO_URI) {
  dotenv.config({ path: 'C:\\Projects\\XP\\xp-monorepo\\apps\\api\\.env' });
}

// NOTE: intentionally not importing @xp/shared — this is a one-off script and
// the 6 default circle names below duplicate apps/web/src/lib/circles.ts
// CIRCLE_DEFAULTS. Acceptable duplication for a migration that will be deleted
// after it's run.
const DEFAULT_CIRCLE_NAMES = [
  'Family',
  'Close Friends',
  'Core Team',
  'Aura Team',
  'Mentors',
  'Network',
];

// `strict: false` so dot-path updates like 'metadata.circle' / 'metadata.catchupState'
// ($set / $unset) on the Mixed `metadata` field are applied as written, without
// Mongoose stripping or rejecting the nested path.
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
  { timestamps: true, strict: false },
);

const Node = mongoose.model('Node', NodeSchema);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any;

async function migrate() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/xp-database';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // ── Step 1: load existing circle TAG nodes ──
  const existingCircleTags: AnyNode[] = await Node.find({ type: 'TAG', 'metadata.kind': 'circle' });
  const tagByTitle = new Map<string, AnyNode>();
  for (const tag of existingCircleTags) {
    tagByTitle.set(tag.title, tag);
  }

  // ── Step 2: compute needed circle names = defaults UNION distinct PERSON metadata.circle values ──
  const people: AnyNode[] = await Node.find({ type: 'PERSON' });
  const circleNamesFromPeople = new Set<string>();
  for (const p of people) {
    const circle = p.metadata?.circle;
    if (typeof circle === 'string' && circle.trim()) {
      circleNamesFromPeople.add(circle);
    }
  }

  const neededNames = new Set<string>(DEFAULT_CIRCLE_NAMES);
  for (const name of circleNamesFromPeople) neededNames.add(name);

  const createdCircleNames: string[] = [];
  for (const name of neededNames) {
    if (!tagByTitle.has(name)) {
      const tag = await Node.create({ title: name, type: 'TAG', metadata: { kind: 'circle' } });
      tagByTitle.set(name, tag);
      createdCircleNames.push(name);
    }
  }

  // ── Step 3: link people with metadata.circle to their circle tag (both sides), then unset metadata.circle ──
  let peopleLinked = 0;
  for (const p of people) {
    const circleName = p.metadata?.circle;
    if (typeof circleName !== 'string' || !circleName.trim()) continue;

    const tag = tagByTitle.get(circleName);
    if (!tag) {
      // Should not happen — every name in circleNamesFromPeople was added to neededNames above.
      console.warn(`  WARNING: no circle tag found for "${circleName}" (person ${p._id})`);
      continue;
    }

    await Node.updateOne(
      { _id: p._id },
      {
        $addToSet: { parents: tag._id },
        $unset: { 'metadata.circle': '' },
      },
    );
    await Node.updateOne(
      { _id: tag._id },
      { $addToSet: { children: p._id } },
    );
    peopleLinked++;
  }

  // ── Step 4: clean vestigial fields on ALL PERSON nodes ──
  const cleanupResult = await Node.updateMany(
    { type: 'PERSON' },
    { $unset: { 'metadata.catchupState': '', 'metadata.relativeDate': '' } },
  );

  // ── Summary ──
  console.log('\nMigration complete:');
  console.log(`  Circle tags created: ${createdCircleNames.length ? createdCircleNames.join(', ') : '(none)'}`);
  console.log(`  People linked to circle tags: ${peopleLinked}`);
  console.log(`  People with vestigial fields cleaned: ${cleanupResult.modifiedCount}`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
