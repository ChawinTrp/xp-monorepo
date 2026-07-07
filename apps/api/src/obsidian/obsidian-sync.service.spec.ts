import { ObsidianSyncService, slugify } from './obsidian-sync.service';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

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

export const id = (hex: string) => hex.padStart(24, '0');

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

describe('folderName traversal guard', () => {
  it('DOMAIN titled ".." does not escape the vault', async () => {
    const dotDomain = { _id: id('20'), title: '..', type: 'DOMAIN' };
    const svc = makeService('/vault', [dotDomain]);
    const p = await svc.buildPath(dotDomain as any);
    expect(p.split('/')).not.toContain('..');
    expect(p).toBe(`untitled/_index_xp_${id('20')}.md`);
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

  it('escapes newlines in the title so frontmatter is not corrupted', async () => {
    const svc = makeService('/vault');
    const node = { ...proj, title: 'line1\nline2' };
    const content = await svc.buildContent(node as any);
    const titleLine = content.split('\n').find((l) => l.startsWith('title: '))!;
    expect(titleLine).toBe('title: "line1\\nline2"');
  });
});

describe('ObsidianSyncService file lifecycle', () => {
  let vault: string;

  beforeEach(async () => {
    vault = await fs.mkdtemp(path.join(os.tmpdir(), 'xp-vault-'));
  });

  afterEach(async () => {
    await fs.rm(vault, { recursive: true, force: true });
  });

  const svcWith = (nodes: any[]) => {
    process.env.OBSIDIAN_VAULT_PATH = vault;
    const svc = new ObsidianSyncService(fakeModel(nodes));
    delete process.env.OBSIDIAN_VAULT_PATH;
    return svc;
  };

  const exists = (rel: string) =>
    fs.access(path.join(vault, rel)).then(() => true, () => false);

  it('upsertNode writes the file and regenerates the index', async () => {
    const svc = svcWith(allNodes);
    await svc.upsertNode(proj as any);
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(true);
    const index = await fs.readFile(path.join(vault, 'Work/Dev/_xp_index.md'), 'utf8');
    expect(index).toContain('auto_generated: true');
    expect(index).toContain(`[[project_xp_${id('4')}|Project XP]]`);
  });

  it('upsertNode moves the file when the path changed', async () => {
    const moved = { ...proj, obsidianPath: 'Old/project_xp_' + id('4') + '.md' };
    await fs.mkdir(path.join(vault, 'Old'), { recursive: true });
    await fs.writeFile(path.join(vault, moved.obsidianPath), 'stale');
    const svc = svcWith([...allNodes.filter((n) => n !== proj), moved]);
    await svc.upsertNode(moved as any);
    expect(await exists(moved.obsidianPath)).toBe(false);
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(true);
  });

  it('upsertNode of an archived node deletes its file', async () => {
    const svc = svcWith(allNodes);
    await svc.upsertNode(proj as any);
    await svc.upsertNode({ ...proj, archived: true } as any);
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(false);
  });

  it('deleteNode removes the file', async () => {
    const svc = svcWith(allNodes);
    await svc.upsertNode(proj as any);
    await svc.deleteNode(proj as any);
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(false);
  });

  it('never touches the manual _index.md', async () => {
    await fs.mkdir(path.join(vault, 'Work/Dev'), { recursive: true });
    await fs.writeFile(path.join(vault, 'Work/Dev/_index.md'), 'my MOC');
    const svc = svcWith(allNodes);
    await svc.upsertNode(proj as any);
    expect(await fs.readFile(path.join(vault, 'Work/Dev/_index.md'), 'utf8')).toBe('my MOC');
  });

  it('syncAll writes every live node and removes stale xp files', async () => {
    await fs.writeFile(
      path.join(vault, `ghost_${'f'.repeat(24)}.md`),
      'stale xp file',
    );
    await fs.writeFile(path.join(vault, 'My handwritten note.md'), 'keep me');
    const svc = svcWith(allNodes);
    await svc.syncAll();
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(true);
    expect(await exists(`_tags/urgent_${id('3')}.md`)).toBe(true);
    expect(await exists(`Work/Dev/_index_xp_${id('2')}.md`)).toBe(true);
    expect(await exists(`ghost_${'f'.repeat(24)}.md`)).toBe(false);
    expect(await exists('My handwritten note.md')).toBe(true);
  });

  it('syncAll removes the old file when a node\'s path changed (e.g. DOMAIN rename)', async () => {
    const moved = { ...proj, obsidianPath: 'Old/project_xp_' + id('4') + '.md' };
    await fs.mkdir(path.join(vault, 'Old'), { recursive: true });
    await fs.writeFile(path.join(vault, moved.obsidianPath), 'stale');
    const svc = svcWith([...allNodes.filter((n) => n !== proj), moved]);
    await svc.syncAll();
    expect(await exists(moved.obsidianPath)).toBe(false);
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(true);
  });

  it('all operations are no-ops when disabled', async () => {
    delete process.env.OBSIDIAN_VAULT_PATH;
    const svc = new ObsidianSyncService(fakeModel(allNodes));
    await svc.upsertNode(proj as any);
    await svc.syncAll();
    expect(await exists(`Work/Dev/project_xp_${id('4')}.md`)).toBe(false);
  });
});

describe('ObsidianSyncService lifecycle', () => {
  let vault: string;

  beforeEach(async () => {
    vault = await fs.mkdtemp(path.join(os.tmpdir(), 'xp-vault-'));
  });

  afterEach(async () => {
    await fs.rm(vault, { recursive: true, force: true });
  });

  const svcWith = (nodes: any[]) => {
    process.env.OBSIDIAN_VAULT_PATH = vault;
    const svc = new ObsidianSyncService(fakeModel(nodes));
    delete process.env.OBSIDIAN_VAULT_PATH;
    return svc;
  };

  it('onModuleInit triggers syncAll when enabled', async () => {
    const svc = svcWith(allNodes);
    jest.spyOn(svc, 'syncAll').mockResolvedValue(undefined);
    svc.onModuleInit();
    // Allow the promise to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(svc.syncAll).toHaveBeenCalledTimes(1);
  });

  it('onModuleInit does nothing when disabled', async () => {
    delete process.env.OBSIDIAN_VAULT_PATH;
    const svc = new ObsidianSyncService(fakeModel(allNodes));
    jest.spyOn(svc, 'syncAll').mockResolvedValue(undefined);
    svc.onModuleInit();
    expect(svc.syncAll).not.toHaveBeenCalled();
  });
});
