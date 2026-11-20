import { Router, Request, Response } from "express";
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from "../auth.js";
import { getMapPermission } from "./mapRoutes.js";
import { prisma } from "../db.js";

const router = Router();

// GET /template-categories
router.get("/template-categories", async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.templateCategory.findMany({
      orderBy: { sortOrder: "asc" },
    });
    res.status(200).json(categories);
  } catch (err) {
    console.error("Get template categories error:", err);
    res.status(500).json({ code: 500, message: "获取模板分类失败" });
  }
});

// GET /templates
router.get("/templates", async (req: Request, res: Response) => {
  const categorySlug = String(req.query.category || "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
  const q = String(req.query.q || "").trim();

  try {
    const whereCondition: any = {};
    if (categorySlug) {
      whereCondition.category = { slug: categorySlug };
    }
    if (q) {
      whereCondition.title = { contains: q };
    }

    const total = await prisma.template.count({ where: whereCondition });
    const templates = await prisma.template.findMany({
      where: whereCondition,
      include: {
        creator: { select: { username: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const items = templates.map((t) => ({
      id: t.id,
      mapId: t.mapId,
      title: t.title,
      description: t.description,
      coverUrl: t.coverUrl,
      isPremium: t.isPremium,
      downloadCount: t.downloadCount,
      authorName: t.creator.username,
      categoryName: t.category.name,
      createdAt: t.createdAt,
    }));

    res.status(200).json({ items, total, page, pageSize });
  } catch (err) {
    console.error("Get templates error:", err);
    res.status(500).json({ code: 500, message: "获取模板列表失败" });
  }
});

// GET /templates/:id
router.get("/templates/:id", async (req: Request, res: Response) => {
  const templateId = Number(req.params.id);

  try {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: {
        creator: { select: { username: true } },
        category: { select: { name: true, slug: true } },
        map: {
          include: {
            nodes: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    if (!template) {
      res.status(404).json({ code: 404, message: "模板不存在" });
      return;
    }

    const nodes = template.map.nodes.map((n) => ({
      nodeKey: n.nodeKey,
      parentKey: n.parentKey,
      text: n.text,
      note: n.note,
      styleJson: n.styleJson ? JSON.parse(n.styleJson) : null,
      collapsed: n.collapsed,
      sortOrder: n.sortOrder,
    }));

    res.status(200).json({
      template: {
        id: template.id,
        title: template.title,
        description: template.description,
        isPremium: template.isPremium,
        downloadCount: template.downloadCount,
        authorName: template.creator.username,
        categoryName: template.category.name,
      },
      nodes,
    });
  } catch (err) {
    console.error("Get template details error:", err);
    res.status(500).json({ code: 500, message: "获取模板详情失败" });
  }
});

// POST /maps/:id/publish-template
router.post("/maps/:id/publish-template", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const mapId = Number(req.params.id);
  const userId = req.user!.userId;
  const { categoryId, title, description } = req.body;

  if (!categoryId || !title) {
    res.status(400).json({ code: 400, message: "缺少必要分类或标题参数" });
    return;
  }

  try {
    const perm = await getMapPermission(mapId, userId);
    if (perm !== "owner") {
      res.status(403).json({ code: 403, message: "仅导图所有者可以将其发布为模板" });
      return;
    }

    const sourceMap = await prisma.map.findUnique({
      where: { id: mapId },
      include: { nodes: true },
    });

    if (!sourceMap) {
      res.status(404).json({ code: 404, message: "原导图不存在" });
      return;
    }

    // Deep copy map and nodes to form a clean standalone template map
    const templateMap = await prisma.map.create({
      data: {
        ownerId: userId,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        isPublic: true,
        nodes: {
          create: sourceMap.nodes.map((n) => ({
            nodeKey: n.nodeKey,
            parentKey: n.parentKey,
            text: n.text,
            note: n.note,
            styleJson: n.styleJson,
            collapsed: n.collapsed,
            sortOrder: n.sortOrder,
          })),
        },
      },
    });

    const template = await prisma.template.create({
      data: {
        mapId: templateMap.id,
        categoryId: Number(categoryId),
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        createdBy: userId,
      },
    });

    res.status(201).json({ templateId: template.id });
  } catch (err) {
    console.error("Publish template error:", err);
    res.status(500).json({ code: 500, message: "发布模板失败" });
  }
});

// POST /templates/:id/use
router.post("/templates/:id/use", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const templateId = Number(req.params.id);
  const userId = req.user!.userId;

  try {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: {
        map: {
          include: { nodes: true },
        },
      },
    });

    if (!template) {
      res.status(404).json({ code: 404, message: "模板不存在" });
      return;
    }

    // Increment download/use count
    await prisma.template.update({
      where: { id: templateId },
      data: { downloadCount: { increment: 1 } },
    });

    // Deep copy into new independent map for current user
    const newMap = await prisma.map.create({
      data: {
        ownerId: userId,
        title: template.title,
        description: template.description,
        version: 0,
        nodes: {
          create: template.map.nodes.map((n) => ({
            nodeKey: n.nodeKey,
            parentKey: n.parentKey,
            text: n.text,
            note: n.note,
            styleJson: n.styleJson,
            collapsed: n.collapsed,
            sortOrder: n.sortOrder,
          })),
        },
      },
    });

    res.status(201).json({ mapId: newMap.id });
  } catch (err) {
    console.error("Use template error:", err);
    res.status(500).json({ code: 500, message: "使用模板生成导图失败" });
  }
});

// PUT /templates/:id
router.put("/templates/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const templateId = Number(req.params.id);
  const userId = req.user!.userId;
  const { title, description, categoryId } = req.body;

  try {
    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template) {
      res.status(404).json({ code: 404, message: "模板不存在" });
      return;
    }

    if (template.createdBy !== userId) {
      res.status(403).json({ code: 403, message: "仅模板创建者可以修改" });
      return;
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = String(title).trim();
    if (description !== undefined) updateData.description = String(description).trim();
    if (categoryId !== undefined) updateData.categoryId = Number(categoryId);

    await prisma.template.update({
      where: { id: templateId },
      data: updateData,
    });

    res.status(200).json({ message: "模板更新成功" });
  } catch (err) {
    console.error("Update template error:", err);
    res.status(500).json({ code: 500, message: "更新模板失败" });
  }
});

// DELETE /templates/:id
router.delete("/templates/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const templateId = Number(req.params.id);
  const userId = req.user!.userId;

  try {
    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template) {
      res.status(404).json({ code: 404, message: "模板不存在" });
      return;
    }

    if (template.createdBy !== userId) {
      res.status(403).json({ code: 403, message: "仅模板创建者可以删除" });
      return;
    }

    await prisma.template.delete({ where: { id: templateId } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete template error:", err);
    res.status(500).json({ code: 500, message: "删除模板失败" });
  }
});

export default router;
