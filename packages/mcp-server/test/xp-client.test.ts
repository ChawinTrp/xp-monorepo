import { describe, it, expect, vi } from 'vitest';
import { XpClient } from '../src/xp-client.js';

const fakeNode = { _id: '1', title: 'XP', type: 'PROJECT' };

function makeClient(responseKey: string, payload: unknown) {
  const request = vi.fn().mockResolvedValue({ [responseKey]: payload });
  return { client: new XpClient({ request }), request };
}

describe('XpClient', () => {
  it('searchNodes passes variables and unwraps the result', async () => {
    const { client, request } = makeClient('searchNodes', [fakeNode]);
    const result = await client.searchNodes('xp', ['PROJECT'], false);
    expect(result).toEqual([fakeNode]);
    const [doc, vars] = request.mock.calls[0];
    expect(doc).toContain('searchNodes');
    expect(vars).toEqual({ term: 'xp', allowedTypes: ['PROJECT'], includeArchived: false });
  });

  it('getNode passes the id and unwraps node', async () => {
    const { client, request } = makeClient('node', fakeNode);
    const result = await client.getNode('1');
    expect(result).toEqual(fakeNode);
    expect(request.mock.calls[0][1]).toEqual({ id: '1' });
  });

  it('createNode wraps input under createNodeInput', async () => {
    const { client, request } = makeClient('createNode', fakeNode);
    const input = { type: 'TASK', title: 'Ship CI' };
    await client.createNode(input);
    expect(request.mock.calls[0][0]).toContain('createNode');
    expect(request.mock.calls[0][1]).toEqual({ input });
  });

  it('archiveNode passes the id', async () => {
    const { client, request } = makeClient('archiveNode', fakeNode);
    await client.archiveNode('1');
    expect(request.mock.calls[0][0]).toContain('archiveNode');
    expect(request.mock.calls[0][1]).toEqual({ id: '1' });
  });

  it('completeTask passes id + completedDate and unwraps the node array', async () => {
    const { client, request } = makeClient('completeTask', [fakeNode]);
    const result = await client.completeTask('1', '2026-06-25');
    expect(result).toEqual([fakeNode]);
    expect(request.mock.calls[0][1]).toEqual({ input: { id: '1', completedDate: '2026-06-25' } });
  });
});
