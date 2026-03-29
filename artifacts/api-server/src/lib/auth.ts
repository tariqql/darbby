import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "darbby-secret-key";

export interface JwtPayload {
  id: string;
  email: string;
  actor: "USER" | "MERCHANT";
  name?: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const token = header.slice(7);
    const payload = verifyToken(token);
    (req as any).auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireActor(actor: "USER" | "MERCHANT") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = (req as any).auth as JwtPayload;
    if (!auth || auth.actor !== actor) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
