import { db, client } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { getStudentMessSelection } from "./messService.js";
import { getAddons, isDateAllowedForAddon } from "./addonService.js";

export interface EntitlementDisplayItem {
  id: number | null; // null if not selected or not available
  itemName: string;
  category: "MESS_MEAL" | "ADDON";
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  status:
    | "AVAILABLE"
    | "REDEEMED"
    | "EXPIRED"
    | "CANCELLED"
    | "NOT_SELECTED"
    | "NOT_AVAILABLE_TODAY"
    | "OUTSIDE_COLLECTION_TIME";
  isSelectableForRedemption: boolean;
  redeemedAt?: string;
  staffName?: string;
  details?: string;
}

export async function getStudentTodayEntitlements(
  studentDbId: number,
  targetDateStr?: string,
  targetMealSlot?: "BREAKFAST" | "LUNCH" | "DINNER"
) {
  const now = new Date();
  const dateStr = targetDateStr || now.toISOString().slice(0, 10);
  const monthYear = dateStr.slice(0, 7);

  // Determine current meal slot if not specified
  let currentSlot = targetMealSlot;
  if (!currentSlot) {
    const hours = now.getHours();
    if (hours < 11) {
      currentSlot = "BREAKFAST";
    } else if (hours < 16) {
      currentSlot = "LUNCH";
    } else {
      currentSlot = "DINNER";
    }
  }

  const results: EntitlementDisplayItem[] = [];

  // 1. Check Monthly Mess Selection
  const messSelection = await getStudentMessSelection(studentDbId, monthYear);

  // Query actual entitlement records for today
  const existingEntitlements = await db
    .select({
      id: schema.entitlements.id,
      entitlementType: schema.entitlements.entitlementType,
      referenceId: schema.entitlements.referenceId,
      itemName: schema.entitlements.itemName,
      applicableDate: schema.entitlements.applicableDate,
      mealSlot: schema.entitlements.mealSlot,
      status: schema.entitlements.status,
      scannedAt: schema.redemptionRecords.scannedAt,
      staffName: schema.users.fullName,
    })
    .from(schema.entitlements)
    .leftJoin(
      schema.redemptionRecords,
      eq(schema.entitlements.id, schema.redemptionRecords.entitlementId)
    )
    .leftJoin(schema.users, eq(schema.redemptionRecords.staffUserId, schema.users.id))
    .where(
      and(
        eq(schema.entitlements.studentId, studentDbId),
        eq(schema.entitlements.applicableDate, dateStr)
      )
    )
    .all();

  // Find mess meal entitlement for today
  const messEntitlement = existingEntitlements.find((e) => e.entitlementType === "MESS_MEAL");

  if (messSelection) {
    const mealName = `${messSelection.messName} Lunch`;
    if (messEntitlement) {
      const isAvailable = messEntitlement.status === "AVAILABLE";
      results.push({
        id: messEntitlement.id,
        itemName: mealName,
        category: "MESS_MEAL",
        mealSlot: "LUNCH",
        status: messEntitlement.status as any,
        isSelectableForRedemption: isAvailable,
        redeemedAt: messEntitlement.scannedAt || undefined,
        staffName: messEntitlement.staffName || undefined,
        details: `${messSelection.cuisineType} — Included with Monthly Selection`,
      });
    } else {
      // Auto-create entitlement if student has active mess
      const newEnt = await db
        .insert(schema.entitlements)
        .values({
          studentId: studentDbId,
          entitlementType: "MESS_MEAL",
          referenceId: messSelection.id,
          itemName: mealName,
          applicableDate: dateStr,
          mealSlot: "LUNCH",
          status: "AVAILABLE",
        })
        .returning()
        .get();

      results.push({
        id: newEnt.id,
        itemName: mealName,
        category: "MESS_MEAL",
        mealSlot: "LUNCH",
        status: "AVAILABLE",
        isSelectableForRedemption: true,
        details: `${messSelection.cuisineType} — Included with Monthly Selection`,
      });
    }
  } else {
    results.push({
      id: null,
      itemName: "Mess Regular Meal",
      category: "MESS_MEAL",
      mealSlot: "LUNCH",
      status: "NOT_SELECTED",
      isSelectableForRedemption: false,
      details: `No mess selected for ${monthYear}. Please select South or North Mess.`,
    });
  }

  // 2. Add-on Entitlements — only include add-ons actually booked by the student for today
  const allAddons = await getAddons();

  for (const addon of allAddons) {
    const cleanName = addon.name.split("(")[0].trim();
    const foundEnt = existingEntitlements.find(
      (e) =>
        e.entitlementType === "ADDON" &&
        (e.itemName.toLowerCase() === cleanName.toLowerCase() ||
          e.itemName.toLowerCase().includes(addon.code.toLowerCase()))
    );

    if (foundEnt) {
      const isAvailable = foundEnt.status === "AVAILABLE";
      results.push({
        id: foundEnt.id,
        itemName: cleanName,
        category: "ADDON",
        mealSlot: foundEnt.mealSlot as any,
        status: foundEnt.status as any,
        isSelectableForRedemption: isAvailable,
        redeemedAt: foundEnt.scannedAt || undefined,
        staffName: foundEnt.staffName || undefined,
        details: `₹${addon.unitPrice} — Booked for today`,
      });
    }
  }

  return {
    date: dateStr,
    currentSlot,
    selectedMess: messSelection ? messSelection.messName : null,
    entitlements: results,
  };
}

