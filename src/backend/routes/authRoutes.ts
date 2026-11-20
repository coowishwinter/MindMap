import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  checkRateLimit,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  authMiddleware,
  AuthenticatedRequest,
} from "../auth.js";
import { prisma } from "../db.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  username: z.string().min(2, "用户名最少2字符"),
  password: z.string().min(6, "密码最少6字符"),
});

const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "密码不能为空"),
});

// POST /auth/register
router.post("/register", async (req: Request, res: Response) => {
  const ip = req.ip || "127.0.0.1";
  if (!checkRateLimit(ip, 10, 60000)) {
    res.status(429).json({ code: 429, message: "请求过于频繁，请稍后再试" });
    return;
  }

  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ code: 400, message: parseResult.error.issues[0]?.message || "注册参数错误" });
    return;
  }

  const { email, username, password } = parseResult.data;

  try {
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        res.status(400).json({ code: 400, message: "该邮箱已被注册" });
        return;
      } else {
        res.status(400).json({ code: 400, message: "该用户名已被使用" });
        return;
      }
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(username)}`,
      },
    });

    const userPayload = { userId: user.id, email: user.email, username: user.username };
    const accessToken = generateAccessToken(userPayload);
    const refreshToken = await generateRefreshToken(user.id);

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ code: 500, message: "注册服务器内部错误" });
  }
});

// POST /auth/login
router.post("/login", async (req: Request, res: Response) => {
  const ip = req.ip || "127.0.0.1";
  if (!checkRateLimit(ip, 5, 60000)) {
    res.status(429).json({ code: 429, message: "尝试次数过多，请1分钟后再试" });
    return;
  }

  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ code: 400, message: parseResult.error.issues[0]?.message || "登录参数错误" });
    return;
  }

  const { email, password } = parseResult.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ code: 401, message: "邮箱或密码错误" });
      return;
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ code: 401, message: "邮箱或密码错误" });
      return;
    }

    const userPayload = { userId: user.id, email: user.email, username: user.username };
    const accessToken = generateAccessToken(userPayload);
    const refreshToken = await generateRefreshToken(user.id);

    res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ code: 500, message: "登录失败" });
  }
});

// POST /auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== "string") {
    res.status(401).json({ code: 401, message: "缺少刷新令牌" });
    return;
  }

  const tokenHash = hashRefreshToken(refreshToken);

  try {
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      res.status(401).json({ code: 401, message: "刷新令牌已过期或无效" });
      return;
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    // Issue new pair
    const userPayload = {
      userId: tokenRecord.user.id,
      email: tokenRecord.user.email,
      username: tokenRecord.user.username,
    };
    const newAccessToken = generateAccessToken(userPayload);
    const newRefreshToken = await generateRefreshToken(tokenRecord.userId);

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(500).json({ code: 500, message: "令牌刷新失败" });
  }
});

// POST /auth/logout
router.post("/logout", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken && typeof refreshToken === "string") {
    const tokenHash = hashRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }
  res.status(204).send();
});

export default router;
