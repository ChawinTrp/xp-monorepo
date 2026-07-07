import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Node, NodeDocument } from '../nodes/node.entity';

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'untitled'
  );
}

/** Folder segment from a DOMAIN title — keep human-readable, strip fs-illegal chars. */
function folderName(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'untitled';
}

@Injectable()
export class ObsidianSyncService implements OnModuleInit {
  private readonly logger = new Logger(ObsidianSyncService.name);
  readonly vaultPath: string;

  constructor(@InjectModel(Node.name) private nodeModel: Model<NodeDocument>) {
    this.vaultPath = process.env.OBSIDIAN_VAULT_PATH ?? '';
    if (!this.enabled) {
      this.logger.log('OBSIDIAN_VAULT_PATH not set — Obsidian sync disabled');
    }
  }

  get enabled(): boolean {
    return !!this.vaultPath;
  }

  onModuleInit(): void {
    if (!this.enabled) return;
    // Fire-and-forget: boot must not block on a full vault sync.
    void this.syncAll().catch((err: any) =>
      this.logger.error(`Startup vault sync failed: ${err.message}`),
    );
  }

  private fileName(node: Node): string {
    return `${slugify(node.title)}_${node._id}.md`;
  }

  /** Walks the mainParent chain upward from (but excluding) `start`. Stops at a
   *  missing parent, and warns + stops on a revisited id (cycle guard). */
  private async walkParents(start: Node): Promise<Node[]> {
    const chain: Node[] = [];
    let cur: Node = start;
    const seen = new Set<string>([String(start._id)]);
    while (cur.mainParent) {
      const parent: Node | null = await this.nodeModel
        .findById(cur.mainParent)
        .exec();
      if (!parent) break;
      if (seen.has(String(parent._id))) {
        this.logger.warn(
          `Cycle detected in mainParent chain at node ${String(parent._id)} (started from ${String(start._id)})`,
        );
        break;
      }
      seen.add(String(parent._id));
      chain.push(parent);
      cur = parent;
    }
    return chain;
  }

  /** Folder chain for a DOMAIN node, e.g. "Work/Dev". */
  private async domainFolder(domain: Node): Promise<string> {
    const chain = await this.walkParents(domain);
    const segments = [folderName(domain.title)];
    for (const parent of chain) {
      if (parent.type !== 'DOMAIN') break;
      segments.unshift(folderName(parent.title));
    }
    return segments.join('/');
  }

  /** Nearest DOMAIN ancestor via the mainParent chain, or null. */
  private async nearestDomain(node: Node): Promise<Node | null> {
    const chain = await this.walkParents(node);
    return chain.find((n) => n.type === 'DOMAIN') ?? null;
  }

  /** Vault-relative path ("/" separators) for a node's .md file. */
  async buildPath(node: Node): Promise<string> {
    if (node.type === 'TAG') return `_tags/${this.fileName(node)}`;
    if (node.type === 'DOMAIN') {
      // ponytail: DOMAINs are folders; flat files inside (no PROJECT subfolders,
      // unlike XP.md §12.3) — avoids rename cascades. Revisit if folders get huge.
      return `${await this.domainFolder(node)}/_index_xp_${node._id}.md`;
    }
    const domain = await this.nearestDomain(node);
    if (!domain) return this.fileName(node);
    return `${await this.domainFolder(domain)}/${this.fileName(node)}`;
  }

