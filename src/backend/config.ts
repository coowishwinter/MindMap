import dotenv from "dotenv";
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || "mindmap_jwt_secret_key_2026_super_safe_32_chars";
export const PORT = Number(process.env.PORT) || 3000;
export const EXPORT_DIR = process.env.EXPORT_DIR || "./exports";
