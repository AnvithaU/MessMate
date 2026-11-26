import { db, client } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { getStudentMessSelection } from "./messService.js";

export interface RebateCalculationResult {
  eligible: boolean;
  totalDays: number;
  rebatePercentage: number; // 0, 50, or 100
  dailyMessRate: number;
  totalAddonRefund: number;
  addonChargesInRange: number; // alias for frontend compatibility
  estimatedRebateAmount: number;
  estimatedRefund: number; // alias for frontend compatibility
  message: string;
  affectedEntitlementCount: number;
}

/**
 * Calculates leave days and rebate amount based on NMAMIT Hostel rules:
 * - 4 to 7 days: 50% refund
 * - 8+ days: 100% full refund
 * - Less than 4 days: 0% refund
 */
export async function calculateRebate(params: {
  studentDbId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}): Promise<RebateCalculationResult> {
  const { studentDbId, startDate, endDate } = params;

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  const diffTime = end.getTime() - start.getTime();
  if (diffTime < 0) {
    throw new Error("End date must be on or after start date");
  }

  const totalDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // Determine rebate percentage
  let rebatePercentage = 0;
  if (totalDays >= 8) {
    rebatePercentage = 100;
  } else if (totalDays >= 4) {
    rebatePercentage = 50;
  }

  // Get student's current mess fee
  const monthYear = startDate.slice(0, 7);
  const messSel = await getStudentMessSelection(studentDbId, monthYear);
  const monthlyFee = messSel ? messSel.feeCharged : 3800;
  const dailyMessRate = Math.round((monthlyFee / 30) * 100) / 100; // ~₹126.67/day

  // Fetch available entitlements that will be cancelled in this range
  const activeEntitlements = await db
    .select()
    .from(schema.entitlements)
    .where(
      and(
        eq(schema.entitlements.studentId, studentDbId),
        gte(schema.entitlements.applicableDate, startDate),
        lte(schema.entitlements.applicableDate, endDate),
        eq(schema.entitlements.status, "AVAILABLE")
      )
    )
    .all();

  // Addon charges in this window
  const activeAddons = await db
    .select({ unitPrice: schema.addonSelections.unitPrice })
    .from(schema.addonSelections)
    .where(
      and(
        eq(schema.addonSelections.studentId, studentDbId),
        gte(schema.addonSelections.specificDate, startDate),
        lte(schema.addonSelections.specificDate, endDate),
        eq(schema.addonSelections.status, "CONFIRMED")
      )
    )
    .all();

  const totalAddonSum = activeAddons.reduce((sum, a) => sum + a.unitPrice, 0);

  const rawMessRebate = dailyMessRate * totalDays;
  const rawTotal = rawMessRebate + totalAddonSum;
  const estimatedRebateAmount = Math.round((rawTotal * (rebatePercentage / 100)) * 100) / 100;

  let message = "";
  if (rebatePercentage === 100) {
    message = `Eligible for 100% Full Refund (${totalDays} days leave >= 8 days threshold). All meals will be credited back to your balance.`;
  } else if (rebatePercentage === 50) {
    message = `Eligible for 50% Half Refund (${totalDays} days leave between 4 and 7 days). Half of the mess charges will be credited back to your balance.`;
  } else {
    message = `Not eligible for refund (${totalDays} days leave is below the minimum 4-day hostel rebate threshold).`;
  }

  return {
    eligible: rebatePercentage > 0,
    totalDays,
    rebatePercentage,
    dailyMessRate,
    totalAddonRefund: totalAddonSum,
    addonChargesInRange: totalAddonSum,  // frontend alias
    estimatedRebateAmount,
    estimatedRefund: estimatedRebateAmount, // frontend alias
    message,
    affectedEntitlementCount: activeEntitlements.length,
  };
}

/**
 * Submits the rebate: Cancels entitlements and credits the student ledger
 */