  /** Frontmatter (§12.6) + body (§12.8). Only non-empty fields are written. */
  async buildContent(node: Node): Promise<string> {
    const parentIds = [
      ...new Set(
        [node.mainParent, ...(node.parents ?? [])].filter(Boolean).map(String),
      ),
    ];
    const parentNodes: Node[] = parentIds.length
      ? await this.nodeModel.find({ _id: { $in: parentIds } }).exec()
      : [];
    const tagNames = parentNodes
      .filter((p) => p.type === 'TAG')
      .map((p) => slugify(p.title));

    const meta = (node.metadata ?? {}) as Record<string, unknown>;
    const dueDate = (meta.due ?? meta.dueDate) as string | undefined;
    const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    const fm: string[] = ['---'];
    fm.push(`xp_id: ${node._id}`);
    fm.push(`type: ${node.type}`);
    fm.push(`title: ${q(node.title)}`);
    fm.push(`aliases: [${q(node.title)}]`);
    if (tagNames.length) fm.push(`tags: [${tagNames.join(', ')}]`);
    if (node.status) fm.push(`status: ${node.status}`);
    if (node.progress != null && node.progress !== 0) fm.push(`progress: ${node.progress}`);
    if (node.mainParent) fm.push(`mainParent: ${node.mainParent}`);
    if (node.parents?.length) {
      fm.push('parents:');
      node.parents.forEach((p) => fm.push(`  - ${p}`));
    }
    if (node.children?.length) {
      fm.push('children:');
      node.children.forEach((c) => fm.push(`  - ${c}`));
    }
    if (dueDate) fm.push(`dueDate: ${dueDate}`);
    if (node.updatedAt) fm.push(`updatedAt: ${new Date(node.updatedAt).toISOString()}`);
    fm.push('---');

    const links = await Promise.all(
      parentNodes.map(async (p) => {
        const target = (await this.buildPath(p)).split('/').pop()!.replace(/\.md$/, '');
        return `[[${target}|${p.title}]]`;
      }),
    );

    const body: string[] = ['', `# ${node.title}`];
    if (links.length) body.push('', links.join('  '));
    if (node.description) body.push('', node.description);
    body.push('');

    return fm.join('\n') + body.join('\n');
  }

  private abs(rel: string): string {
    return path.join(this.vaultPath, rel);
  }

  async upsertNode(node: Node): Promise<void> {
    if (!this.enabled) return;
    try {
      if (node.archived) return await this.deleteNode(node);

      const newPath = await this.buildPath(node);
      const oldPath = node.obsidianPath;
      if (oldPath && oldPath !== newPath) {
        await fs.rm(this.abs(oldPath), { force: true });
        await this.regenerateIndex(path.posix.dirname(oldPath));
      }

      await fs.mkdir(path.dirname(this.abs(newPath)), { recursive: true });
      await fs.writeFile(this.abs(newPath), await this.buildContent(node), 'utf8');

      if (oldPath !== newPath) {
        await this.nodeModel
          .updateOne({ _id: node._id }, { obsidianPath: newPath }, { timestamps: false })
          .exec();
      }
      await this.regenerateIndex(path.posix.dirname(newPath));
    } catch (err: any) {
      this.logger.error(`Obsidian upsert failed for "${node.title}": ${err.message}`);
    }
  }

  async upsertMany(nodes: Node[]): Promise<void> {
    for (const n of nodes) await this.upsertNode(n);
  }

  async deleteNode(node: Node): Promise<void> {
    if (!this.enabled) return;
    try {
      const rel = node.obsidianPath ?? (await this.buildPath(node));
      await fs.rm(this.abs(rel), { force: true });
      await this.regenerateIndex(path.posix.dirname(rel));
    } catch (err: any) {
      this.logger.error(`Obsidian delete failed for "${node.title}": ${err.message}`);
    }
  }

