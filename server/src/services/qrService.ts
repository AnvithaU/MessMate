import crypto from "node:crypto";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

export function generateSecureQrToken(studentId: string): string {
  const randomHex = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `MM-QR-${studentId}-${randomHex}`;
}

export async function resolveStudentByQrToken(qrToken: string) {
  const result = await db
    .select({
      studentDbId: schema.students.id,
      studentId: schema.students.studentId,
      department: schema.students.department,
      semester: schema.students.semester,
      roomNumber: schema.students.roomNumber,
      phone: schema.students.phone,
      qrToken: schema.students.qrToken,
      qrStatus: schema.students.qrStatus,
      userId: schema.users.id,
      fullName: schema.users.fullName,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.students)
    .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
    .where(eq(schema.students.qrToken, qrToken))
    .limit(1)
    .get();

  return result || null;
}

export async function resolveStudentByRoll(studentId: string) {
  const result = await db
    .select({
      studentDbId: schema.students.id,
      studentId: schema.students.studentId,
      department: schema.students.department,
      semester: schema.students.semester,
      roomNumber: schema.students.roomNumber,
      phone: schema.students.phone,
      qrToken: schema.students.qrToken,
      qrStatus: schema.students.qrStatus,
      userId: schema.users.id,
      fullName: schema.users.fullName,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.students)
    .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
    .where(eq(schema.students.studentId, studentId))
    .limit(1)
    .get();

  return result || null;
}
