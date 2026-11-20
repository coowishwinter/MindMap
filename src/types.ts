export interface User {
  id: number;
  email: string;
  username: string;
  avatarUrl?: string;
}

export interface NodeStyle {
  color?: string;
  background?: string;
  icon?: string;
  fontSize?: number;
  fontWeight?: string;
}

export interface MapNodeItem {
  nodeKey: string;
  parentKey: string | null;
  text: string;
  note?: string | null;
  styleJson?: NodeStyle | null;
  collapsed?: boolean;
  sortOrder: number;
  // Computed layout attributes
  x?: number;
  y?: number;
  depth?: number;
}

export interface MindMap {
  id: number;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  isPublic: boolean;
  version: number;
  lastEditedAt: string;
  createdAt: string;
  ownerName?: string;
  ownerId?: number;
  role?: "owner" | "editor" | "viewer";
}

export interface MapCollaboratorItem {
  userId: number;
  username: string;
  email: string;
  avatarUrl?: string;
  role: "owner" | "editor" | "viewer";
}

export interface OpItem {
  opType: "add_node" | "update_text" | "update_note" | "update_style" | "move_node" | "collapse" | "delete_node" | "update_title";
  clientOpId: string;
  payload: any;
}

export interface TemplateCategory {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface TemplateItem {
  id: number;
  mapId: number;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  isPremium: boolean;
  downloadCount: number;
  authorName: string;
  categoryName: string;
  createdAt: string;
}

export interface CollaboratorCursor {
  userId: number;
  username: string;
  nodeId: string | null;
  color?: string;
}