  /** Rebuild _xp_index.md from the xp files actually present in the folder. */
  async regenerateIndex(domainFolder: string): Promise<void> {
    if (!this.enabled) return;
    const folder = domainFolder === '.' ? '' : domainFolder;
    if (folder === '_tags') return; // tag pages don't get an index
    let files: string[];
    try {
      files = await fs.readdir(this.abs(folder));
    } catch {
      return;
    }
    const idRe = /_([0-9a-f]{24})\.md$/;
    const ids = files
      .map((f) => idRe.exec(f)?.[1])
      .filter((x): x is string => !!x);
    if (ids.length === 0) {
      await fs.rm(this.abs(path.posix.join(folder, '_xp_index.md')), { force: true });
      return;
    }
    const nodes = await this.nodeModel
      .find({ _id: { $in: ids }, archived: { $ne: true } })
      .exec();

    const groups = new Map<string, Node[]>();
    for (const n of nodes) {
      const list = groups.get(n.type) ?? [];
      list.push(n);
      groups.set(n.type, list);
    }
    const heading: Record<string, string> = {
      DOMAIN: 'Domains', SKILL: 'Skills', PROJECT: 'Projects', TASK: 'Tasks',
      PERSON: 'People', TAG: 'Tags', ROUTINE: 'Routines',
    };
    const lines = [
      '---',
      'auto_generated: true',
      `domain: ${folder.split('/').pop() || 'Vault Root'}`,
      `updated: ${new Date().toISOString()}`,
      '---',
      '',
      `# XP Index — ${folder.split('/').pop() || 'Vault Root'}`,
    ];
    for (const type of Object.keys(heading)) {
      const list = groups.get(type);
      if (!list?.length) continue;
      lines.push('', `## ${heading[type]}`);
      for (const n of list.sort((a, b) => a.title.localeCompare(b.title))) {
        const file = (await this.buildPath(n)).split('/').pop()!.replace(/\.md$/, '');
        const extras = [
          n.status,
          (n.metadata as any)?.due ?? (n.metadata as any)?.dueDate
            ? `due ${(n.metadata as any).due ?? (n.metadata as any).dueDate}`
            : undefined,
        ].filter(Boolean);
        lines.push(`- [[${file}|${n.title}]]${extras.length ? ' · ' + extras.join(' · ') : ''}`);
      }
    }
    lines.push('');
    await fs.writeFile(this.abs(path.posix.join(folder, '_xp_index.md')), lines.join('\n'), 'utf8');
  }

  /** Full vault rebuild — bootstrap + recovery. Safe for hand-written notes. */
  async syncAll(): Promise<void> {
    if (!this.enabled) return;
    const nodes = await this.nodeModel.find({ archived: { $ne: true } }).exec();
    const liveIds = new Set(nodes.map((n) => String(n._id)));
    const folders = new Set<string>();

    for (const node of nodes) {
      try {
        const rel = await this.buildPath(node);
        await fs.mkdir(path.dirname(this.abs(rel)), { recursive: true });
        await fs.writeFile(this.abs(rel), await this.buildContent(node), 'utf8');
        if (node.obsidianPath !== rel) {
          await this.nodeModel
            .updateOne({ _id: node._id }, { obsidianPath: rel }, { timestamps: false })
            .exec();
        }
        folders.add(path.posix.dirname(rel));
      } catch (err: any) {
        this.logger.error(`syncAll failed for "${node.title}": ${err.message}`);
      }
    }

    // Remove stale xp files ({anything}_{24hex}.md with a dead id). Hand-written
    // notes never match the pattern, so they are never touched.
    await this.removeStale('', liveIds, folders);
    for (const f of folders) await this.regenerateIndex(f);
    this.logger.log(`Obsidian vault synced: ${nodes.length} nodes`);
  }

  private async removeStale(
    relFolder: string,
    liveIds: Set<string>,
    touchedFolders: Set<string>,
  ): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(this.abs(relFolder), { withFileTypes: true });
    } catch {
      return;
    }
    const idRe = /_([0-9a-f]{24})\.md$/;
    for (const e of entries) {
      const rel = relFolder ? path.posix.join(relFolder, e.name) : e.name;
      if (e.isDirectory()) {
        if (e.name.startsWith('.')) continue;
        await this.removeStale(rel, liveIds, touchedFolders);
      } else {
        const m = idRe.exec(e.name);
        if (m && !liveIds.has(m[1])) {
          await fs.rm(this.abs(rel), { force: true });
          touchedFolders.add(relFolder === '' ? '.' : relFolder);
        }
      }
    }
  }
}
