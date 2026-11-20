import { Server, Socket } from "socket.io";
import { verifyAccessToken, JwtPayload } from "../auth.js";
import { prisma } from "../db.js";
import { getMapPermission } from "../routes/mapRoutes.js";

interface CustomSocket extends Socket {
  user?: JwtPayload;
}

export function setupSocketIO(io: Server) {
  // Authentication middleware
  io.use((socket: CustomSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.query?.token as string);

    if (!token) {
      return next(new Error("未提供认证 Token"));
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return next(new Error("Token 无效或已过期"));
    }

    socket.user = payload;
    next();
  });

  io.on("connection", (socket: CustomSocket) => {
    const user = socket.user!;
    console.log(`Socket connected: User ${user.username} (ID: ${user.userId})`);

    // Event: join room
    socket.on("join", async (data: { mapId: number }) => {
      const mapId = Number(data.mapId);
      if (isNaN(mapId)) {
        socket.emit("error_message", { message: "非法导图 ID" });
        return;
      }

      const perm = await getMapPermission(mapId, user.userId);
      if (!perm) {
        socket.emit("error_message", { message: "无权限访问该导图" });
        return;
      }

      const roomName = `map:${mapId}`;
      socket.join(roomName);

      const map = await prisma.map.findUnique({
        where: { id: mapId },
        select: { version: true },
      });

      socket.emit("room_state", {
        mapId,
        version: map?.version || 0,
        role: perm,
      });

      // Notify room about active presence
      io.to(roomName).emit("user_joined", {
        userId: user.userId,
        username: user.username,
      });
    });

    // Event: op submission
    socket.on("op", async (data: {
      mapId: number;
      clientOpId: string;
      ops: Array<{ opType: string; payload: any }>;
      baseVersion?: number;
    }) => {
      const mapId = Number(data.mapId);
      const { clientOpId, ops } = data;

      if (!mapId || !clientOpId || !Array.isArray(ops) || ops.length === 0) {
        socket.emit("op_rejected", { reason: "请求参数结构不完整" });
        return;
      }

      const perm = await getMapPermission(mapId, user.userId);
      if (perm !== "owner" && perm !== "editor") {
        socket.emit("op_rejected", { reason: "仅导图所有者或编辑者可提交修改" });
        return;
      }

      try {
        // 1. Idempotency check: if clientOpId already processed, return current map version
        const existingOpLog = await prisma.opLog.findUnique({
          where: { mapId_clientOpId: { mapId, clientOpId } },
        });

        if (existingOpLog) {
          const map = await prisma.map.findUnique({ where: { id: mapId } });
          socket.emit("op_ack", { newVersion: map?.version || 0, clientOpId });
          return;
        }

        // 2. Apply ops sequentially & write OpLog
        let lastOpLogId = 0;

        for (const opItem of ops) {
          const { opType, payload } = opItem;

          if (opType === "add_node") {
            const { nodeKey, parentKey, text, sortOrder = 0 } = payload;
            if (nodeKey) {
              let finalParentKey = parentKey;
              if (finalParentKey) {
                const parentNode = await prisma.mapNode.findUnique({
                  where: { mapId_nodeKey: { mapId, nodeKey: finalParentKey } },
                });
                if (!parentNode) {
                  finalParentKey = "root"; // fallback to root if parent node missing
                }
              }

              await prisma.mapNode.upsert({
                where: { mapId_nodeKey: { mapId, nodeKey } },
                create: {
                  mapId,
                  nodeKey,
                  parentKey: finalParentKey,
                  text: text || "新主题",
                  sortOrder,
                },
                update: {
                  parentKey: finalParentKey,
                  text: text !== undefined ? text : undefined,
                  sortOrder,
                },
              });
            }
          } else if (opType === "update_text") {
            const { nodeKey, text } = payload;
            if (nodeKey) {
              await prisma.mapNode.updateMany({
                where: { mapId, nodeKey },
                data: { text: text || "" },
              });
            }
          } else if (opType === "update_note") {
            const { nodeKey, note } = payload;
            if (nodeKey) {
              await prisma.mapNode.updateMany({
                where: { mapId, nodeKey },
                data: { note: note || null },
              });
            }
          } else if (opType === "update_style") {
            const { nodeKey, style } = payload;
            if (nodeKey && style) {
              const existingNode = await prisma.mapNode.findUnique({
                where: { mapId_nodeKey: { mapId, nodeKey } },
              });
              let newStyle = style;
              if (existingNode?.styleJson) {
                try {
                  const currentStyle = JSON.parse(existingNode.styleJson);
                  newStyle = { ...currentStyle, ...style };
                } catch (e) {}
              }
              await prisma.mapNode.updateMany({
                where: { mapId, nodeKey },
                data: { styleJson: JSON.stringify(newStyle) },
              });
            }
          } else if (opType === "move_node") {
            const { nodeKey, parentKey, sortOrder = 0 } = payload;
            if (nodeKey && nodeKey !== "root") {
              let targetParentKey = parentKey;
              if (targetParentKey) {
                const targetParentNode = await prisma.mapNode.findUnique({
                  where: { mapId_nodeKey: { mapId, nodeKey: targetParentKey } },
                });
                if (!targetParentNode) {
                  targetParentKey = "root";
                }
              }

              // Check cycle: parent cannot be in nodeKey's subtree
              const allNodes = await prisma.mapNode.findMany({ where: { mapId } });
              let currKey = targetParentKey;
              let isCycle = false;
              while (currKey) {
                if (currKey === nodeKey) {
                  isCycle = true;
                  break;
                }
                const p = allNodes.find((n) => n.nodeKey === currKey);
                currKey = p?.parentKey || null;
              }

              if (!isCycle) {
                await prisma.mapNode.updateMany({
                  where: { mapId, nodeKey },
                  data: { parentKey: targetParentKey, sortOrder },
                });
              }
            }
          } else if (opType === "collapse") {
            const { nodeKey, collapsed } = payload;
            if (nodeKey) {
              await prisma.mapNode.updateMany({
                where: { mapId, nodeKey },
                data: { collapsed: Boolean(collapsed) },
              });
            }
          } else if (opType === "delete_node") {
            const { nodeKey } = payload;
            if (nodeKey && nodeKey !== "root") {
              const allNodes = await prisma.mapNode.findMany({ where: { mapId } });
              const keysToDelete = new Set<string>();

              const collectDescendants = (k: string) => {
                keysToDelete.add(k);
                const children = allNodes.filter((n) => n.parentKey === k);
                children.forEach((c) => collectDescendants(c.nodeKey));
              };

              collectDescendants(nodeKey);

              await prisma.mapNode.deleteMany({
                where: {
                  mapId,
                  nodeKey: { in: Array.from(keysToDelete) },
                },
              });
            }
          } else if (opType === "update_title") {
            const { title } = payload;
            if (title) {
              await prisma.map.update({
                where: { id: mapId },
                data: { title: String(title).trim() },
              });
            }
          }

          // Record OpLog
          const opLog = await prisma.opLog.create({
            data: {
              mapId,
              userId: user.userId,
              opType,
              clientOpId: `${clientOpId}_${opType}`,
              payload: JSON.stringify(payload),
            },
          });
          lastOpLogId = opLog.id;
        }

        // Update map version to latest OpLog id
        if (lastOpLogId > 0) {
          await prisma.map.update({
            where: { id: mapId },
            data: { version: lastOpLogId, lastEditedAt: new Date() },
          });
        }

        const currentMap = await prisma.map.findUnique({
          where: { id: mapId },
          select: { version: true },
        });

        const newVersion = currentMap?.version || lastOpLogId;
        const roomName = `map:${mapId}`;

        // Broadcast ops to other sockets in room
        socket.to(roomName).emit("op_broadcast", {
          mapId,
          ops,
          newVersion,
          userId: user.userId,
          username: user.username,
        });

        // Ack to sender
        socket.emit("op_ack", { newVersion, clientOpId });
      } catch (err) {
        console.error("Op execution error:", err);
        socket.emit("op_rejected", { reason: "服务器操作执行错误" });
      }
    });

    // Event: collaborator cursor position
    socket.on("cursor", (data: { mapId: number; nodeId: string | null }) => {
      const mapId = Number(data.mapId);
      if (mapId) {
        socket.to(`map:${mapId}`).emit("cursor_update", {
          userId: user.userId,
          username: user.username,
          nodeId: data.nodeId,
        });
      }
    });

    // Event: catchup missed ops
    socket.on("catchup", async (data: { mapId: number; lastVersion: number }) => {
      const mapId = Number(data.mapId);
      const lastVersion = Number(data.lastVersion) || 0;

      if (!mapId) return;

      try {
        const opLogs = await prisma.opLog.findMany({
          where: {
            mapId,
            id: { gt: lastVersion },
          },
          orderBy: { id: "asc" },
          take: 500,
        });

        const currentMap = await prisma.map.findUnique({
          where: { id: mapId },
          select: { version: true },
        });

        const ops = opLogs.map((log) => ({
          id: log.id,
          opType: log.opType,
          payload: JSON.parse(log.payload),
          userId: log.userId,
        }));

        socket.emit("catchup_result", {
          ops,
          nextVersion: currentMap?.version || lastVersion,
        });
      } catch (err) {
        console.error("Catchup error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: User ${user.username}`);
    });
  });
}
