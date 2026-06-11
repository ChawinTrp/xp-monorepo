import type { XPNode } from './types';

/** Default circles, in display order, with their accent colors. */
export const CIRCLE_DEFAULTS: { name: string; color: string }[] = [
  { name: 'Family', color: 'var(--c-person)' },
  { name: 'Close Friends', color: 'var(--accent)' },
  { name: 'Core Team', color: 'var(--orange)' },
  { name: 'Aura Team', color: 'var(--blue)' },
  { name: 'Mentors', color: 'var(--yellow)' },
  { name: 'Network', color: 'var(--c-routine)' },
];

/** A circle is a TAG node with metadata.kind === 'circle'. */
export function isCircleTag(node: XPNode): boolean {
  return node.type === 'TAG' && (node.metadata as any)?.kind === 'circle';
}

/**
 * All circle TAG nodes, ordered: CIRCLE_DEFAULTS order first (matched by title),
 * then any remaining circle tags alphabetically by title.
 */
export function circleTagsOf(nodes: XPNode[]): XPNode[] {
  const circles = nodes.filter(isCircleTag);
  const byTitle = new Map<string, XPNode>();
  for (const c of circles) byTitle.set(c.title, c);

  const ordered: XPNode[] = [];
  const used = new Set<string>();
  for (const def of CIRCLE_DEFAULTS) {
    const tag = byTitle.get(def.name);
    if (tag) {
      ordered.push(tag);
      used.add(tag.title);
    }
  }

  const rest = circles
    .filter((c) => !used.has(c.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  return [...ordered, ...rest];
}

/** The first circle tag whose _id is in person.parents, or null if none. */
export function circleOfPerson(person: XPNode, circleTags: XPNode[]): XPNode | null {
  const parents = person.parents ?? [];
  return circleTags.find((tag) => parents.includes(tag._id)) ?? null;
}

/**
 * The display color for a circle tag: explicit metadata.color, else the
 * CIRCLE_DEFAULTS color matched by title, else a generic fallback.
 */
export function circleColorOf(tag: XPNode): string {
  const explicit = (tag.metadata as any)?.color;
  if (typeof explicit === 'string' && explicit.trim()) return explicit;
  const def = CIRCLE_DEFAULTS.find((d) => d.name === tag.title);
  return def?.color ?? 'var(--c-routine)';
}
