import { Router, Response } from "express";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { isDateAllowedForAddon } from "../services/addonService.js";
import {
  getMesses,
  getActiveWindow,
  getStudentMessSelection,
  selectMonthlyMess,
} from "../services/messService.js";
import {
  getAddons,
  getStudentAddonSelections,
  bookStudentAddons,
} from "../services/addonService.js";
import { getStudentTodayEntitlements } from "../services/redemptionService.js";
import { getStudentFinancialSummary } from "../services/financialService.js";
import {
  calculateRebate,
  submitHostelRebate,
  getStudentRebates,
} from "../services/rebateService.js";
import { submitUnifiedMonthlyEnrolment } from "../services/monthlyEnrolmentService.js";
import { checkSelectionWindow } from "../services/selectionWindowService.js";

export const studentRouter = Router();

// Apply auth & student role middleware to all student routes
studentRouter.use(requireAuth);
studentRouter.use(requireRole(["student"]));

/**
 * GET /api/student/dashboard
 * Aggregates personalized student overview
 */
studentRouter.get("/dashboard", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentDbId = req.studentDbId!;
    const now = new Date();
    const currentMonthYear = now.toISOString().slice(0, 7);

    // 1. Student Profile
    const student = await db
      .select({
        id: schema.students.id,
        studentId: schema.students.studentId,
        department: schema.students.department,
        semester: schema.students.semester,
        roomNumber: schema.students.roomNumber,
        phone: schema.students.phone,
        qrToken: schema.students.qrToken,
        fullName: schema.users.fullName,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.students)
      .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
      .where(eq(schema.students.id, studentDbId))
      .limit(1)
      .get();

    // 2. Current Mess Selection (this calendar month)
    const currentMess = await getStudentMessSelection(studentDbId, currentMonthYear);

    // 2b. Upcoming month mess selection (next calendar month — shown if current month has no selection)
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthYear = nextMonthDate.toISOString().slice(0, 7);
    const upcomingMess = currentMess ? null : await getStudentMessSelection(studentDbId, nextMonthYear);

    // 3. Today's Entitlements
    const todayEntitlements = await getStudentTodayEntitlements(studentDbId);

    // 4. Financial Summary
    const financials = await getStudentFinancialSummary(studentDbId);

    // 5. Active Selection Window
    const activeWindow = await getActiveWindow(currentMonthYear);

    res.json({
      student,
      currentMonthYear,
      currentMess: currentMess ?? upcomingMess, // show upcoming if current month not enrolled
      upcomingMess: upcomingMess,
      todayEntitlements,
      financials: {
        provisionalAdvance: financials.provisionalAdvance,
        hasVerifiedDeposits: financials.hasVerifiedDeposits,
        totalAdvancePaid: financials.totalAdvancePaid,
        totalCharges: financials.totalCharges,
        totalRefunds: financials.totalRefunds,
        availableBalance: financials.availableBalance,
        outstandingAmount: financials.outstandingAmount,
        netBalance: financials.netBalance,
        isSettled: financials.isSettled,
      },
      activeWindow,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/student/messes
 * Returns all active messes for enrolment
 */
studentRouter.get("/messes", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const availableMesses = await getMesses();
    res.json(availableMesses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/student/mess-selection
 * View South Mess vs North Mess options & active windows
 */
studentRouter.get("/mess-selection", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentDbId = req.studentDbId!;
    const monthYear = (req.query.monthYear as string) || new Date().toISOString().slice(0, 7);

    const availableMesses = await getMesses();
    const window = await getActiveWindow(monthYear);
    const currentSelection = await getStudentMessSelection(studentDbId, monthYear);

    res.json({
      monthYear,
      window,
      availableMesses,
      currentSelection,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/student/mess-selection
 * Select South or North Mess
 */
studentRouter.post("/mess-selection", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentDbId = req.studentDbId!;
    const { monthYear, messId } = req.body;

    if (!monthYear || !messId) {
      res.status(400).json({ error: "monthYear and messId are required" });
      return;
    }

    const updated = await selectMonthlyMess({
      studentDbId,
      monthYear,
      messId: Number(messId),
    });

    res.json({
      success: true,
      message: `Successfully selected mess for ${monthYear}`,
      selection: updated,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/student/addons
 * Add-on availability rules and student's booked add-ons
 */
studentRouter.get("/addons", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentDbId = req.studentDbId!;
    const monthYear = (req.query.monthYear as string) || new Date().toISOString().slice(0, 7);

    const allAddons = await getAddons();
    const userSelections = await getStudentAddonSelections(studentDbId, monthYear);

    // Provide simplified array directly or with metadata for broad compatibility
    const responsePayload = allAddons.map((a) => ({
      ...a,
      pricePerDay: a.unitPrice,
      monthlyPrice: a.code === "ICE_CREAM" ? 250 : null,
    }));

    res.json(responsePayload);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/student/addons/book
 * Book add-ons for specific calendar dates
 */
studentRouter.post("/addons/book", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentDbId = req.studentDbId!;
    const { bookings } = req.body;

    if (!bookings || !Array.isArray(bookings) || bookings.length === 0) {
      res.status(400).json({ error: "Bookings array is required" });
      return;
    }

    const result = await bookStudentAddons({
      studentDbId,
      bookings,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/student/wallet
 * Universal QR code identity and entitlement deck
 */
studentRouter.get("/wallet", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentDbId = req.studentDbId!;

    const student = await db
      .select({
        id: schema.students.id,
        studentId: schema.students.studentId,
        department: schema.students.department,
        semester: schema.students.semester,
        roomNumber: schema.students.roomNumber,
        qrToken: schema.students.qrToken,
        qrStatus: schema.students.qrStatus,
        fullName: schema.users.fullName,
      })
      .from(schema.students)
      .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
      .where(eq(schema.students.id, studentDbId))
      .limit(1)
      .get();

    const todayEntitlements = await getStudentTodayEntitlements(studentDbId);

    // Fetch upcoming add-on entitlements
    const upcoming = await db
      .select()
      .from(schema.entitlements)
      .where(
        and(
          eq(schema.entitlements.studentId, studentDbId),
          sql`applicable_date >= DATE('now')`
        )
      )
      .orderBy(sql`applicable_date ASC, meal_slot ASC`)
      .limit(20)
      .all();

    // Fetch upcoming month's confirmed enrolment summary (e.g., Dec 2026 during Nov 25-30)
    const windowStatus = checkSelectionWindow();
    const targetMonthYear = windowStatus.targetMonthYear;
    const upcomingMessSelection = await getStudentMessSelection(studentDbId, targetMonthYear);
    const upcomingAddonRows = await getStudentAddonSelections(studentDbId, targetMonthYear);
    const allAddons = await getAddons();
    const addonById = new Map(allAddons.map((a) => [a.id, a]));

    const addonSummaryMap = new Map<number, { addonId: number; name: string; mealSlot: string; schedule: string; servingsCount: number }>();
    for (const row of upcomingAddonRows) {
      if (row.status !== "CONFIRMED") continue;
      const meta = addonById.get(row.addonId);
      if (!meta) continue;
      const existing = addonSummaryMap.get(row.addonId);
      if (existing) {
        existing.servingsCount += 1;
      } else {
        addonSummaryMap.set(row.addonId, {
          addonId: row.addonId,
          name: meta.name.split("(")[0].trim(),
          mealSlot: meta.mealSlot,
          schedule: meta.availableDaysOfWeek,
          servingsCount: 1,
        });
      }
    }

    res.json({
      universalQr: {
        token: student?.qrToken,
        studentId: student?.studentId,
        fullName: student?.fullName,
        department: student?.department,
        roomNumber: student?.roomNumber,
        status: student?.qrStatus,
      },
      today: todayEntitlements,
      upcoming,
      upcomingEnrolment: {
        monthYear: targetMonthYear,
        messSelection: upcomingMessSelection,
        bookedAddons: Array.from(addonSummaryMap.values()),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/student/financials
 * Complete advance balance, charges breakdown, and immutable ledger
 */
studentRouter.get("/financials", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentDbId = req.studentDbId!;
    const summary = await getStudentFinancialSummary(studentDbId);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/student/history
 * Comprehensive history of selections and redemptions
 */
studentRouter.get("/history", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentDbId = req.studentDbId!;

    // Mess selections history
    const messHistory = await db
      .select({
        id: schema.monthlyMessSelections.id,
        monthYear: schema.monthlyMessSelections.monthYear,
        feeCharged: schema.monthlyMessSelections.feeCharged,
        selectedAt: schema.monthlyMessSelections.selectedAt,
        messName: schema.messes.name,
      })
      .from(schema.monthlyMessSelections)
      .innerJoin(schema.messes, eq(schema.monthlyMessSelections.messId, schema.messes.id))
      .where(eq(schema.monthlyMessSelections.studentId, studentDbId))
      .orderBy(sql`month_year DESC`)
      .all();

    // Redemptions history
    const redemptionHistory = await db
      .select({
        id: schema.redemptionRecords.id,
        scannedAt: schema.redemptionRecords.scannedAt,
        scanMethod: schema.redemptionRecords.scanMethod,
        itemName: schema.entitlements.itemName,
        mealSlot: schema.entitlements.mealSlot,
        applicableDate: schema.entitlements.applicableDate,
        staffName: schema.users.fullName,
      })
      .from(schema.redemptionRecords)
      .innerJoin(schema.entitlements, eq(schema.redemptionRecords.entitlementId, schema.entitlements.id))
      .leftJoin(schema.users, eq(schema.redemptionRecords.staffUserId, schema.users.id))
      .where(eq(schema.redemptionRecords.studentId, studentDbId))
      .orderBy(sql`scanned_at DESC`)
      .limit(50)
      .all();

    res.json({
      messHistory,
      redemptionHistory,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/student/calendar
 * Returns every calendar day for a given month with per-addon entitlement and redemption status.
 * This is the single source of truth for the student calendar view.
 */
studentRouter.get("/calendar", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentDbId = req.studentDbId!;

    // Determine which month to build (default: current month in Kolkata time)
    let monthYear = (req.query.monthYear as string) || "";
    if (!monthYear) {
      const kolkataDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
      }).format(new Date());
      monthYear = kolkataDate.slice(0, 7);
    }

    const [year, month] = monthYear.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Load all active add-ons
    const allAddons = await db.select().from(schema.addons).where(eq(schema.addons.isActive, 1)).all();

    // Load student's confirmed add-on selections for this month
    const addonSelectionRows = await db
      .select()
      .from(schema.addonSelections)
      .where(eq(schema.addonSelections.studentId, studentDbId))
      .all();
    const monthSelections = addonSelectionRows.filter((s) =>
      s.specificDate.startsWith(monthYear)
    );

    // Which addon IDs are opted-in for this month (at least one date booked)
    const optedInAddonIds = new Set(monthSelections.map((s) => s.addonId));

    // Load all entitlement rows for this month (with redemption join)
    const entitlementRows = await db
      .select({
        id: schema.entitlements.id,
        entitlementType: schema.entitlements.entitlementType,
        itemName: schema.entitlements.itemName,
        applicableDate: schema.entitlements.applicableDate,
        mealSlot: schema.entitlements.mealSlot,
        status: schema.entitlements.status,
        referenceId: schema.entitlements.referenceId,
        redeemedAt: schema.redemptionRecords.scannedAt,
      })
      .from(schema.entitlements)
      .leftJoin(schema.redemptionRecords, eq(schema.entitlements.id, schema.redemptionRecords.entitlementId))
      .where(
        and(
          eq(schema.entitlements.studentId, studentDbId),
          sql`applicable_date LIKE ${monthYear + "-%"}`
        )
      )
      .all();

    // Load mess selection for this month
    const messSelection = await getStudentMessSelection(studentDbId, monthYear);

    // Build the calendar day array
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, "0");
      const monthStr = String(month).padStart(2, "0");
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const dateObj = new Date(dateStr + "T00:00:00Z");
      const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateObj.getUTCDay()];
      const weekdayFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dateObj.getUTCDay()];

      // Per-addon entitlement for this date
      const addonsForDay = allAddons.map((addon) => {
        // Check if student opted in for this addon this month
        const isOptedIn = optedInAddonIds.has(addon.id);

        // Check if this specific date is in addon schedule
        const isScheduledToday = isDateAllowedForAddon(dateStr, addon.availableDaysOfWeek);

        // Find entitlement record
        const cleanName = addon.name.split("(")[0].trim();
        const ent = entitlementRows.find(
          (e) =>
            e.entitlementType === "ADDON" &&
            e.applicableDate === dateStr &&
            (e.itemName === cleanName || e.itemName.toLowerCase().includes(addon.code.toLowerCase()))
        );

        let status: string;
        let entitlementId: number | null = null;

        if (ent) {
          entitlementId = ent.id;
          status = ent.status; // AVAILABLE | REDEEMED | EXPIRED | CANCELLED
        } else if (!isOptedIn) {
          status = "NOT_SELECTED";
        } else if (!isScheduledToday) {
          status = "NOT_SCHEDULED";
        } else {
          status = "PENDING"; // opted in, scheduled, but entitlement not yet created
        }

        return {
          addonId: addon.id,
          code: addon.code,
          name: cleanName,
          fullName: addon.name,
          mealSlot: addon.mealSlot,
          unitPrice: addon.unitPrice,
          schedule: addon.availableDaysOfWeek,
          isOptedIn,
          isScheduledToday,
          entitlementId,
          status,
          redeemedAt: ent?.redeemedAt || null,
        };
      });

      // Find mess entitlement
      const messEnt = entitlementRows.find(
        (e) => e.entitlementType === "MESS_MEAL" && e.applicableDate === dateStr
      );
      const messStatus = messEnt?.status || (messSelection ? "AVAILABLE" : "NOT_SELECTED");

      days.push({
        date: dateStr,
        dayOfMonth: d,
        weekday,
        weekdayFull,
        isToday: dateStr === new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
        messName: messSelection?.messName || null,
        messStatus: messEnt?.id ? messStatus : (messSelection ? "AVAILABLE" : "NOT_SELECTED"),
        messEntitlementId: messEnt?.id || null,
        addons: addonsForDay,
        hasAnyEntitlement: addonsForDay.some((a) => a.isOptedIn && a.isScheduledToday) || !!messSelection,
        redeemedCount: addonsForDay.filter((a) => a.status === "REDEEMED").length + (messEnt?.status === "REDEEMED" ? 1 : 0),
        availableCount: addonsForDay.filter((a) => a.status === "AVAILABLE" || a.status === "PENDING").length + (messStatus === "AVAILABLE" ? 1 : 0),
      });
    }

    res.json({
      monthYear,
      year,
      month,
      daysInMonth,
      messSelection: messSelection || null,
      optedInAddonIds: Array.from(optedInAddonIds),
      allAddons,
      days,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/student/selection-window
 * Returns real-time status of 25th-to-end-of-month window (Asia/Kolkata timezone)
 */
studentRouter.get("/selection-window", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentDbId = req.studentDbId!;
    const simulatedDate = req.query.date ? String(req.query.date) : undefined;
    const windowStatus = checkSelectionWindow(simulatedDate);

    // Fetch existing selection for target upcoming month if already made
    const existingTargetSelection = await getStudentMessSelection(
      studentDbId,
      windowStatus.targetMonthYear
    );
    const existingAddonSelections = await getStudentAddonSelections(
      studentDbId,
      windowStatus.targetMonthYear
    );
    const allAddons = await getAddons();
    const addonById = new Map(allAddons.map((a) => [a.id, a]));
    const addonSummaryMap = new Map<number, { addonId: number; name: string; mealSlot: string; servingsCount: number }>();
    for (const row of existingAddonSelections) {
      if (row.status !== "CONFIRMED") continue;
      const meta = addonById.get(row.addonId);
      if (!meta) continue;
      const existing = addonSummaryMap.get(row.addonId);
      if (existing) {
        existing.servingsCount += 1;
      } else {
        addonSummaryMap.set(row.addonId, {
          addonId: row.addonId,
          name: meta.name.split("(")[0].trim(),
          mealSlot: meta.mealSlot,
          servingsCount: 1,
        });
      }
    }

    res.json({
      ...windowStatus,
      existingSelection: existingTargetSelection,
      existingAddonsCount: existingAddonSelections.length,
      existingAddons: Array.from(addonSummaryMap.values()),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/student/enrolment
 * Unified end-of-month enrolment: mess selection + monthly add-ons in one atomic call
 */
studentRouter.post("/enrolment", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const student = await db
      .select({ id: schema.students.id })
      .from(schema.students)
      .where(eq(schema.students.userId, userId))
      .get();
    if (!student) { res.status(404).json({ error: "Student record not found" }); return; }

    const { monthYear, messId, addonIds, simulatedDate } = req.body;
    if (!monthYear || !messId) {
      res.status(400).json({ error: "monthYear and messId are required" });
      return;
    }

    const result = await submitUnifiedMonthlyEnrolment({
      studentDbId: student.id,
      monthYear,
      messId: Number(messId),
      addonPlans: Array.isArray(addonIds)
        ? addonIds.map((addonId: unknown) => ({ addonId: Number(addonId), optIn: true }))
        : [],
      simulatedDate,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/student/rebates
 * List all rebate requests submitted by the authenticated student
 */
studentRouter.get("/rebates", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const student = await db
      .select({ id: schema.students.id })
      .from(schema.students)
      .where(eq(schema.students.userId, userId))
      .get();
    if (!student) { res.status(404).json({ error: "Student record not found" }); return; }

    const rebates = await getStudentRebates(student.id);
    res.json(rebates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/student/rebate/calculate
 * Preview rebate amount without committing
 */
studentRouter.post("/rebate/calculate", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const student = await db
      .select({ id: schema.students.id })
      .from(schema.students)
      .where(eq(schema.students.userId, userId))
      .get();
    if (!student) { res.status(404).json({ error: "Student record not found" }); return; }

    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      res.status(400).json({ error: "startDate and endDate are required (YYYY-MM-DD)" });
      return;
    }

    const result = await calculateRebate({ studentDbId: student.id, startDate, endDate });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/student/rebate/submit
 * Submit hostel leave rebate request and credit the wallet
 */
studentRouter.post("/rebate/submit", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const student = await db
      .select({ id: schema.students.id })
      .from(schema.students)
      .where(eq(schema.students.userId, userId))
      .get();
    if (!student) { res.status(404).json({ error: "Student record not found" }); return; }

    const { startDate, endDate, reason } = req.body;
    if (!startDate || !endDate) {
      res.status(400).json({ error: "startDate and endDate are required (YYYY-MM-DD)" });
      return;
    }

    const result = await submitHostelRebate({ studentDbId: student.id, startDate, endDate, reason });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
