import mongoose from 'mongoose';

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

async function seedProd() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set. Pass it via .env or environment variable.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB:', uri.replace(/:([^@]+)@/, ':***@'));

  const existing = await Node.findOne({ title: 'Life', type: 'DOMAIN' });
  if (existing) {
    console.log('Life node already exists — skipping seed.');
    await mongoose.disconnect();
    process.exit(0);
  }

  await Node.create({
    title: 'Life',
    type: 'DOMAIN',
    description: 'Root domain — everything starts here.',
    progress: 0,
  });

  console.log('Prod seed complete: Life root node created.');
  await mongoose.disconnect();
  process.exit(0);
}

seedProd().catch((err) => {
  console.error(err);
  process.exit(1);
});
