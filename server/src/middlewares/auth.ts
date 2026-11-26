import "dotenv/config";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole, TokenPayload } from "../types/roles.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === "production"
    ? ""
    : "messmate-development-session-key");

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required in production");
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  studentDbId?: number; // Internal students.id if the user is a student
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * requireAuth middleware:
 * Validates the JWT Bearer header, queries the database to confirm the user and their authoritative role,
 * and attaches verified claims to req.user.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication token required" });
    return;
  }

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    res.status(401).json({ error: "Invalid or expired session token" });
    return;
  }

  // Authoritatively re-verify role from the database on sensitive calls
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, decoded.userId))
    .limit(1)
    .get();

  if (!user) {
    res.status(401).json({ error: "User account no longer exists" });
    return;
  }

  req.user = {
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
    fullName: user.fullName,
    studentId: decoded.studentId,
  };

  // If student, attach internal students.id
  if (user.role === "student") {
    const student = await db
      .select()
      .from(schema.students)
      .where(eq(schema.students.userId, user.id))
      .limit(1)
      .get();

    if (student) {
      req.studentDbId = student.id;
      req.user.studentId = student.studentId;
    }
  }

  next();
}

/**
 * requireRole middleware:
 * Enforces role authorization strictly on the server.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: Access restricted to [${allowedRoles.join(", ")}]. Current role: '${req.user.role}'`,
      });
      return;
    }

    next();
  };
}

/**
 * requireStudentSelfOrAdmin:
 * Guarantees a student can only view/modify their own student record.
 * Admins can access all records. Staff cannot access student financial or private records.
 */
export function requireStudentSelfOrAdmin(paramKey: string = "studentId") {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (req.user.role === "admin") {
      next();
      return;
    }

    if (req.user.role === "student") {
      const targetParam = req.params[paramKey] || req.query[paramKey] || req.body[paramKey];
      // Target could be roll number (e.g. 2026CSE001) or internal students.id
      if (
        targetParam &&
        targetParam !== req.user.studentId &&
        targetParam !== String(req.studentDbId)
      ) {
        res.status(403).json({
          error: "Forbidden: You are not authorized to view or access another student's records.",
        });
        return;
      }
      next();
      return;
    }

    res.status(403).json({ error: "Forbidden: Insufficient privileges." });
  };
}

/**
 * forbidStaffFromFinancials:
 * Explicit security rule: Mess staff must never access sensitive financial information.
 */
export function forbidStaffFromFinancials(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.role === "staff") {
    res.status(403).json({
      error: "Forbidden: Mess staff are strictly prohibited from accessing financial records.",
    });
    return;
  }
  next();
}