export async function redeemBatchEntitlements(params: {
  entitlementIds: number[];
  studentDbId: number;
  staffUserId: number;
  scanMethod?: "CAMERA_QR" | "MANUAL_LOOKUP";
  notes?: string;
}) {
  const {
    entitlementIds,
    studentDbId,
    staffUserId,
    scanMethod = "CAMERA_QR",
    notes,
  } = params;

  if (!entitlementIds || entitlementIds.length === 0) {
    throw new Error("No entitlements specified for redemption");
  }

  const succeeded: Array<{ id: number; itemName: string }> = [];
  const failed: Array<{ id: number; reason: string }> = [];

  try {
    await db.transaction(async (transactionDb) => {
      for (const entId of entitlementIds) {
        const entitlement = await transactionDb
          .select()
          .from(schema.entitlements)
          .where(
            and(
              eq(schema.entitlements.id, entId),
              eq(schema.entitlements.studentId, studentDbId)
            )
          )
          .limit(1)
          .get();

        if (!entitlement) {
          failed.push({ id: entId, reason: "Entitlement record not found or does not belong to this student" });
          continue;
        }

        if (entitlement.status === "REDEEMED") {
          failed.push({ id: entId, reason: `'${entitlement.itemName}' has already been redeemed! Duplicate redemption prevented.` });
          continue;
        }

        if (entitlement.status !== "AVAILABLE") {
          failed.push({ id: entId, reason: `'${entitlement.itemName}' is ${entitlement.status.toLowerCase()} and cannot be redeemed` });
          continue;
        }

        const existingRedemption = await transactionDb
          .select()
          .from(schema.redemptionRecords)
          .where(eq(schema.redemptionRecords.entitlementId, entId))
          .limit(1)
          .get();

        if (existingRedemption) {
          failed.push({ id: entId, reason: `'${entitlement.itemName}' was already scanned at ${existingRedemption.scannedAt}` });
          continue;
        }

        await transactionDb.insert(schema.redemptionRecords).values({
          entitlementId: entId,
          studentId: studentDbId,
          staffUserId,
          scanMethod,
          notes: notes || "Batch redeemed at mess counter",
        });

        await transactionDb
          .update(schema.entitlements)
          .set({ status: "REDEEMED" })
          .where(eq(schema.entitlements.id, entId))
          .run();

        succeeded.push({ id: entId, itemName: entitlement.itemName });
      }
    });
  } catch (err: any) {
    throw new Error(`Batch redemption failed: ${err.message}`);
  }

  return {
    success: succeeded.length > 0,
    totalAttempted: entitlementIds.length,
    succeededCount: succeeded.length,
    failedCount: failed.length,
    succeeded,
    failed,
  };
}

export async function getStaffScanHistory(staffUserId: number, limit: number = 30) {
  return await db
    .select({
      id: schema.redemptionRecords.id,
      scannedAt: schema.redemptionRecords.scannedAt,
      scanMethod: schema.redemptionRecords.scanMethod,
      notes: schema.redemptionRecords.notes,
      itemName: schema.entitlements.itemName,
      mealSlot: schema.entitlements.mealSlot,
      applicableDate: schema.entitlements.applicableDate,
      studentId: schema.students.studentId,
      studentName: schema.users.fullName,
      department: schema.students.department,
      roomNumber: schema.students.roomNumber,
    })
    .from(schema.redemptionRecords)
    .innerJoin(
      schema.entitlements,
      eq(schema.redemptionRecords.entitlementId, schema.entitlements.id)
    )
    .innerJoin(
      schema.students,
      eq(schema.redemptionRecords.studentId, schema.students.id)
    )
    .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
    .where(eq(schema.redemptionRecords.staffUserId, staffUserId))
    .orderBy(sql`redemption_records.id DESC`)
    .limit(limit)
    .all();
}
