import { Router, Response } from "express";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth.js";
import { resolveStudentByQrToken, resolveStudentByRoll } from "../services/qrService.js";
import {
  getStudentTodayEntitlements,
  redeemBatchEntitlements,
  getStaffScanHistory,
} from "../services/redemptionService.js";
import { checkSelectionWindow } from "../services/selectionWindowService.js";
import { getStudentMessSelection } from "../services/messService.js";
import { getAddons, getStudentAddonSelections } from "../services/addonService.js";
import { client } from "../db/index.js";

export const scannerRouter = Router();

// Mess Staff and Admins have access to the scanner
scannerRouter.use(requireAuth);
scannerRouter.use(requireRole(["staff", "admin"]));

/**
 * GET /api/scanner/lookup
 * Scans student via QR token or manual roll number lookup
 */
scannerRouter.get("/lookup", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { qrToken, studentId } = req.query;

    if (!qrToken && !studentId) {
      res.status(400).json({ error: "Either qrToken or studentId is required for lookup" });
      return;
    }

    let student = null;
    if (qrToken) {
      student = await resolveStudentByQrToken(String(qrToken).trim());
    } else if (studentId) {
      student = await resolveStudentByRoll(String(studentId).trim().toUpperCase());
    }

    if (!student) {
      res.status(404).json({
        error: "Student not found. Please check the QR code or roll number.",
      });
      return;
    }

    if (student.qrStatus === "REVOKED") {
      res.status(403).json({
        error: "This student's QR code has been revoked by administration. Please contact the warden.",
      });
      return;
    }

    // Retrieve today's eligible entitlements (allow optional date override for testing)
    const targetDate = req.query.date ? String(req.query.date) : undefined;
    const entitlementsData = await getStudentTodayEntitlements(student.studentDbId, targetDate);

    // Also include confirmed upcoming month enrolment so staff sees full synchronized status
    const windowStatus = checkSelectionWindow();
    const upcomingMess = await getStudentMessSelection(student.studentDbId, windowStatus.targetMonthYear);
    const upcomingAddonRows = await getStudentAddonSelections(student.studentDbId, windowStatus.targetMonthYear);
    const allAddons = await getAddons();
    const addonById = new Map(allAddons.map((a) => [a.id, a]));
    const addonSummaryMap = new Map<number, { addonId: number; name: string; mealSlot: string; servingsCount: number }>();
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
          servingsCount: 1,
        });
      }
    }

    // Return student identity + today's entitlement deck (strictly no financial info)
    res.json({
      student: {
        studentDbId: student.studentDbId,
        studentId: student.studentId,
        fullName: student.fullName,
        department: student.department,
        semester: student.semester,
        roomNumber: student.roomNumber,
        phone: student.phone,
        avatarUrl: student.avatarUrl,
        qrStatus: student.qrStatus,
      },
      ...entitlementsData,
      upcomingEnrolment: {
        monthYear: windowStatus.targetMonthYear,
        messSelection: upcomingMess,
        bookedAddons: Array.from(addonSummaryMap.values()),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/scanner/redeem-batch
 * Multi-item single scan atomic redemption
 */
scannerRouter.post("/redeem-batch", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { entitlementIds, studentDbId, scanMethod, notes } = req.body;

    if (!entitlementIds || !Array.isArray(entitlementIds) || entitlementIds.length === 0) {
      res.status(400).json({ error: "No entitlement IDs selected for redemption" });
      return;
    }

    if (!studentDbId) {
      res.status(400).json({ error: "studentDbId is required" });
      return;
    }

    const staffUserId = req.user!.userId;

    const result = await redeemBatchEntitlements({
      entitlementIds: entitlementIds.map(Number),
      studentDbId: Number(studentDbId),
      staffUserId,
      scanMethod: scanMethod === "MANUAL_LOOKUP" ? "MANUAL_LOOKUP" : "CAMERA_QR",
      notes,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/scanner/recent-students
 * Returns the last N distinct students scanned by this staff member (dynamic, no hardcoding)
 */
scannerRouter.get("/recent-students", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const staffUserId = req.user!.userId;
    const limit = Math.min(Number(req.query.limit) || 5, 10);

    // Use raw client for the GROUP BY / MAX aggregation query
    const rows = await client.execute({
      sql: `
        SELECT s.student_id, u.full_name, MAX(rr.scanned_at) as last_scanned
        FROM redemption_records rr
        JOIN students s ON s.id = rr.student_id
        JOIN users u ON u.id = s.user_id
        WHERE rr.staff_user_id = ?
        GROUP BY s.id
        ORDER BY last_scanned DESC
        LIMIT ?
      `,
      args: [staffUserId, limit],
    });

    res.json(
      Array.isArray(rows.rows)
        ? rows.rows.map((r: any) => ({ studentId: r.student_id, name: r.full_name }))
        : []
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/scanner/history
 * Shift redemption log for logged in mess staff
 */
scannerRouter.get("/history", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const staffUserId = req.user!.userId;
    const limit = Number(req.query.limit) || 30;
    const history = await getStaffScanHistory(staffUserId, limit);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
