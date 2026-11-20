import http from "http";
import path from "path";
import express from "express";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";

import { PORT } from "./src/backend/config.js";
import { seedDatabase } from "./src/backend/db.js";
import authRoutes from "./src/backend/routes/authRoutes.js";
import mapRoutes from "./src/backend/routes/mapRoutes.js";
import shareRoutes from "./src/backend/routes/shareRoutes.js";
import templateRoutes from "./src/backend/routes/templateRoutes.js";
import exportRoutes from "./src/backend/routes/exportRoutes.js";
import { setupSocketIO } from "./src/backend/ws/socketHandler.js";

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Cross-origin and JSON body parser
  app.use(cors());
  app.use(express.json({ limit: "20mb" }));

  // Seed default database data on boot
  await seedDatabase();

  // API Health Check
  app.get("/api/v1/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Mount API V1 routes
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/maps", mapRoutes);
  app.use("/api/v1", shareRoutes);
  app.use("/api/v1", templateRoutes);
  app.use("/api/v1", exportRoutes);

  // Setup Socket.IO for real-time collaboration
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/socket.io",
  });
  setupSocketIO(io);

  // Vite development middleware vs Static Production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 MindMap Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
