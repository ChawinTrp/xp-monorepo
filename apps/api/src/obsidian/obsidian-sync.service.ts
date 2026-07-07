import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
export class ObsidianSyncService {
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
}
