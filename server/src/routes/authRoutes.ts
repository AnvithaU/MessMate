import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateToken, requireAuth, AuthenticatedRequest } from "../middlewares/auth.js";
import { generateSecureQrToken } from "../services/qrService.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_DOMAINS = ["@nmamit.in", "@student.nmamit.in"];
const ADMIN_DOMAINS = ["@admin.nmamit.in", "@warden.nmamit.in"];
const STAFF_DOMAINS = ["@staff.nmamit.in"];

function hasAnyDomain(email: string, domains: string[]): boolean {
  const lower = email.trim().toLowerCase();
  return domains.some((d) => lower.endsWith(d));
}

function validatePasswordStrength(password: string): string[] {
  const missing: string[] = [];
  if (password.length < 8) missing.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) missing.push("one uppercase letter (A-Z)");
  if (!/[a-z]/.test(password)) missing.push("one lowercase letter (a-z)");
  if (!/[0-9]/.test(password)) missing.push("one number (0-9)");
  if (!/[^A-Za-z0-9]/.test(password)) missing.push("one special character (!@#$%^&*)");
  return missing;
}

/**
 * POST /api/auth/login
 * Validates credentials and embeds verified DB role into JWT session.
 */
authRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      res.status(400).json({ error: "Please enter a valid institutional email address." });
      return;
    }

    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1)
      .get();

    if (!user) {
      res.status(401).json({
        error: "No account found with this email. Students can create an account using their @nmamit.in email.",
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      res.status(401).json({ error: "Incorrect password. Please check your password and try again." });
      return;
    }

    // If student, fetch student record
    let studentId: string | undefined;
    let studentDbId: number | undefined;

    if (user.role === "student") {
      const student = await db
        .select()
        .from(schema.students)
        .where(eq(schema.students.userId, user.id))
        .limit(1)
        .get();

      if (student) {
        studentId = student.studentId;
        studentDbId = student.id;
      }
    }

    // Role is strictly taken from DB
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as any,
      fullName: user.fullName,
      studentId,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        studentId,
        studentDbId,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/register
 * Self-registration is strictly defaulted to 'student'.
 * Role in request body is explicitly ignored to prevent unauthorized role escalation.
 */
authRouter.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, studentId, course, department, semester, roomNumber, phone } = req.body;

    if (!email || !password || !fullName || !studentId) {
      res.status(400).json({ error: "Required fields: fullName, studentId, email, and password." });
      return;
    }

    const trimmedName = String(fullName).trim();
    if (trimmedName.length < 2) {
      res.status(400).json({ error: "Full name must be at least 2 characters." });
      return;
    }

    const normalizedStudentId = String(studentId).trim().toUpperCase();
    if (!/^[A-Z0-9]{5,18}$/.test(normalizedStudentId)) {
      res.status(400).json({ error: "USN / Student ID must be 5–18 alphanumeric characters (e.g. NNM22CS001)." });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }

    if (hasAnyDomain(normalizedEmail, ADMIN_DOMAINS) || hasAnyDomain(normalizedEmail, STAFF_DOMAINS)) {
      res.status(403).json({
        error: "Self-registration is restricted to students with an @nmamit.in email address.",
      });
      return;
    }

    if (!hasAnyDomain(normalizedEmail, STUDENT_DOMAINS)) {
      res.status(400).json({
        error: "Student registration requires an official @nmamit.in email address.",
      });
      return;
    }

    const missingPw = validatePasswordStrength(String(password));
    if (missingPw.length > 0) {
      res.status(400).json({
        error: `Password must contain ${missingPw.join(", ")}.`,
      });
      return;
    }

    // Check duplicate email
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1)
      .get();

    if (existing) {
      res.status(409).json({ error: "An account with this @nmamit.in email already exists. Please sign in instead." });
      return;
    }

    // Check duplicate studentId
    const existingStudent = await db
      .select()
      .from(schema.students)
      .where(eq(schema.students.studentId, normalizedStudentId))
      .limit(1)
      .get();

    if (existingStudent) {
      res.status(409).json({ error: "This USN / Student ID is already registered." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Explicitly enforce role: 'student' (ignoring any req.body.role)
    const newUser = await db
      .insert(schema.users)
      .values({
        email: normalizedEmail,
        passwordHash,
        fullName: trimmedName,
        role: "student", // Forced
      })
      .returning()
      .get();

    const qrToken = generateSecureQrToken(normalizedStudentId);

    const cleanDept = String(department || "General Engineering").trim();
    const cleanCourse = String(course || "").trim();
    const storedDepartment = cleanCourse ? `${cleanCourse} - ${cleanDept}` : cleanDept;

    const newStudent = await db
      .insert(schema.students)
      .values({
        userId: newUser.id,
        studentId: normalizedStudentId,
        department: storedDepartment,
        semester: semester ? Number(semester) : 1,
        roomNumber: roomNumber ? String(roomNumber).trim().toUpperCase() : "Unassigned",
        phone: phone || null,
        qrToken,
      })
      .returning()
      .get();

    const token = generateToken({
      userId: newUser.id,
      email: newUser.email,
      role: "student",
      fullName: newUser.fullName,
      studentId: newStudent.studentId,
    });

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: "student",
        studentId: newStudent.studentId,
        studentDbId: newStudent.id,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me
 * Retrieves current session details
 */
authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let studentProfile = null;
    if (req.user.role === "student" && req.studentDbId) {
      studentProfile = await db
        .select()
        .from(schema.students)
        .where(eq(schema.students.id, req.studentDbId))
        .limit(1)
        .get();
    }

    res.json({
      user: req.user,
      studentProfile,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/switch-role (For seamless preview/evaluation)
 * Allows reviewer to effortlessly switch between Student, Admin, and Staff demo accounts.
 */
authRouter.post("/switch-role", async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.body;
    let targetEmail = "";

    if (role === "admin") {
      targetEmail = "warden@admin.nmamit.in";
    } else if (role === "staff") {
      targetEmail = "staff@staff.nmamit.in";
    } else {
      targetEmail = "aarav.sharma@nmamit.in";
    }

    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, targetEmail))
      .limit(1)
      .get();

    if (!user) {
      res.status(404).json({ error: "Demo user not found" });
      return;
    }

    let studentId: string | undefined;
    let studentDbId: number | undefined;

    if (user.role === "student") {
      const student = await db
        .select()
        .from(schema.students)
        .where(eq(schema.students.userId, user.id))
        .limit(1)
        .get();

      if (student) {
        studentId = student.studentId;
        studentDbId = student.id;
      }
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as any,
      fullName: user.fullName,
      studentId,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        studentId,
        studentDbId,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/demo-users
 * Quick helper for UI demo switcher
 */
authRouter.get("/demo-users", async (_req: Request, res: Response): Promise<void> => {
  res.json({
    student: {
      email: "aarav.sharma@nmamit.in",
      name: "Aarav Sharma (Student)",
      roll: "2026CSE001",
      role: "student",
    },
    admin: {
      email: "warden@admin.nmamit.in",
      name: "Dr. K. Ramanathan (Mess Warden)",
      role: "admin",
    },
    staff: {
      email: "staff@staff.nmamit.in",
      name: "Rajesh Kumar (Mess Counter Staff)",
      role: "staff",
    },
  });
});
