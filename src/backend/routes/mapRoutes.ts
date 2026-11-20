import { Router, Response } from "express";
import { z } from "zod";
import { authMiddleware, AuthenticatedRequest } from "../auth.js";
import { prisma } from "../db.js";

const router = Router();

// Helper to check user permission on a map
export async function getMapPermission(mapId: number, userId: number): Promise<"owner" | "editor" | "viewer" | null> {
  const map = await prisma.map.findUnique({
    where: { id: mapId },
    select: { ownerId: true, isPublic: true },
  });

  if (!map) return null;
  if (map.ownerId === userId) return "owner";

  const collab = await prisma.mapCollaborator.findUnique({
    where: { mapId_userId: { mapId, userId } },
  });

  if (collab) {
    return collab.role as "editor" | "viewer";
  }

  if (map.isPublic) {
    return "viewer";
  }

  return null;
}

// GET /maps
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
  const q = String(req.query.q || "").trim();

  try {
    const whereCondition: any = {
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId } } },
      ],
    };

    if (q) {
      whereCondition.AND = {
        title: { contains: q },
      };
    }

    const total = await prisma.map.count({ where: whereCondition });
    const maps = await prisma.map.findMany({
      where: whereCondition,
      include: {
        owner: { select: { username: true, avatarUrl: true } },
        collaborators: { where: { userId }, select: { role: true } },
      },
      orderBy: { lastEditedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const items = maps.map((m) => {
      let role = "viewer";
      if (m.ownerId === userId) {
        role = "owner";
      } else if (m.collaborators.length > 0) {
        role = m.collaborators[0].role;
      }
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        coverUrl: m.coverUrl,
        isPublic: m.isPublic,
        version: m.version,
        lastEditedAt: m.lastEditedAt,
        createdAt: m.createdAt,
        ownerName: m.owner.username,
        role,
      };
    });

    res.status(200).json({ items, total, page, pageSize });
  } catch (err) {
    console.error("Get maps error:", err);
    res.status(500).json({ code: 500, message: "获取导图列表失败" });
  }
});

// POST /maps
router.post("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const title = String(req.body.title || "未命名导图").trim();

  try {
    const map = await prisma.map.create({
      data: {
        ownerId: userId,
        title,
        version: 0,
        nodes: {
          create: {
            nodeKey: "root",
            parentKey: null,
            text: title || "中心主题",
            sortOrder: 0,
          },
        },
      },
      include: {
        nodes: true,
      },
    });

    const rootNode = map.nodes[0];
    res.status(201).json({
      map: {
        id: map.id,
        title: map.title,
        description: map.description,
        isPublic: map.isPublic,
        version: map.version,
        lastEditedAt: map.lastEditedAt,
        createdAt: map.createdAt,
      },
      rootNode: {
        nodeKey: rootNode.nodeKey,
        parentKey: rootNode.parentKey,
        text: rootNode.text,
        note: rootNode.note,
        styleJson: rootNode.styleJson ? JSON.parse(rootNode.styleJson) : null,
        collapsed: rootNode.collapsed,
        sortOrder: rootNode.sortOrder,
      },
    });
  } catch (err) {
    console.error("Create map error:", err);
    res.status(500).json({ code: 500, message: "新建导图失败" });
  }
});

// GET /maps/:id
router.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const mapId = Number(req.params.id);
  const userId = req.user!.userId;

  if (isNaN(mapId)) {
    res.status(400).json({ code: 400, message: "非法导图 ID" });
    return;
  }

  try {
    const permission = await getMapPermission(mapId, userId);
    if (!permission) {
      res.status(403).json({ code: 403, message: "无权访问此导图或项目不存在" });
      return;
    }

    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        owner: { select: { id: true, username: true, avatarUrl: true } },
        nodes: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!map) {
      res.status(404).json({ code: 404, message: "导图不存在" });
      return;
    }

    const nodes = map.nodes.map((n) => ({
      nodeKey: n.nodeKey,
      parentKey: n.parentKey,
      text: n.text,
      note: n.note,
      styleJson: n.styleJson ? JSON.parse(n.styleJson) : null,
      collapsed: n.collapsed,
      sortOrder: n.sortOrder,
    }));

    res.status(200).json({
      map: {
        id: map.id,
        title: map.title,
        description: map.description,
        coverUrl: map.coverUrl,
        isPublic: map.isPublic,
        version: map.version,
        lastEditedAt: map.lastEditedAt,
        ownerId: map.ownerId,
        ownerName: map.owner.username,
        role: permission,
      },
      nodes,
    });
  } catch (err) {
    console.error("Get map details error:", err);
    res.status(500).json({ code: 500, message: "获取导图详情失败" });
  }
});

