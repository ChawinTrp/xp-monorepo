import { describe, it, expect, vi } from 'vitest';
import { toolDefinitions } from '../src/tools.js';
import type { XpClient } from '../src/xp-client.js';

const node = { _id: '1', title: 'Ship CI', type: 'TASK' };

function findTool(name: string) {
  const def = toolDefinitions.find((t) => t.name === name);
  if (!def) throw new Error(`tool ${name} not registered`);
  return def;
}

describe('toolDefinitions', () => {
  it('registers the expected hybrid tool set and no hard-delete tool', () => {
    const names = toolDefinitions.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'archive_node',
        'check_in_routine',
        'complete_task',
        'create_node',
        'get_node',
        'search_nodes',
        'start_task_timer',
        'stop_task_timer',
        'unarchive_node',
        'update_node',
      ].sort(),
    );
    expect(names).not.toContain('delete_node');
  });

  it('search_nodes calls the client and returns JSON text', async () => {
    const client = { searchNodes: vi.fn().mockResolvedValue([node]) } as unknown as XpClient;
    const out = await findTool('search_nodes').handler(client, {
      term: 'ci',
      types: ['TASK'],
      includeArchived: false,
    });
    expect(client.searchNodes).toHaveBeenCalledWith('ci', ['TASK'], false);
    expect(JSON.parse(out)).toEqual([node]);
  });

  it('create_node validates metadata then calls the client', async () => {
    const client = { createNode: vi.fn().mockResolvedValue(node) } as unknown as XpClient;
    await findTool('create_node').handler(client, {
      type: 'TASK',
      title: 'Ship CI',
      metadata: { estimatedHours: 2 },
    });
    expect(client.createNode).toHaveBeenCalledWith({
      type: 'TASK',
      title: 'Ship CI',
      metadata: { estimatedHours: 2 },
    });
  });

  it('create_node rejects malformed metadata before calling the client', async () => {
    const client = { createNode: vi.fn() } as unknown as XpClient;
    await expect(
      findTool('create_node').handler(client, {
        type: 'TASK',
        title: 'x',
        metadata: { estimatedHours: 'lots' },
      }),
    ).rejects.toThrow(/estimatedHours/);
    expect(client.createNode).not.toHaveBeenCalled();
  });

  it('update_node maps id to _id and forwards whitelisted fields', async () => {
    const client = { updateNode: vi.fn().mockResolvedValue(node) } as unknown as XpClient;
    await findTool('update_node').handler(client, { id: '1', status: 'DONE' });
    expect(client.updateNode).toHaveBeenCalledWith({ _id: '1', status: 'DONE' });
  });

  it('archive_node calls the client archive method', async () => {
    const client = { archiveNode: vi.fn().mockResolvedValue(node) } as unknown as XpClient;
    await findTool('archive_node').handler(client, { id: '1' });
    expect(client.archiveNode).toHaveBeenCalledWith('1');
  });

  it('complete_task forwards id and optional completedDate', async () => {
    const client = { completeTask: vi.fn().mockResolvedValue([node]) } as unknown as XpClient;
    await findTool('complete_task').handler(client, { id: '1' });
    expect(client.completeTask).toHaveBeenCalledWith('1', undefined);
  });
});
