import { ObsidianSyncService, slugify } from './obsidian-sync.service';

// Minimal in-memory stand-in for the Mongoose Node model.
export function fakeModel(nodes: any[]) {
  const byId = new Map(nodes.map((n) => [String(n._id), n]));
  return {
    findById: (id: string) => ({
      exec: async () => byId.get(String(id)) ?? null,
    }),
    find: (query: any = {}) => ({
      exec: async () => {
        let out = nodes.filter((n) => n.archived !== true);
        if (query._id?.$in) {
          const ids = query._id.$in.map(String);
          out = out.filter((n) => ids.includes(String(n._id)));
        }
        return out;
      },
    }),
    updateOne: () => ({ exec: async () => ({}) }),
  } as any;
}

const id = (hex: string) => hex.padStart(24, '0');

export const work = { _id: id('1'), title: 'Work', type: 'DOMAIN' };
export const dev = { _id: id('2'), title: 'Dev', type: 'DOMAIN', mainParent: id('1') };
export const urgent = { _id: id('3'), title: 'Urgent!', type: 'TAG' };
export const proj = {
  _id: id('4'),
  title: 'Project XP',
  type: 'PROJECT',
  mainParent: id('2'),
  parents: [id('2'), id('3')],
  status: 'IN_PROGRESS',
  progress: 40,
  description: 'The life OS.',
  metadata: { dueDate: '2026-08-01' },
};

export const allNodes = [work, dev, urgent, proj];

function makeService(vault: string, nodes: any[] = allNodes) {
  process.env.OBSIDIAN_VAULT_PATH = vault;
  const svc = new ObsidianSyncService(fakeModel(nodes));
  delete process.env.OBSIDIAN_VAULT_PATH;
  return svc;
}

describe('slugify', () => {
  it('lowercases and collapses special chars to underscores', () => {
    expect(slugify('Project XP')).toBe('project_xp');
    expect(slugify('  Fix bug #42 (API)!  ')).toBe('fix_bug_42_api');
    expect(slugify('!!!')).toBe('untitled');
  });
});

describe('ObsidianSyncService builders', () => {
  it('is disabled when OBSIDIAN_VAULT_PATH is unset', () => {
    delete process.env.OBSIDIAN_VAULT_PATH;
    const svc = new ObsidianSyncService(fakeModel([]));
    expect(svc.enabled).toBe(false);
  });

  it('builds TAG paths under _tags/', async () => {
    const svc = makeService('/vault');
    expect(await svc.buildPath(urgent as any)).toBe(`_tags/urgent_${id('3')}.md`);
  });

  it('builds DOMAIN paths as folder + _index_xp file', async () => {
    const svc = makeService('/vault');
    expect(await svc.buildPath(dev as any)).toBe(`Work/Dev/_index_xp_${id('2')}.md`);
  });

  it('places other nodes flat in the nearest DOMAIN ancestor folder', async () => {
    const svc = makeService('/vault');
    expect(await svc.buildPath(proj as any)).toBe(`Work/Dev/project_xp_${id('4')}.md`);
  });

  it('places nodes with no DOMAIN ancestor at the vault root', async () => {
    const orphan = { _id: id('9'), title: 'Loose Task', type: 'TASK' };
    const svc = makeService('/vault', [...allNodes, orphan]);
    expect(await svc.buildPath(orphan as any)).toBe(`loose_task_${id('9')}.md`);
  });

  it('warns and still produces a path when the mainParent chain cycles', async () => {
    const a = { _id: id('10'), title: 'A', type: 'DOMAIN', mainParent: id('11') };
    const b = { _id: id('11'), title: 'B', type: 'DOMAIN', mainParent: id('10') };
    const svc = makeService('/vault', [a, b]);
    const warnSpy = jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => {});

    expect(await svc.buildPath(a as any)).toBe(`B/A/_index_xp_${id('10')}.md`);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Cycle detected'));
  });

  it('builds frontmatter + wikilinks + description', async () => {
    const svc = makeService('/vault');
    const content = await svc.buildContent(proj as any);
    expect(content).toContain('---\n');
    expect(content).toContain(`xp_id: ${id('4')}`);
    expect(content).toContain('type: PROJECT');
    expect(content).toContain('title: "Project XP"');
    expect(content).toContain('aliases: ["Project XP"]');
    expect(content).toContain('tags: [urgent]');
    expect(content).toContain('status: IN_PROGRESS');
    expect(content).toContain('dueDate: 2026-08-01');
    expect(content).toContain('# Project XP');
    expect(content).toContain(`[[_index_xp_${id('2')}|Dev]]`);
    expect(content).toContain(`[[urgent_${id('3')}|Urgent!]]`);
    expect(content).toContain('The life OS.');
    expect(content).not.toContain('undefined');
  });
});
