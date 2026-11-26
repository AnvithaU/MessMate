import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

export async function getMesses() {
  return await db.select().from(schema.messes).where(eq(schema.messes.isActive, 1)).all();
}

export async function getActiveWindow(monthYear: string) {
  const window = await db
    .select()
    .from(schema.monthlyMessWindows)
    .where(eq(schema.monthlyMessWindows.monthYear, monthYear))
    .limit(1)
    .get();

  return window;
}

export async function getStudentMessSelection(studentDbId: number, monthYear: string) {
  const selection = await db
    .select({
      id: schema.monthlyMessSelections.id,
      monthYear: schema.monthlyMessSelections.monthYear,
      messId: schema.monthlyMessSelections.messId,
      feeCharged: schema.monthlyMessSelections.feeCharged,
      selectedAt: schema.monthlyMessSelections.selectedAt,
      lockedAt: schema.monthlyMessSelections.lockedAt,
      overriddenByAdminId: schema.monthlyMessSelections.overriddenByAdminId,
      overrideReason: schema.monthlyMessSelections.overrideReason,
      messName: schema.messes.name,
      messCode: schema.messes.code,
      cuisineType: schema.messes.cuisineType,
      imageUrl: schema.messes.imageUrl,
    })
    .from(schema.monthlyMessSelections)
    .innerJoin(schema.messes, eq(schema.monthlyMessSelections.messId, schema.messes.id))
    .where(
      and(
        eq(schema.monthlyMessSelections.studentId, studentDbId),
        eq(schema.monthlyMessSelections.monthYear, monthYear)
      )
    )
    .limit(1)
    .get();

  return selection || null;
}

export async function selectMonthlyMess(params: {
  studentDbId: number;
  monthYear: string;
  messId: number;
  adminUserId?: number;
  overrideReason?: string;
}) {
  const { studentDbId, monthYear, messId, adminUserId, overrideReason } = params;

  // 1. Verify mess exists
  const targetMess = await db
    .select()
    .from(schema.messes)
    .where(eq(schema.messes.id, messId))
    .limit(1)
    .get();

  if (!targetMess) {
    throw new Error("Invalid mess selected");
  }

  // 2. Check window and locking rules
  const window = await getActiveWindow(monthYear);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (window && !adminUserId) {
    if (window.isLocked === 1 || todayStr > window.deadlineDate) {
      throw new Error(
        `Monthly selection for ${monthYear} is locked (deadline was ${window.deadlineDate}). Please contact the mess warden for an administrative override.`
      );
    }
  }

  // 3. Check existing selection for this month
  const existingSelection = await db
    .select()
    .from(schema.monthlyMessSelections)
    .where(
      and(
        eq(schema.monthlyMessSelections.studentId, studentDbId),
        eq(schema.monthlyMessSelections.monthYear, monthYear)
      )
    )
    .limit(1)
    .get();

  let selectionRecordId: number;

  if (existingSelection) {
    // If selecting the exact same mess, return existing
    if (existingSelection.messId === messId) {
      return existingSelection;
    }

    const feeDifference = targetMess.monthlyFee - existingSelection.feeCharged;

    // Update selection
    await db
      .update(schema.monthlyMessSelections)
      .set({
        messId,
        feeCharged: targetMess.monthlyFee,
        selectedAt: sql`CURRENT_TIMESTAMP`,
        overriddenByAdminId: adminUserId || null,
        overrideReason: overrideReason || (adminUserId ? "Administrative mess change" : null),
      })
      .where(eq(schema.monthlyMessSelections.id, existingSelection.id))
      .run();

    selectionRecordId = existingSelection.id;

    // Append adjustment to financial ledger if fee changed
    if (feeDifference !== 0) {
      const lastLedger = await db
        .select()
        .from(schema.financialLedger)
        .where(eq(schema.financialLedger.studentId, studentDbId))
        .orderBy(sql`id DESC`)
        .limit(1)
        .get();

      const currentBalance = lastLedger ? lastLedger.balanceAfter : 0;
      const newBalance = currentBalance - feeDifference;

      await db.insert(schema.financialLedger).values({
        studentId: studentDbId,
        transactionType: feeDifference > 0 ? "MONTHLY_MESS_CHARGE" : "ADJUSTMENT_CREDIT",
        amount: -feeDifference, // debit difference
        balanceAfter: newBalance,
        referenceId: `MESS-${monthYear}-${selectionRecordId}`,
        referenceType: "monthly_mess",
        recordedByUserId: adminUserId || null,
        adjustmentReason: `Mess change to ${targetMess.name} for ${monthYear}`,
      });
    }
  } else {
    // New selection for month
    const newSel = await db
      .insert(schema.monthlyMessSelections)
      .values({
        studentId: studentDbId,
        monthYear,
        messId,
        feeCharged: targetMess.monthlyFee,
        overriddenByAdminId: adminUserId || null,
        overrideReason: overrideReason || null,
      })
      .returning()
      .get();

    selectionRecordId = newSel.id;

    // Append to financial ledger
    const lastLedger = await db
      .select()
      .from(schema.financialLedger)
      .where(eq(schema.financialLedger.studentId, studentDbId))
      .orderBy(sql`id DESC`)
      .limit(1)
      .get();

    const currentBalance = lastLedger ? lastLedger.balanceAfter : 0;
    const newBalance = currentBalance - targetMess.monthlyFee;

    await db.insert(schema.financialLedger).values({
      studentId: studentDbId,
      transactionType: "MONTHLY_MESS_CHARGE",
      amount: -targetMess.monthlyFee,
      balanceAfter: newBalance,
      referenceId: `MESS-${monthYear}-${selectionRecordId}`,
      referenceType: "monthly_mess",
      recordedByUserId: adminUserId || null,
      adjustmentReason: `Monthly Mess enrolment fee for ${monthYear} (${targetMess.name})`,
    });
  }

  // If selection is for the current active month, ensure today's meal entitlement reflects it
  const currentMonthYear = now.toISOString().slice(0, 7);
  if (monthYear === currentMonthYear) {
    const todayStrFormatted = now.toISOString().slice(0, 10);
    const existingEntitlement = await db
      .select()
      .from(schema.entitlements)
      .where(
        and(
          eq(schema.entitlements.studentId, studentDbId),
          eq(schema.entitlements.applicableDate, todayStrFormatted),
          eq(schema.entitlements.entitlementType, "MESS_MEAL")
        )
      )
      .limit(1)
      .get();

    const mealName = `${targetMess.name} Lunch`;
    if (existingEntitlement) {
      if (existingEntitlement.status === "AVAILABLE") {
        await db
          .update(schema.entitlements)
          .set({
            itemName: mealName,
            referenceId: selectionRecordId,
          })
          .where(eq(schema.entitlements.id, existingEntitlement.id))
          .run();
      }
    } else {
      await db.insert(schema.entitlements).values({
        studentId: studentDbId,
        entitlementType: "MESS_MEAL",
        referenceId: selectionRecordId,
        itemName: mealName,
        applicableDate: todayStrFormatted,
        mealSlot: "LUNCH",
        status: "AVAILABLE",
      });
    }
  }

  // Audit log if admin override
  if (adminUserId) {
    await db.insert(schema.auditLogs).values({
      userId: adminUserId,
      action: "MESS_OVERRIDE",
      entityType: "monthly_mess_selections",
      entityId: String(selectionRecordId),
      newState: JSON.stringify({ studentDbId, monthYear, messId, targetMess: targetMess.name }),
      oldState: existingSelection ? JSON.stringify(existingSelection) : null,
    });
  }

  return await getStudentMessSelection(studentDbId, monthYear);
}