export async function submitHostelRebate(params: {
  studentDbId: number;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  const { studentDbId, startDate, endDate, reason } = params;

  const calc = await calculateRebate({ studentDbId, startDate, endDate });

  if (!calc.eligible) {
    throw new Error(
      `Rebate rejected: Leave duration is ${calc.totalDays} day(s). Minimum 4 consecutive days required for 50% rebate, and 8+ days for 100% rebate.`
    );
  }

  await client.execute("BEGIN IMMEDIATE;");

  try {
    // 1. Record the rebate request as PENDING — warden must approve before credit
    const rebate = await db
      .insert(schema.hostelRebateRequests)
      .values({
        studentId: studentDbId,
        startDate,
        endDate,
        totalDays: calc.totalDays,
        rebatePercentage: calc.rebatePercentage,
        dailyRate: calc.dailyMessRate,
        rebateAmount: calc.estimatedRebateAmount,
        status: "PENDING" as any,
        reason: reason.trim(),
      })
      .returning()
      .get();

    // 2. Do NOT cancel entitlements or credit the ledger yet — pending warden approval

    // 3. Audit Log
    await db.insert(schema.auditLogs).values({
      action: "HOSTEL_LEAVE_REBATE_REQUEST",
      entityType: "hostel_rebate_requests",
      entityId: String(rebate.id),
      newState: JSON.stringify({
        studentDbId,
        startDate,
        endDate,
        totalDays: calc.totalDays,
        rebatePercentage: calc.rebatePercentage,
        rebateAmount: calc.estimatedRebateAmount,
        status: "PENDING",
      }),
    });

    await client.execute("COMMIT;");

    return {
      success: true,
      rebate,
      calculation: calc,
      message: `Rebate request of ₹${calc.estimatedRebateAmount.toFixed(0)} submitted successfully. Awaiting warden approval.`,
    };
  } catch (err: any) {
    await client.execute("ROLLBACK;");
    throw new Error(`Failed to process hostel leave rebate: ${err.message}`);
  }
}

export async function getStudentRebates(studentDbId: number) {
  const rows = await db
    .select()
    .from(schema.hostelRebateRequests)
    .where(eq(schema.hostelRebateRequests.studentId, studentDbId))
    .orderBy(sql`id DESC`)
    .all();

  return rows.map((r) => ({
    ...r,
    refundAmount: r.rebateAmount,
  }));
}

export async function approveHostelRebate(params: {
  rebateId: number;
  adminUserId: number;
  wardenNotes?: string;
}) {
  const { rebateId, adminUserId, wardenNotes } = params;

  const rebate = await db
    .select()
    .from(schema.hostelRebateRequests)
    .where(eq(schema.hostelRebateRequests.id, rebateId))
    .limit(1)
    .get();

  if (!rebate) {
    throw new Error("Rebate request not found");
  }
  if (rebate.status !== "PENDING") {
    throw new Error(`Rebate request #${rebateId} is already ${rebate.status}`);
  }

  await client.execute("BEGIN IMMEDIATE;");
  try {
    // 1. Mark rebate request as APPROVED
    const updated = await db
      .update(schema.hostelRebateRequests)
      .set({
        status: "APPROVED",
        reviewedByUserId: adminUserId,
        reviewedAt: new Date().toISOString(),
        wardenNotes: wardenNotes || null,
      })
      .where(eq(schema.hostelRebateRequests.id, rebateId))
      .returning()
      .get();

    // 2. Cancel AVAILABLE entitlements in the approved leave range
    await db
      .update(schema.entitlements)
      .set({ status: "CANCELLED_REBATE" })
      .where(
        and(
          eq(schema.entitlements.studentId, rebate.studentId),
          gte(schema.entitlements.applicableDate, rebate.startDate),
          lte(schema.entitlements.applicableDate, rebate.endDate),
          eq(schema.entitlements.status, "AVAILABLE")
        )
      )
      .run();

    // 3. Append credit transaction to immutable financial ledger
    const lastLedger = await db
      .select()
      .from(schema.financialLedger)
      .where(eq(schema.financialLedger.studentId, rebate.studentId))
      .orderBy(sql`id DESC`)
      .limit(1)
      .get();

    const currentBalance = lastLedger ? lastLedger.balanceAfter : 0;
    const newBalance = currentBalance + rebate.rebateAmount;

    await db.insert(schema.financialLedger).values({
      studentId: rebate.studentId,
      transactionType: "REBATE_REFUND_CREDIT",
      amount: rebate.rebateAmount,
      balanceAfter: newBalance,
      referenceId: `REBATE-${rebate.id}`,
      referenceType: "rebate",
      recordedByUserId: adminUserId,
      adjustmentReason: `Warden Approved Leave Rebate (${rebate.rebatePercentage}% for ${rebate.totalDays} days: ${rebate.startDate} to ${rebate.endDate})`,
    });

    // 4. Audit log
    await db.insert(schema.auditLogs).values({
      userId: adminUserId,
      action: "APPROVE_HOSTEL_REBATE",
      entityType: "hostel_rebate_requests",
      entityId: String(rebate.id),
      oldState: JSON.stringify({ status: "PENDING" }),
      newState: JSON.stringify({ status: "APPROVED", rebateAmount: rebate.rebateAmount, wardenNotes }),
    });

    await client.execute("COMMIT;");
    return updated;
  } catch (err: any) {
    await client.execute("ROLLBACK;");
    throw new Error(`Failed to approve rebate: ${err.message}`);
  }
}

export async function rejectHostelRebate(params: {
  rebateId: number;
  adminUserId: number;
  wardenNotes?: string;
}) {
  const { rebateId, adminUserId, wardenNotes } = params;

  const rebate = await db
    .select()
    .from(schema.hostelRebateRequests)
    .where(eq(schema.hostelRebateRequests.id, rebateId))
    .limit(1)
    .get();

  if (!rebate) {
    throw new Error("Rebate request not found");
  }
  if (rebate.status !== "PENDING") {
    throw new Error(`Rebate request #${rebateId} is already ${rebate.status}`);
  }

  const updated = await db
    .update(schema.hostelRebateRequests)
    .set({
      status: "REJECTED",
      reviewedByUserId: adminUserId,
      reviewedAt: new Date().toISOString(),
      wardenNotes: wardenNotes || "Rejected by Warden",
    })
    .where(eq(schema.hostelRebateRequests.id, rebateId))
    .returning()
    .get();

  await db.insert(schema.auditLogs).values({
    userId: adminUserId,
    action: "REJECT_HOSTEL_REBATE",
    entityType: "hostel_rebate_requests",
    entityId: String(rebate.id),
    oldState: JSON.stringify({ status: "PENDING" }),
    newState: JSON.stringify({ status: "REJECTED", wardenNotes }),
  });

  return updated;
}

export async function getAllRebates() {
  return await db
    .select({
      id: schema.hostelRebateRequests.id,
      startDate: schema.hostelRebateRequests.startDate,
      endDate: schema.hostelRebateRequests.endDate,
      totalDays: schema.hostelRebateRequests.totalDays,
      rebatePercentage: schema.hostelRebateRequests.rebatePercentage,
      rebateAmount: schema.hostelRebateRequests.rebateAmount,
      status: schema.hostelRebateRequests.status,
      reason: schema.hostelRebateRequests.reason,
      createdAt: schema.hostelRebateRequests.createdAt,
      studentId: schema.students.studentId,
      studentName: schema.users.fullName,
      department: schema.students.department,
      roomNumber: schema.students.roomNumber,
    })
    .from(schema.hostelRebateRequests)
    .innerJoin(schema.students, eq(schema.hostelRebateRequests.studentId, schema.students.id))
    .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
    .orderBy(sql`hostel_rebate_requests.id DESC`)
    .all();
}
