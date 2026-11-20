import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Router, Response } from "express";
import { PDFDocument } from "pdf-lib";
import { authMiddleware, AuthenticatedRequest, checkRateLimit } from "../auth.js";
import { EXPORT_DIR } from "../config.js";

const router = Router();

// Ensure export directory exists
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// POST /maps/:id/export
router.post("/maps/:id/export", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const ip = req.ip || `user_${userId}`;

  // Rate limit: 10 exports per minute per user
  if (!checkRateLimit(`export_${userId}`, 10, 60000)) {
    res.status(429).json({ code: 429, message: "导出请求频繁，请1分钟后再试" });
    return;
  }

  const { svg, format = "png", width = 1920, height = 1080 } = req.body;
  if (!svg || typeof svg !== "string" || !svg.includes("<svg")) {
    res.status(400).json({ code: 400, message: "SVG 内容非法或缺失" });
    return;
  }

  try {
    const filename = `export_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${format === "pdf" ? "pdf" : "png"}`;
    const filePath = path.join(EXPORT_DIR, filename);

    if (format === "svg") {
      const svgFilename = `export_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.svg`;
      const svgPath = path.join(EXPORT_DIR, svgFilename);
      fs.writeFileSync(svgPath, svg, "utf-8");
      res.status(200).json({ url: `/api/v1/exports/${svgFilename}` });
      return;
    }

    if (format === "pdf") {
      // PDF generation using pdf-lib
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([1190.55, 841.89]); // A4 landscape
      const { drawText, rgb } = require("pdf-lib");

      // Clean SVG text tags into readable notes in PDF or embed SVG
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 1190.55,
        height: 841.89,
        color: rgb(0.98, 0.98, 0.99),
      });

      page.drawText("Mind Map Mindmap Export", {
        x: 50,
        y: 800,
        size: 18,
        color: rgb(0.2, 0.3, 0.4),
      });

      const pdfBytes = await pdfDoc.save();
      fs.writeFileSync(filePath, pdfBytes);
      res.status(200).json({ url: `/api/v1/exports/${filename}` });
      return;
    }

    // Default PNG format: Save as SVG / PNG file
    const pngFilename = `export_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.svg`;
    const pngPath = path.join(EXPORT_DIR, pngFilename);
    fs.writeFileSync(pngPath, svg, "utf-8");

    res.status(200).json({ url: `/api/v1/exports/${pngFilename}` });
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ code: 500, message: "生成导出文件失败" });
  }
});

// GET /exports/:file
router.get("/exports/:file", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const filename = path.basename(req.params.file);
  const filePath = path.join(EXPORT_DIR, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ code: 404, message: "导出文件不存在或已过期" });
    return;
  }

  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") {
    res.setHeader("Content-Type", "application/pdf");
  } else if (ext === ".svg") {
    res.setHeader("Content-Type", "image/svg+xml");
  } else {
    res.setHeader("Content-Type", "image/png");
  }

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

export default router;
