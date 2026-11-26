import { z } from "zod";

/**
 * Centralized Role Definition (aligned with EzeVisas architecture)
 * Roles are strictly defined in the database and enforced on every protected route.
 */
export const USER_ROLES = ["student", "admin", "staff"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const userRoleSchema = z.enum(USER_ROLES);

export interface TokenPayload {
  userId: number;
  email: string;
  role: UserRole;
  studentId?: string;
  fullName: string;
}

export function isValidRole(role: unknown): role is UserRole {
  return typeof role === "string" && (USER_ROLES as readonly string[]).includes(role);
}