// PUT /maps/:id
router.put("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const mapId = Number(req.params.id);
  const userId = req.user!.userId;

  try {
    const permission = await getMapPermission(mapId, userId);
    if (permission !== "owner" && permission !== "editor") {
      res.status(403).json({ code: 403, message: "无编辑权限" });
      return;
    }

    const { title, description, isPublic } = req.body;
    const updateData: any = {};
    if (title !== undefined) updateData.title = String(title).trim();
    if (description !== undefined) updateData.description = String(description).trim();
    if (isPublic !== undefined) updateData.isPublic = Boolean(isPublic);

    const updatedMap = await prisma.map.update({
      where: { id: mapId },
      data: updateData,
    });

    res.status(200).json({ map: updatedMap });
  } catch (err) {
    console.error("Update map error:", err);
    res.status(500).json({ code: 500, message: "更新导图信息失败" });
  }
});

// DELETE /maps/:id
router.delete("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const mapId = Number(req.params.id);
  const userId = req.user!.userId;

  try {
    const permission = await getMapPermission(mapId, userId);
    if (permission !== "owner") {
      res.status(403).json({ code: 403, message: "仅导图所有者可删除" });
      return;
    }

    await prisma.map.delete({ where: { id: mapId } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete map error:", err);
    res.status(500).json({ code: 500, message: "删除导图失败" });
  }
});

// GET /maps/:id/collaborators
router.get("/:id/collaborators", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const mapId = Number(req.params.id);
  const userId = req.user!.userId;

  try {
    const permission = await getMapPermission(mapId, userId);
    if (!permission) {
      res.status(403).json({ code: 403, message: "无访问权限" });
      return;
    }

    const collaborators = await prisma.mapCollaborator.findMany({
      where: { mapId },
      include: { user: { select: { id: true, username: true, email: true, avatarUrl: true } } },
    });

    const result = collaborators.map((c) => ({
      userId: c.user.id,
      username: c.user.username,
      email: c.user.email,
      avatarUrl: c.user.avatarUrl,
      role: c.role,
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error("Get collaborators error:", err);
    res.status(500).json({ code: 500, message: "获取协作者列表失败" });
  }
});

// PUT /maps/:id/collaborators
router.put("/:id/collaborators", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const mapId = Number(req.params.id);
  const userId = req.user!.userId;
  const { email, role } = req.body;

  if (!email || !["editor", "viewer"].includes(role)) {
    res.status(400).json({ code: 400, message: "参数无效，需提供邮箱和正确角色" });
    return;
  }

  try {
    const permission = await getMapPermission(mapId, userId);
    if (permission !== "owner") {
      res.status(403).json({ code: 403, message: "仅导图所有者可以管理协作者" });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      res.status(404).json({ code: 404, message: "目标用户不存在" });
      return;
    }

    const map = await prisma.map.findUnique({ where: { id: mapId } });
    if (map?.ownerId === targetUser.id) {
      res.status(400).json({ code: 400, message: "不能将自己添加为协作者" });
      return;
    }

    await prisma.mapCollaborator.upsert({
      where: { mapId_userId: { mapId, userId: targetUser.id } },
      create: { mapId, userId: targetUser.id, role },
      update: { role },
    });

    res.status(200).json({ message: "协作者更新成功" });
  } catch (err) {
    console.error("Upsert collaborator error:", err);
    res.status(500).json({ code: 500, message: "添加协作者失败" });
  }
});

// DELETE /maps/:id/collaborators/:targetUserId
router.delete("/:id/collaborators/:targetUserId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const mapId = Number(req.params.id);
  const targetUserId = Number(req.params.targetUserId);
  const userId = req.user!.userId;

  try {
    const permission = await getMapPermission(mapId, userId);
    if (permission !== "owner" && userId !== targetUserId) {
      res.status(403).json({ code: 403, message: "无权移除该协作者" });
      return;
    }

    await prisma.mapCollaborator.delete({
      where: { mapId_userId: { mapId, userId: targetUserId } },
    });

    res.status(204).send();
  } catch (err) {
    console.error("Delete collaborator error:", err);
    res.status(500).json({ code: 500, message: "移除协作者失败" });
  }
});

export default router;
