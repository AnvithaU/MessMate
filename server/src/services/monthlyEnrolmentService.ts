import { db, client } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { selectMonthlyMess } from "./messService.js";
import { getAddons, isDateAllowedForAddon } from "./addonService.js";
import { checkSelectionWindow } from "./selectionWindowService.js";

export interface MonthlyEnrolmentPayload {
  studentDbId: number;
  monthYear: string; // e.g. "2026-12"
  messId: number;    // South Mess or North Mess
  addonPlans: Array<{
    addonId: number;
    optIn: boolean;
  }>;
  adminUserId?: number;
  overrideReason?: string;
  simulatedDate?: string; // Optional for testing specific calendar dates
}

export async function submitUnifiedMonthlyEnrolment(payload: MonthlyEnrolmentPayload) {
  const { studentDbId, monthYear, messId, addonPlans, adminUserId, overrideReason, simulatedDate } = payload;

  // Window validation: 25th through end of month (unless admin override)
  if (!adminUserId) {
    const windowStatus = checkSelectionWindow(simulatedDate);
    if (!windowStatus.isOpen) {
      throw new Error(
        `Monthly mess and add-on selection window is closed. Selections are only permitted between the 25th and the last calendar day of the month. ${windowStatus.message}`
      );
    }
    if (monthYear !== windowStatus.targetMonthYear) {
      throw new Error(
        `Selection is currently open only for the upcoming month (${windowStatus.targetMonthYear}). You attempted to select for ${monthYear}.`
      );
    }

    // Prevent duplicate monthly enrolment once already booked for target month
    const existingMonthlyMess = await db
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

    if (existingMonthlyMess) {
      throw new Error(
        `You have already completed your monthly enrolment for ${monthYear}. Duplicate bookings are not allowed; contact the mess warden if an administrative change is required.`
      );
    }
  }

  // 1. Process Mess Selection
  const messSelection = await selectMonthlyMess({
    studentDbId,
    monthYear,
    messId,
    adminUserId,
    overrideReason,
  });

  // 2. Process Monthly Add-ons Package for this Month
  const allAddons = await getAddons();
  const addonMap = new Map(allAddons.map((a) => [a.id, a]));

  const [year, month] = monthYear.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const bookedAddonSelections = [];
  let totalAddonsCost = 0;

  for (const plan of addonPlans) {
    if (!plan.optIn) continue;
    const addon = addonMap.get(plan.addonId);
    if (!addon) continue;

    // Generate all dates in this month where this addon is allowed
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const monthStr = month < 10 ? `0${month}` : `${month}`;
      const specificDate = `${year}-${monthStr}-${dayStr}`;

      if (!isDateAllowedForAddon(specificDate, addon.availableDaysOfWeek)) {
        continue;
      }

      // Check if already booked
      const existing = await db
        .select()
        .from(schema.addonSelections)
        .where(
          and(
            eq(schema.addonSelections.studentId, studentDbId),
            eq(schema.addonSelections.addonId, addon.id),
            eq(schema.addonSelections.specificDate, specificDate),
            eq(schema.addonSelections.status, "CONFIRMED")
          )
        )
        .limit(1)
        .get();

      if (!existing) {
        const sel = await db
          .insert(schema.addonSelections)
          .values({
            studentId: studentDbId,
            addonId: addon.id,
            specificDate,
            mealSlot: addon.mealSlot,
            unitPrice: addon.unitPrice,
            status: "CONFIRMED",
          })
          .returning()
          .get();

        bookedAddonSelections.push(sel);
        totalAddonsCost += addon.unitPrice;

        // Create individual entitlement for that calendar date
        await db.insert(schema.entitlements).values({
          studentId: studentDbId,
          entitlementType: "ADDON",
          referenceId: sel.id,
          itemName: addon.name.split("(")[0].trim(),
          applicableDate: specificDate,
          mealSlot: addon.mealSlot,
          status: "AVAILABLE",
        });
      }
    }
  }

  // Record Addons Total Debit in Financial Ledger
  if (totalAddonsCost > 0) {
    const lastLedger = await db
      .select()
      .from(schema.financialLedger)
      .where(eq(schema.financialLedger.studentId, studentDbId))
      .orderBy(sql`id DESC`)
      .limit(1)
      .get();

    const currentBalance = lastLedger ? lastLedger.balanceAfter : 0;
    const newBalance = currentBalance - totalAddonsCost;

    await db.insert(schema.financialLedger).values({
      studentId: studentDbId,
      transactionType: "ADDON_CHARGE",
      amount: -totalAddonsCost,
      balanceAfter: newBalance,
      referenceId: `MONTHLY-ADDONS-${monthYear}-${studentDbId}`,
      referenceType: "addon_selection",
      recordedByUserId: adminUserId || null,
      adjustmentReason: `Monthly Add-ons package enrolment for ${monthYear} (${bookedAddonSelections.length} daily servings)`,
    });
  }

  return {
    success: true,
    monthYear,
    messSelection,
    addonsBookedCount: bookedAddonSelections.length,
    totalAddonsCost,
  };
}
