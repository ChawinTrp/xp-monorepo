import { useQuery } from '@apollo/client/react';
import { GET_NODES } from './graphql';
import type { XPNode } from './types';
import { useMemo } from 'react';

interface NodesData {
  nodes: XPNode[];
}

export function useNodes() {
  const { data, loading, error, refetch } = useQuery<NodesData>(GET_NODES);
  const nodes = data?.nodes ?? [];

  const byId = useMemo(() => {
    const map: Record<string, XPNode> = {};
    for (const n of nodes) map[n._id] = n;
    return map;
  }, [nodes]);

  const childrenOf = useMemo(() => {
    const map: Record<string, XPNode[]> = {};
    for (const n of nodes) {
      if (n.mainParent) {
        (map[n.mainParent] ??= []).push(n);
      }
    }
    return map;
  }, [nodes]);

  const breadcrumb = (id: string): XPNode[] => {
    const out: XPNode[] = [];
    let cur = byId[id];
    while (cur?.mainParent) {
      cur = byId[cur.mainParent];
      if (cur) out.unshift(cur);
    }
    return out;
  };

  const byType = (type: string) => nodes.filter((n) => n.type === type);

  return { nodes, byId, childrenOf, breadcrumb, byType, loading, error, refetch };
}
