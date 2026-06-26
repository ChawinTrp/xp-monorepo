import { z } from 'zod';
import type { ZodRawShape } from 'zod';
import type { XpClient, UpdateNodeInput } from './xp-client.js';
import { validateMetadata } from './validation.js';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: (client: XpClient, args: Record<string, any>) => Promise<string>;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

export const toolDefinitions: ToolDef[] = [
  {
    name: 'search_nodes',
    description:
      'Search XP nodes by title (regex, case-insensitive). Optionally filter by type ' +
      '(DOMAIN/SKILL/PROJECT/TASK/PERSON/TAG/ROUTINE). Archived nodes are hidden unless includeArchived is true.',
    inputSchema: {
      term: z.string().optional(),
      types: z.array(z.string()).optional(),
      includeArchived: z.boolean().optional(),
    },
    handler: async (client, args) =>
      json(await client.searchNodes(args.term ?? '', args.types, args.includeArchived ?? false)),
  },
  {
    name: 'get_node',
    description:
      'Fetch a single XP node by id, including its connections (mainParent, parents, children).',
    inputSchema: { id: z.string() },
    handler: async (client, args) => json(await client.getNode(args.id)),
  },
  {
    name: 'create_node',
    description:
      'Create an XP node. type must be one of DOMAIN/SKILL/PROJECT/TASK/PERSON/TAG/ROUTINE. ' +
      'Type-specific fields go in metadata (e.g. TASK: dueDate, priority, estimatedHours).',
    inputSchema: {
      type: z.enum(['DOMAIN', 'SKILL', 'PROJECT', 'TASK', 'PERSON', 'TAG', 'ROUTINE']),
      title: z.string(),
      description: z.string().optional(),
      mainParent: z.string().optional(),
      parents: z.array(z.string()).optional(),
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
      metadata: z.record(z.any()).optional(),
    },
    handler: async (client, args) => {
      const metadata = validateMetadata(args.type, args.metadata);
      return json(
        await client.createNode({
          type: args.type,
          title: args.title,
          description: args.description,
          mainParent: args.mainParent,
          parents: args.parents,
          status: args.status,
          metadata,
        }),
      );
    },
  },
  {
    name: 'update_node',
    description:
      'Update editable fields of a node by id. Whitelisted fields only: title, description, status, ' +
      'mainParent, parents, metadata. Cannot delete — use archive_node for removal.',
    inputSchema: {
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
      mainParent: z.string().optional(),
      parents: z.array(z.string()).optional(),
      metadata: z.record(z.any()).optional(),
    },
    handler: async (client, args) => {
      const patch: UpdateNodeInput = { _id: args.id };
      if (args.title !== undefined) patch.title = args.title;
      if (args.description !== undefined) patch.description = args.description;
      if (args.status !== undefined) patch.status = args.status;
      if (args.mainParent !== undefined) patch.mainParent = args.mainParent;
      if (args.parents !== undefined) patch.parents = args.parents;
      if (args.metadata !== undefined) {
        const node = await client.getNode(args.id);
        patch.metadata = validateMetadata(node.type, args.metadata);
      }
      return json(await client.updateNode(patch));
    },
  },
  {
    name: 'archive_node',
    description:
      'Soft-delete (archive) a node. Reversible via unarchive_node. This is the ONLY removal tool — hard delete is human-only.',
    inputSchema: { id: z.string() },
    handler: async (client, args) => json(await client.archiveNode(args.id)),
  },
  {
    name: 'unarchive_node',
    description: 'Restore a previously archived node.',
    inputSchema: { id: z.string() },
    handler: async (client, args) => json(await client.unarchiveNode(args.id)),
  },
  {
    name: 'complete_task',
    description:
      'Mark a TASK done and trigger XP propagation (PROJECT/SKILL/DOMAIN progress). Optional completedDate (YYYY-MM-DD).',
    inputSchema: { id: z.string(), completedDate: z.string().optional() },
    handler: async (client, args) => json(await client.completeTask(args.id, args.completedDate)),
  },
  {
    name: 'check_in_routine',
    description: 'Check in a ROUTINE for today (updates streak and credits skill hours).',
    inputSchema: { id: z.string() },
    handler: async (client, args) => json(await client.checkInRoutine(args.id)),
  },
  {
    name: 'start_task_timer',
    description: 'Start the work timer on a TASK.',
    inputSchema: { id: z.string() },
    handler: async (client, args) => json(await client.startTaskTimer(args.id)),
  },
  {
    name: 'stop_task_timer',
    description: 'Stop the work timer on a TASK and roll up actual hours.',
    inputSchema: { id: z.string() },
    handler: async (client, args) => json(await client.stopTaskTimer(args.id)),
  },
];
