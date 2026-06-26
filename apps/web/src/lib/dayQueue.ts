import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { useNodes } from './hooks';
import { DAY_PLAN, UPSERT_DAY_PLAN } from './graphql';
import type { XPNode } from './types';
import {
  buildQueue, itemStatus, summarizeDay, logicalDateStr,
  type ItemStatus, type DaySummary,
} from './queue';

// ── The solid daily queue.
//    The frozen DayPlan (orderedIds) is the source of membership/order; each item's
//    status is DERIVED from canonical node state so progress persists across
//    refreshes. On the first open of an unplanned day this hook snapshots the
//    auto-queue and freezes it (later-created items are not added). Single hook so
//    the mobile deck and the desktop list share one definition of "today".

export interface DayQueueItem {
  node: XPNode;
  status: ItemStatus;
}

export interface DayQueue {
  items: DayQueueItem[];      // every planned item, in plan order, with derived status
  pending: XPNode[];          // items still to do (drives the mobile swipe rotation)
  summary: DaySummary;        // total / done / skipped / pending / resolved
  today: string;              // logical date (5am boundary) this queue is for
  ready: boolean;             // false while the plan is loading / snapshotting
}

export function useDayQueue(): DayQueue {
  const { nodes, loading: nodesLoading } = useNodes();
  const today = logicalDateStr();

  const { data, error } = useQuery<{ dayPlan: { orderedIds: string[] } | null }>(
    DAY_PLAN,
    { variables: { date: today } },
  );
  const [upsertDayPlan] = useMutation(UPSERT_DAY_PLAN);

  // `data` is undefined until the first response; treat an error as resolved too.
  const planReady = data !== undefined || error != null;
  const dayPlan = data?.dayPlan ?? null;

  // Set once when there is genuinely nothing eligible to plan, so `ready` can flip
  // true with an empty queue instead of hanging on the loading state.
  const [emptyDay, setEmptyDay] = useState(false);
  const snapshotting = useRef(false);

  // Auto-snapshot: freeze today's auto-queue the first time an unplanned day opens.
  useEffect(() => {
    if (!planReady || error != null) return; // wait for the query; never write on error
    if (dayPlan) return;                      // a plan already exists — never overwrite
    if (nodesLoading) return;                 // nodes not ready
    if (snapshotting.current) return;         // fire once
    const ids = buildQueue(nodes, { today }).map((e) => e.node._id);
    if (ids.length === 0) {
      setEmptyDay(true); // nothing to plan today — show empty, retry next open
      return;
    }
    snapshotting.current = true;
    upsertDayPlan({
      variables: { input: { date: today, orderedIds: ids } },
      // Write the new plan straight into the DAY_PLAN query cache: a date-keyed
      // field can't be auto-matched from the mutation result, so without this the
      // query would keep returning null until the next network refetch.
      update: (cache, res) => {
        const dp = (res.data as { upsertDayPlan?: { orderedIds: string[] } } | null)?.upsertDayPlan;
        if (dp) {
          cache.writeQuery({ query: DAY_PLAN, variables: { date: today }, data: { dayPlan: dp } });
        }
      },
    }).catch(() => {
      snapshotting.current = false; // allow a retry on transient failure
    });
  }, [planReady, error, dayPlan, nodes, nodesLoading, today, upsertDayPlan]);

  const byId = useMemo(() => {
    const m: Record<string, XPNode> = {};
    for (const n of nodes) m[n._id] = n;
    return m;
  }, [nodes]);

  const items = useMemo<DayQueueItem[]>(() => {
    const ids = dayPlan?.orderedIds ?? [];
    const seen = new Set<string>();
    const out: DayQueueItem[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue; // de-dup (heals older duplicated plans)
      seen.add(id);
      const node = byId[id];
      if (!node) continue; // node deleted since planning — drop it
      out.push({ node, status: itemStatus(node, today) });
    }
    return out;
  }, [dayPlan, byId, today]);

  const summary = useMemo(() => summarizeDay(items.map((i) => i.status)), [items]);
  const pending = useMemo(
    () => items.filter((i) => i.status === 'pending').map((i) => i.node),
    [items],
  );

  const ready = planReady && !nodesLoading && (dayPlan != null || error != null || emptyDay);

  return { items, pending, summary, today, ready };
}
