import { MapNodeItem } from "../types.js";

const H_GAP = 260; // Horizontal gap per depth level
const V_GAP = 60;  // Vertical gap per node unit

export function calculateTreeLayout(nodes: MapNodeItem[]): MapNodeItem[] {
  if (!nodes || nodes.length === 0) return [];

  // 1. Build parent -> children map
  const childrenMap = new Map<string, MapNodeItem[]>();
  let rootNode: MapNodeItem | null = null;

  nodes.forEach((n) => {
    if (!n.parentKey) {
      rootNode = n;
    } else {
      const list = childrenMap.get(n.parentKey) || [];
      list.push(n);
      childrenMap.set(n.parentKey, list);
    }
  });

  // Sort children by sortOrder
  childrenMap.forEach((list) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  });

  if (!rootNode) return nodes;

  // 2. Post-order traversal to calculate height unit for each subtree
  const heightMap = new Map<string, number>();

  function calcHeight(nodeKey: string, collapsed?: boolean): number {
    const children = childrenMap.get(nodeKey) || [];
    if (collapsed || children.length === 0) {
      heightMap.set(nodeKey, 1);
      return 1;
    }

    let total = 0;
    children.forEach((child) => {
      total += calcHeight(child.nodeKey, child.collapsed);
    });
    heightMap.set(nodeKey, Math.max(1, total));
    return Math.max(1, total);
  }

  calcHeight(rootNode.nodeKey, rootNode.collapsed);

  // 3. Pre-order traversal to assign x and y coordinates
  const resultMap = new Map<string, MapNodeItem>();

  function assignPositions(
    node: MapNodeItem,
    depth: number,
    startY: number
  ) {
    const subtreeHeight = heightMap.get(node.nodeKey) || 1;
    const x = depth * H_GAP;
    // Center node vertically inside its allocated subtree height
    const y = startY + ((subtreeHeight - 1) / 2) * V_GAP;

    resultMap.set(node.nodeKey, {
      ...node,
      x,
      y,
      depth,
    });

    const children = childrenMap.get(node.nodeKey) || [];
    if (!node.collapsed && children.length > 0) {
      let currentChildY = startY;
      children.forEach((child) => {
        const childSubtreeHeight = heightMap.get(child.nodeKey) || 1;
        assignPositions(child, depth + 1, currentChildY);
        currentChildY += childSubtreeHeight * V_GAP;
      });
    }
  }

  assignPositions(rootNode, 0, 0);

  // Return nodes updated with coordinates (nodes hidden inside collapsed branch retain old coordinates or flag)
  return nodes.map((n) => {
    const pos = resultMap.get(n.nodeKey);
    if (pos) return pos;
    return { ...n, x: 0, y: 0, depth: 0 };
  });
}
