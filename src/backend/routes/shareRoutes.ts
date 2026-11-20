import crypto from "crypto";
import { Router, Request, Response } from "express";
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from "../auth.js";
import { getMapPermission } from "./mapRoutes.js";
import { prisma } from "../db.js";

const router = Router();

// POST /maps/:id/share-links
router.post("/maps/:id/share-links", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const mapId = Number(req.params.id);
  const userId = req.user!.userId;
  const { permission = "view", expiresDays } = req.body;

  if (!["view", "edit"].includes(permission)) {
    res.status(400).json({ code: 400, message: "权限类型不正确" });
    return;
  }

  try {
    const perm = await getMapPermission(mapId, userId);
    if (perm !== "owner" && perm !== "editor") {
      res.status(403).json({ code: 403, message: "无创建分享链接权限" });
      return;
    }

    const token = crypto.randomBytes(32).toString("base64url");
    let expiresAt: Date | null = null;
    if (expiresDays && Number(expiresDays) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresDays) * 24 * 60 * 60 * 1000);
    }

    const shareLink = await prisma.shareLink.create({
      data: {
        mapId,
        token,
        permission,
        expiresAt,
      },
    });

    res.status(201).json({
      token: shareLink.token,
      permission: shareLink.permission,
      url: `/s/${shareLink.token}`,
      expiresAt: shareLink.expiresAt,
    });
  } catch (err) {
    console.error("Create share link error:", err);
    res.status(500).json({ code: 500, message: "创建分享链接失败" });
  }
});

// DELETE /share-links/:token
router.delete("/share-links/:token", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const token = req.params.token;
  const userId = req.user!.userId;

  try {
    const link = await prisma.shareLink.findUnique({
      where: { token },
      include: { map: true },
    });

    if (!link) {
      res.status(404).json({ code: 404, message: "分享链接不存在" });
      return;
    }

    if (link.map.ownerId !== userId) {
      res.status(403).json({ code: 403, message: "仅导图所有者可撤销分享链接" });
      return;
    }

    await prisma.shareLink.delete({ where: { id: link.id } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete share link error:", err);
    res.status(500).json({ code: 500, message: "撤销分享链接失败" });
  }
});

// GET /s/:token
router.get("/s/:token", optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const token = req.params.token;

  try {
    const link = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        map: {
          include: {
            owner: { select: { username: true } },
            nodes: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    if (!link) {
      res.status(404).json({ code: 404, message: "分享链接不存在或已被撤销" });
      return;
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      res.status(410).json({ code: 410, message: "分享链接已过期" });
      return;
    }

    // Increment visit count
    await prisma.shareLink.update({
      where: { id: link.id },
      data: { visitCount: { increment: 1 } },
    });

    const nodes = link.map.nodes.map((n) => ({
      nodeKey: n.nodeKey,
      parentKey: n.parentKey,
      text: n.text,
      note: n.note,
      styleJson: n.styleJson ? JSON.parse(n.styleJson) : null,
      collapsed: n.collapsed,
      sortOrder: n.sortOrder,
    }));

    const currentUserId = req.user?.userId;
    let canEdit = link.permission === "edit";
    if (currentUserId && link.map.ownerId === currentUserId) {
      canEdit = true;
    }

    res.status(200).json({
      map: {
        id: link.map.id,
        title: link.map.title,
        description: link.map.description,
        version: link.map.version,
        lastEditedAt: link.map.lastEditedAt,
        ownerName: link.map.owner.username,
      },
      permission: link.permission,
      canEdit,
      nodes,
    });
  } catch (err) {
    console.error("Get share link content error:", err);
    res.status(500).json({ code: 500, message: "读取分享内容失败" });
  }
});

export default router;
