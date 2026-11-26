import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, inArray } from "drizzle-orm";

export async function getAddons() {
  return await db.select().from(schema.addons).where(eq(schema.addons.isActive, 1)).all();
}

/**
 * Checks if a specific date (YYYY-MM-DD) satisfies an add-on's weekday rule
 */
export function isDateAllowedForAddon(dateStr: string, availableDaysOfWeek: string): boolean {
  if (availableDaysOfWeek === "DAILY") return true;

  const dateObj = new Date(dateStr + "T00:00:00Z");
  const dayIndex = dateObj.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  const allowedDays = availableDaysOfWeek.split(",").map((s) => s.trim().toUpperCase());
  const dayMap: Record<number, string> = {
    0: "SUN",
    1: "MON",
    2: "TUE",
    3: "WED",
    4: "THU",
    5: "FRI",
    6: "SAT",
  };

  const currentDayCode = dayMap[dayIndex];
  return allowedDays.includes(currentDayCode);
}

export async function getStudentAddonSelections(studentDbId: number, monthYear?: string) {
  let query = db
    .select({
      id: schema.addonSelections.id,
      addonId: schema.addonSelections.addonId,
      specificDate: schema.addonSelections.specificDate,
      mealSlot: schema.addonSelections.mealSlot,
      unitPrice: schema.addonSelections.unitPrice,
      status: schema.addonSelections.status,
      selectedAt: schema.addonSelections.selectedAt,
      addonName: schema.addons.name,
      addonCode: schema.addons.code,
      iconName: schema.addons.iconName,
    })
    .from(schema.addonSelections)
    .innerJoin(schema.addons, eq(schema.addonSelections.addonId, schema.addons.id))
    .where(eq(schema.addonSelections.studentId, studentDbId));

  const allSelections = await query.all();
  if (monthYear) {
    return allSelections.filter((s) => s.specificDate.startsWith(monthYear));
  }
  return allSelections;
}

export interface AddonBookingItem {
  addonId: number;
  specificDate: string; // YYYY-MM-DD
}

export async function bookStudentAddons(params: {
  studentDbId: number;
  bookings: AddonBookingItem[];
  recordedByUserId?: number;
}) {
  const { studentDbId, bookings, recordedByUserId } = params;
  if (!bookings || bookings.length === 0) {
    throw new Error("No add-on bookings provided");
  }

  // Fetch all active add-ons
  const allAddons = await getAddons();
  const addonMap = new Map(allAddons.map((a) => [a.id, a]));

  const createdSelections = [];
  let totalCost = 0;

  for (const b of bookings) {
    const addon = addonMap.get(b.addonId);
    if (!addon) {
      throw new Error(`Add-on with id ${b.addonId} not found or inactive`);
    }

    // Validate weekday rule
    if (!isDateAllowedForAddon(b.specificDate, addon.availableDaysOfWeek)) {
      throw new Error(
        `${addon.name} is not available on ${b.specificDate} (Available days: ${addon.availableDaysOfWeek})`
      );
    }

    // Check if already booked
    const existing = await db
      .select()
      .from(schema.addonSelections)
      .where(
        and(
          eq(schema.addonSelections.studentId, studentDbId),
          eq(schema.addonSelections.addonId, b.addonId),
          eq(schema.addonSelections.specificDate, b.specificDate),
          eq(schema.addonSelections.status, "CONFIRMED")
        )
      )
      .limit(1)
      .get();

    if (existing) {
      continue; // Skip duplicate booking without failing the remaining batch
    }

    // Insert selection
    const sel = await db
      .insert(schema.addonSelections)
      .values({
        studentId: studentDbId,
        addonId: b.addonId,
        specificDate: b.specificDate,
        mealSlot: addon.mealSlot,
        unitPrice: addon.unitPrice,
        status: "CONFIRMED",
      })
      .returning()
      .get();

    createdSelections.push({ sel, addon });
    totalCost += addon.unitPrice;

    // Create Entitlement
    await db.insert(schema.entitlements).values({
      studentId: studentDbId,
      entitlementType: "ADDON",
      referenceId: sel.id,
      itemName: addon.name.split("(")[0].trim(), // Clean short name e.g. "Farm Fresh Milk" or "Egg"
      applicableDate: b.specificDate,
      mealSlot: addon.mealSlot,
      status: "AVAILABLE",
    });
  }

  // Append debits to financial ledger
  if (totalCost > 0) {
    const lastLedger = await db
      .select()
      .from(schema.financialLedger)
      .where(eq(schema.financialLedger.studentId, studentDbId))
      .orderBy(sql`id DESC`)
      .limit(1)
      .get();

    const currentBalance = lastLedger ? lastLedger.balanceAfter : 0;
    const newBalance = currentBalance - totalCost;

    await db.insert(schema.financialLedger).values({
      studentId: studentDbId,
      transactionType: "ADDON_CHARGE",
      amount: -totalCost,
      balanceAfter: newBalance,
      referenceId: `ADDONS-BATCH-${Date.now().toString().slice(-6)}`,
      referenceType: "addon_selection",
      recordedByUserId: recordedByUserId || null,
      adjustmentReason: `Add-on booking charge for ${createdSelections.length} item(s)`,
    });
  }

  return {
    success: true,
    bookedCount: createdSelections.length,
    totalCost,
    selections: createdSelections.map((c) => c.sel),
  };
}
