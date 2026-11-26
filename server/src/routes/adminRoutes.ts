import { Router, Response } from "express";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, desc, like } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { selectMonthlyMess } from "../services/messService.js";
import {
  recordStudentAdvancePayment,
  getStudentFinancialSummary,
  executeFinalSettlement,
  setStudentProvisionalAdvance,
} from "../services/financialService.js";
import { generateSecureQrToken } from "../services/qrService.js";
import {
  getAllRebates,
  approveHostelRebate,
  rejectHostelRebate,
} from "../services/rebateService.js";

export const adminRouter = Router();

// Strictly protected for administrators only
adminRouter.use(requireAuth);
adminRouter.use(requireRole(["admin"]));

/**
 * GET /api/admin/overview
 * Real-time management analytics & KPIs
 */
adminRouter.get("/overview", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const currentMonthYear = now.toISOString().slice(0, 7);

    // 1. Total & Active Students
    const studentCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.students)
      .get();
    const totalStudents = studentCountRes ? Number(studentCountRes.count) : 0;

    // 2. South vs North Mess enrolments for current month
    const enrolments = await db
      .select({
        messCode: schema.messes.code,
        messName: schema.messes.name,
        count: sql<number>`count(${schema.monthlyMessSelections.id})`,
      })
      .from(schema.messes)
      .leftJoin(
        schema.monthlyMessSelections,
        and(
          eq(schema.monthlyMessSelections.messId, schema.messes.id),
          eq(schema.monthlyMessSelections.monthYear, currentMonthYear)
        )
      )
      .groupBy(schema.messes.code, schema.messes.name)
      .all();

    const southCount = Number(enrolments.find((e) => e.messCode === "SOUTH")?.count || 0);
    const northCount = Number(enrolments.find((e) => e.messCode === "NORTH")?.count || 0);

    // 3. Add-on Bookings count
    const addonRes = await db
      .select({
        addonName: schema.addons.name,
        code: schema.addons.code,
        count: sql<number>`count(${schema.addonSelections.id})`,
      })
      .from(schema.addons)
      .leftJoin(
        schema.addonSelections,
        and(
          eq(schema.addonSelections.addonId, schema.addons.id),
          eq(schema.addonSelections.status, "CONFIRMED")
        )
      )
      .groupBy(schema.addons.name, schema.addons.code)
      .all();

    // 4. Coupons & Entitlements stats
    const totalEntitlementsRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.entitlements)
      .get();
    const totalCoupons = totalEntitlementsRes ? Number(totalEntitlementsRes.count) : 0;

    const redeemedCouponsRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.entitlements)
      .where(eq(schema.entitlements.status, "REDEEMED"))
      .get();
    const redeemedCoupons = redeemedCouponsRes ? Number(redeemedCouponsRes.count) : 0;

    // 5. Financials aggregated
    const paymentsRes = await db
      .select({ total: sql<number>`sum(amount)` })
      .from(schema.payments)
      .get();
    const totalAdvanceCollected = paymentsRes?.total ? Number(paymentsRes.total) : 0;

    const messChargesRes = await db
      .select({ total: sql<number>`sum(fee_charged)` })
      .from(schema.monthlyMessSelections)
      .get();
    const totalMessCharges = messChargesRes?.total ? Number(messChargesRes.total) : 0;

    const addonChargesRes = await db
      .select({ total: sql<number>`sum(unit_price)` })
      .from(schema.addonSelections)
      .where(eq(schema.addonSelections.status, "CONFIRMED"))
      .get();
    const totalAddonCharges = addonChargesRes?.total ? Number(addonChargesRes.total) : 0;

    const totalCharges = totalMessCharges + totalAddonCharges;
    const netFloat = totalAdvanceCollected - totalCharges;

    res.json({
      currentMonthYear,
      metrics: {
        totalStudents,
        activeStudents: totalStudents,
        southEnrolments: southCount,
        northEnrolments: northCount,
        totalCouponsIssued: totalCoupons,
        totalCouponsRedeemed: redeemedCoupons,
        redemptionRate: totalCoupons > 0 ? Math.round((redeemedCoupons / totalCoupons) * 100) : 0,
        totalAdvanceCollected,
        totalChargesBilled: totalCharges,
        advanceSurplus: Math.max(0, netFloat),
        outstandingBalances: Math.max(0, -netFloat),
      },
      distribution: {
        south: southCount,
        north: northCount,
        unselected: Math.max(0, totalStudents - (southCount + northCount)),
      },
      addonsDemand: addonRes.map((a) => ({
        name: a.addonName,
        code: a.code,
        count: Number(a.count),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/students
 * Search, filter, and paginate students
 */
adminRouter.get("/students", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string) || "";
    const department = req.query.department as string;
    const currentMonthYear = new Date().toISOString().slice(0, 7);

    let baseQuery = db
      .select({
        id: schema.students.id,
        studentId: schema.students.studentId,
        department: schema.students.department,
        semester: schema.students.semester,
        roomNumber: schema.students.roomNumber,
        phone: schema.students.phone,
        qrToken: schema.students.qrToken,
        qrStatus: schema.students.qrStatus,
        fullName: schema.users.fullName,
        email: schema.users.email,
        messName: schema.messes.name,
        messCode: schema.messes.code,
      })
      .from(schema.students)
      .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
      .leftJoin(
        schema.monthlyMessSelections,
        and(
          eq(schema.monthlyMessSelections.studentId, schema.students.id),
          eq(schema.monthlyMessSelections.monthYear, currentMonthYear)
        )
      )
      .leftJoin(schema.messes, eq(schema.monthlyMessSelections.messId, schema.messes.id));

    const allStudents = await baseQuery.all();

    let filtered = allStudents;
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (st) =>
          st.fullName.toLowerCase().includes(s) ||
          st.studentId.toLowerCase().includes(s) ||
          st.email.toLowerCase().includes(s) ||
          st.roomNumber.toLowerCase().includes(s)
      );
    }

    if (department && department !== "ALL") {
      filtered = filtered.filter((st) => st.department === department);
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/students/:id/profile
 * Deep inspection of student profile, financial ledger, selections, and redemptions
 */
adminRouter.get("/students/:id/profile", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentDbId = Number(req.params.id);

    const student = await db
      .select({
        id: schema.students.id,
        studentId: schema.students.studentId,
        department: schema.students.department,
        semester: schema.students.semester,
        roomNumber: schema.students.roomNumber,
        phone: schema.students.phone,
        qrToken: schema.students.qrToken,
        qrStatus: schema.students.qrStatus,
        fullName: schema.users.fullName,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
        userId: schema.users.id,
      })
      .from(schema.students)
      .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
      .where(eq(schema.students.id, studentDbId))
      .limit(1)
      .get();

    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const financials = await getStudentFinancialSummary(studentDbId);

    // Selections
    const messSelections = await db
      .select({
        id: schema.monthlyMessSelections.id,
        monthYear: schema.monthlyMessSelections.monthYear,
        feeCharged: schema.monthlyMessSelections.feeCharged,
        selectedAt: schema.monthlyMessSelections.selectedAt,
        messName: schema.messes.name,
        overrideReason: schema.monthlyMessSelections.overrideReason,
      })
      .from(schema.monthlyMessSelections)
      .innerJoin(schema.messes, eq(schema.monthlyMessSelections.messId, schema.messes.id))
      .where(eq(schema.monthlyMessSelections.studentId, studentDbId))
      .orderBy(desc(schema.monthlyMessSelections.monthYear))
      .all();

    // Redemptions
    const redemptions = await db
      .select({
        id: schema.redemptionRecords.id,
        scannedAt: schema.redemptionRecords.scannedAt,
        itemName: schema.entitlements.itemName,
        mealSlot: schema.entitlements.mealSlot,
        applicableDate: schema.entitlements.applicableDate,
        staffName: schema.users.fullName,
      })
      .from(schema.redemptionRecords)
      .innerJoin(schema.entitlements, eq(schema.redemptionRecords.entitlementId, schema.entitlements.id))
      .leftJoin(schema.users, eq(schema.redemptionRecords.staffUserId, schema.users.id))
      .where(eq(schema.redemptionRecords.studentId, studentDbId))
      .orderBy(desc(schema.redemptionRecords.scannedAt))
      .limit(30)
      .all();

    res.json({
      student,
      financials,
      messSelections,
      redemptions,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/students/register
 * Admin registration of new student
 */
adminRouter.post("/students/register", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, fullName, studentId, department, semester, roomNumber, phone, initialAdvance } = req.body;

    if (!email || !fullName || !studentId) {
      res.status(400).json({ error: "Email, Full Name, and Student ID are required" });
      return;
    }

    const passwordHash = await bcrypt.hash("password123", 10);
    const user = await db
      .insert(schema.users)
      .values({
        email: email.trim().toLowerCase(),
        passwordHash,
        fullName: fullName.trim(),
        role: "student",
      })
      .returning()
      .get();

    const qrToken = generateSecureQrToken(studentId.trim().toUpperCase());

    const student = await db
      .insert(schema.students)
      .values({
        userId: user.id,
        studentId: studentId.trim().toUpperCase(),
        department: department || "Computer Science",
        semester: semester ? Number(semester) : 1,
        roomNumber: roomNumber || "Unassigned",
        phone: phone || null,
        qrToken,
      })
      .returning()
      .get();

    // Record initial advance if provided
    if (initialAdvance && Number(initialAdvance) > 0) {
      const activeSem = await db
        .select()
        .from(schema.semesters)
        .where(eq(schema.semesters.isCurrent, 1))
        .limit(1)
        .get();

      if (activeSem) {
        await recordStudentAdvancePayment({
          studentDbId: student.id,
          semesterId: activeSem.id,
          amount: Number(initialAdvance),
          paymentMode: "ONLINE",
          paymentType: Number(initialAdvance) >= 50000 ? "TWO_SEMESTERS" : "ONE_SEMESTER",
          recordedByUserId: req.user!.userId,
        });
      }
    }

    res.status(201).json({ success: true, student });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/students/bulk-import
 * Bulk import students via array
 */
adminRouter.post("/students/bulk-import", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentsList } = req.body;
    if (!studentsList || !Array.isArray(studentsList)) {
      res.status(400).json({ error: "studentsList array required" });
      return;
    }

    const passwordHash = await bcrypt.hash("password123", 10);
    let imported = 0;

    for (const item of studentsList) {
      if (!item.studentId || !item.email || !item.fullName) continue;

      const existing = await db
        .select()
        .from(schema.students)
        .where(eq(schema.students.studentId, item.studentId.trim().toUpperCase()))
        .limit(1)
        .get();

      if (existing) continue;

      const user = await db
        .insert(schema.users)
        .values({
          email: item.email.trim().toLowerCase(),
          passwordHash,
          fullName: item.fullName.trim(),
          role: "student",
        })
        .returning()
        .get();

      const qrToken = generateSecureQrToken(item.studentId.trim().toUpperCase());

      await db.insert(schema.students).values({
        userId: user.id,
        studentId: item.studentId.trim().toUpperCase(),
        department: item.department || "Engineering",
        semester: item.semester ? Number(item.semester) : 1,
        roomNumber: item.roomNumber || "Hostel",
        phone: item.phone || null,
        qrToken,
      });

      imported++;
    }

    res.json({ success: true, importedCount: imported });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/mess-override
 * Admin override of a student's monthly mess selection with audit log
 */
adminRouter.post("/mess-override", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentDbId, monthYear, messId, overrideReason } = req.body;

    if (!studentDbId || !monthYear || !messId || !overrideReason) {
      res.status(400).json({
        error: "studentDbId, monthYear, messId, and overrideReason are required",
      });
      return;
    }

    const result = await selectMonthlyMess({
      studentDbId: Number(studentDbId),
      monthYear,
      messId: Number(messId),
      adminUserId: req.user!.userId,
      overrideReason,
    });

    res.json({ success: true, message: "Mess override recorded with audit entry", result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/admin/messes
 * Manage messes & pricing
 */
adminRouter.get("/messes", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const list = await db.select().from(schema.messes).all();
    const windows = await db.select().from(schema.monthlyMessWindows).all();
    res.json({ messes: list, windows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/admin/messes/:id
 * Update mess configuration
 */
adminRouter.put("/messes/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const messId = Number(req.params.id);
    const { name, monthlyFee, description, isActive } = req.body;

    await db
      .update(schema.messes)
      .set({
        name,
        monthlyFee: Number(monthlyFee),
        description,
        isActive: isActive ? 1 : 0,
      })
      .where(eq(schema.messes.id, messId))
      .run();

    res.json({ success: true, message: "Mess configuration updated" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/addons
 * Manage addon pricing, weekdays, and availability
 */
adminRouter.get("/addons", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const list = await db.select().from(schema.addons).all();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/admin/addons/:id
 * Update addon rules
 */
adminRouter.put("/addons/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const addonId = Number(req.params.id);
    const { unitPrice, availableDaysOfWeek, mealSlot, maxDailyCapacity, isActive } = req.body;

    await db
      .update(schema.addons)
      .set({
        unitPrice: Number(unitPrice),
        availableDaysOfWeek,
        mealSlot,
        maxDailyCapacity: Number(maxDailyCapacity),
        isActive: isActive ? 1 : 0,
      })
      .where(eq(schema.addons.id, addonId))
      .run();

    res.json({ success: true, message: "Add-on updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/coupons
 * Global coupons and entitlements table
 */
adminRouter.get("/coupons", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string;
    const date = req.query.date as string;

    const list = await db
      .select({
        id: schema.entitlements.id,
        studentId: schema.students.studentId,
        studentName: schema.users.fullName,
        department: schema.students.department,
        entitlementType: schema.entitlements.entitlementType,
        itemName: schema.entitlements.itemName,
        applicableDate: schema.entitlements.applicableDate,
        mealSlot: schema.entitlements.mealSlot,
        status: schema.entitlements.status,
        createdAt: schema.entitlements.createdAt,
        scannedAt: schema.redemptionRecords.scannedAt,
        staffName: schema.users.fullName,
      })
      .from(schema.entitlements)
      .innerJoin(schema.students, eq(schema.entitlements.studentId, schema.students.id))
      .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
      .leftJoin(
        schema.redemptionRecords,
        eq(schema.entitlements.id, schema.redemptionRecords.entitlementId)
      )
      .orderBy(desc(schema.entitlements.id))
      .limit(100)
      .all();

    let filtered = list;
    if (status && status !== "ALL") {
      filtered = filtered.filter((c) => c.status === status);
    }
    if (date) {
      filtered = filtered.filter((c) => c.applicableDate === date);
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/payments
 * Record advance payment for a student
 */
adminRouter.post("/payments", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentDbId, semesterId, amount, paymentMode, paymentType } = req.body;

    const payment = await recordStudentAdvancePayment({
      studentDbId: Number(studentDbId),
      semesterId: Number(semesterId),
      amount: Number(amount),
      paymentMode,
      paymentType,
      recordedByUserId: req.user!.userId,
    });

    res.status(201).json({ success: true, payment });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/admin/ledger
 * Global financial ledger entries
 */
adminRouter.get("/ledger", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const entries = await db
      .select({
        id: schema.financialLedger.id,
        studentId: schema.students.studentId,
        studentName: schema.users.fullName,
        transactionType: schema.financialLedger.transactionType,
        amount: schema.financialLedger.amount,
        balanceAfter: schema.financialLedger.balanceAfter,
        referenceId: schema.financialLedger.referenceId,
        adjustmentReason: schema.financialLedger.adjustmentReason,
        createdAt: schema.financialLedger.createdAt,
      })
      .from(schema.financialLedger)
      .innerJoin(schema.students, eq(schema.financialLedger.studentId, schema.students.id))
      .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
      .orderBy(desc(schema.financialLedger.id))
      .limit(100)
      .all();

    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/settlement
 * Execute final semester settlement with automatic refund / outstanding calculation
 */
adminRouter.post("/settlement", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentDbId, semesterId, refundPaymentReference, remarks } = req.body;

    if (!studentDbId || !semesterId) {
      res.status(400).json({ error: "studentDbId and semesterId are required" });
      return;
    }

    const settlement = await executeFinalSettlement({
      studentDbId: Number(studentDbId),
      semesterId: Number(semesterId),
      settledByUserId: req.user!.userId,
      refundPaymentReference,
      remarks,
    });

    res.json({ success: true, settlement });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/admin/audit-logs
 * System audit history
 */
adminRouter.get("/audit-logs", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const logs = await db
      .select({
        id: schema.auditLogs.id,
        action: schema.auditLogs.action,
        entityType: schema.auditLogs.entityType,
        entityId: schema.auditLogs.entityId,
        oldState: schema.auditLogs.oldState,
        newState: schema.auditLogs.newState,
        createdAt: schema.auditLogs.createdAt,
        adminName: schema.users.fullName,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
      .orderBy(desc(schema.auditLogs.id))
      .limit(50)
      .all();

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/rebates
 * View all hostel leave rebate requests across all students
 */
adminRouter.get("/rebates", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rebates = await getAllRebates();
    res.json(rebates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/rebates/:id/approve
 * Warden approves a pending hostel leave rebate and credits ledger
 */
adminRouter.post("/rebates/:id/approve", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rebateId = Number(req.params.id);
    const { wardenNotes } = req.body || {};
    const updated = await approveHostelRebate({
      rebateId,
      adminUserId: req.user!.userId,
      wardenNotes,
    });
    res.json({ success: true, rebate: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/admin/rebates/:id/reject
 * Warden rejects a pending hostel leave rebate
 */
adminRouter.post("/rebates/:id/reject", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rebateId = Number(req.params.id);
    const { wardenNotes } = req.body || {};
    const updated = await rejectHostelRebate({
      rebateId,
      adminUserId: req.user!.userId,
      wardenNotes,
    });
    res.json({ success: true, rebate: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/admin/semester-advances
 * Configure or update a student's provisional advance allocation (default ₹25,000)
 */
adminRouter.post("/semester-advances", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentDbId, semesterLabel, allocatedAmount, notes } = req.body;
    if (!studentDbId || allocatedAmount === undefined) {
      res.status(400).json({ error: "studentDbId and allocatedAmount are required" });
      return;
    }
    const record = await setStudentProvisionalAdvance({
      studentDbId: Number(studentDbId),
      semesterLabel: semesterLabel || "current",
      allocatedAmount: Number(allocatedAmount),
      notes,
      adminUserId: req.user!.userId,
    });
    res.status(201).json({ success: true, record });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
