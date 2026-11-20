import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function seedDatabase() {
  try {
    const categoryCount = await prisma.templateCategory.count();
    if (categoryCount === 0) {
      console.log("Seeding initial template categories...");
      const categories = [
        { name: "学习", slug: "study", sortOrder: 1 },
        { name: "职场", slug: "work", sortOrder: 2 },
        { name: "产品", slug: "product", sortOrder: 3 },
        { name: "生活", slug: "life", sortOrder: 4 },
      ];

      for (const cat of categories) {
        await prisma.templateCategory.create({ data: cat });
      }

      // Create a system default user for system templates
      let systemUser = await prisma.user.findUnique({ where: { username: "system" } });
      if (!systemUser) {
        systemUser = await prisma.user.create({
          data: {
            email: "system@mindmap.app",
            username: "system",
            passwordHash: "$2a$12$eImiTXuWVxfM37uY4JANjO.Gk1e.1Z.E29e8c46.y3Y.", // dummy
          },
        });
      }

      const studyCat = await prisma.templateCategory.findUnique({ where: { slug: "study" } });
      const workCat = await prisma.templateCategory.findUnique({ where: { slug: "work" } });
      const productCat = await prisma.templateCategory.findUnique({ where: { slug: "product" } });
      const lifeCat = await prisma.templateCategory.findUnique({ where: { slug: "life" } });

      // Create sample template maps
      if (studyCat && systemUser) {
        // Study template map
        const studyMap = await prisma.map.create({
          data: {
            title: "读书笔记与思维导图模板",
            description: "结构化的书籍拆解框架，包含核心观点、知识卡片与行动清单。",
            ownerId: systemUser.id,
            isPublic: true,
            nodes: {
              create: [
                { nodeKey: "root", parentKey: null, text: "📖 读书笔记：《高效能人士的七个习惯》", sortOrder: 0 },
                { nodeKey: "ch1", parentKey: "root", text: "一、思维方式与原则", sortOrder: 0 },
                { nodeKey: "ch1_1", parentKey: "ch1", text: "由内而外的改变", sortOrder: 0 },
                { nodeKey: "ch1_2", parentKey: "ch1", text: "品德与能力并重", sortOrder: 1 },
                { nodeKey: "ch2", parentKey: "root", text: "二、个人领域的成功", sortOrder: 1 },
                { nodeKey: "ch2_1", parentKey: "ch2", text: "习惯1：积极主动（责任在己）", sortOrder: 0 },
                { nodeKey: "ch2_2", parentKey: "ch2", text: "习惯2：以终为始（明确目标）", sortOrder: 1 },
                { nodeKey: "ch2_3", parentKey: "ch2", text: "习惯3：要事第一（时间管理）", sortOrder: 2 },
                { nodeKey: "ch3", parentKey: "root", text: "三、公众领域的成功", sortOrder: 2 },
                { nodeKey: "ch3_1", parentKey: "ch3", text: "习惯4：双赢思维", sortOrder: 0 },
                { nodeKey: "ch3_2", parentKey: "ch3", text: "习惯5：知彼解己", sortOrder: 1 },
                { nodeKey: "ch3_3", parentKey: "ch3", text: "习惯6：统合综效", sortOrder: 2 },
              ],
            },
          },
        });
        await prisma.template.create({
          data: {
            mapId: studyMap.id,
            categoryId: studyCat.id,
            title: "高效读书拆解模板",
            description: "结构化的书籍拆解框架，包含核心观点、知识卡片与行动清单。",
            createdBy: systemUser.id,
          },
        });
      }

      if (productCat && systemUser) {
        const prdMap = await prisma.map.create({
          data: {
            title: "产品需求文档 (PRD) 拆解图",
            description: "适用于产品经理梳理需求背景、功能矩阵、业务流程与交互规范。",
            ownerId: systemUser.id,
            isPublic: true,
            nodes: {
              create: [
                { nodeKey: "root", parentKey: null, text: "🚀 产品需求文档 (PRD) 目标架构", sortOrder: 0 },
                { nodeKey: "p1", parentKey: "root", text: "1. 需求背景与目标", sortOrder: 0 },
                { nodeKey: "p1_1", parentKey: "p1", text: "用户痛点分析", sortOrder: 0 },
                { nodeKey: "p1_2", parentKey: "p1", text: "核心业务指标 (KPI)", sortOrder: 1 },
                { nodeKey: "p2", parentKey: "root", text: "2. 功能模块与优先级", sortOrder: 1 },
                { nodeKey: "p2_1", parentKey: "p2", text: "P0 核心流程", sortOrder: 0 },
                { nodeKey: "p2_2", parentKey: "p2", text: "P1 扩展增强功能", sortOrder: 1 },
                { nodeKey: "p3", parentKey: "root", text: "3. 交互与异常流处理", sortOrder: 2 },
                { nodeKey: "p3_1", parentKey: "p3", text: "网络异常/超时提示", sortOrder: 0 },
                { nodeKey: "p3_2", parentKey: "p3", text: "并发冲突与兜底策略", sortOrder: 1 },
              ],
            },
          },
        });
        await prisma.template.create({
          data: {
            mapId: prdMap.id,
            categoryId: productCat.id,
            title: "敏捷 PRD 功能拆解",
            description: "适用于产品经理梳理需求背景、功能矩阵、业务流程与交互规范。",
            createdBy: systemUser.id,
          },
        });
      }

      if (workCat && systemUser) {
        const workMap = await prisma.map.create({
          data: {
            title: "项目进度管理与里程碑",
            description: "清晰拆解 OKR 目标、阶段任务分配与风险评估框架。",
            ownerId: systemUser.id,
            isPublic: true,
            nodes: {
              create: [
                { nodeKey: "root", parentKey: null, text: "💼 季度 OKR 落地与项目计划", sortOrder: 0 },
                { nodeKey: "w1", parentKey: "root", text: "O1：提升系统可靠性与响应速度", sortOrder: 0 },
                { nodeKey: "w1_1", parentKey: "w1", text: "KR1：接口 P99 延迟降低至 100ms 内", sortOrder: 0 },
                { nodeKey: "w1_2", parentKey: "w1", text: "KR2：单元测试覆盖率提升至 85%", sortOrder: 1 },
                { nodeKey: "w2", parentKey: "root", text: "O2：拓展协作生态与工具链", sortOrder: 1 },
                { nodeKey: "w2_1", parentKey: "w2", text: "KR1：完成 WebSocket 多人协同模组", sortOrder: 0 },
              ],
            },
          },
        });
        await prisma.template.create({
          data: {
            mapId: workMap.id,
            categoryId: workCat.id,
            title: "季度 OKR 落地拆解表",
            description: "清晰拆解 OKR 目标、阶段任务分配与风险评估框架。",
            createdBy: systemUser.id,
          },
        });
      }

      console.log("Template categories and sample templates seeded successfully!");
    }
  } catch (err) {
    console.error("Error seeding database:", err);
  }
}
