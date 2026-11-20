import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { JWT_SECRET } from "./config.js";
import { prisma } from "./db.js";

export interface JwtPayload {
  userId: number;
  email: string;
  username: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// Rate limiter storage: IP -> array of timestamps
const rateLimitStore: Record<string, number[]> = {};

export function checkRateLimit(ip: string, maxRequests = 5, windowMs = 60000): boolean {
  const now = Date.now();
  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = [];
  }
  // Filter out older timestamps outside window
  rateLimitStore[ip] = rateLimitStore[ip].filter((t) => now - t < windowMs);
  if (rateLimitStore[ip].length >= maxRequests) {
    return false;
  }
  rateLimitStore[ip].push(now);
  return true;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function generateRefreshToken(userId: number): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (err) {
    return null;
  }
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ code: 401, message: "未登录或令牌缺失" });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ code: 401, message: "令牌无效或已过期" });
    return;
  }

  req.user = payload;
  next();
}

export function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}
