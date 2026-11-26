/**
 * Direct database test script for the calendar endpoint logic.
 * Tests the calendar data retrieval without HTTP.
 */
import { db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { isDateAllowedForAddon } from "../src/services/addonService.js";
import { getStudentMessSelection } from "../src/services/messService.js";

async function testCalendar(studentId: string, monthYear: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST: Calendar for ${studentId} - ${monthYear}`);
  console.log("=".repeat(60));

  // Find student
  const studentRows = await db
    .select({ id: schema.students.id, studentId: schema.students.studentId })
    .from(schema.students)
    .where(eq(schema.students.studentId, studentId))
    .all();

  if (!studentRows.length) {
    console.log(`ERROR: Student ${studentId} not found!`);
    return;
  }

  const studentDbId = studentRows[0].id;
  console.log(`Student DB ID: ${studentDbId}`);

  const [year, month] = monthYear.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  console.log(`Days in month: ${daysInMonth}`);

  // Load all active add-ons
  const allAddons = await db.select().from(schema.addons).where(eq(schema.addons.isActive, 1)).all();
  console.log(`Active addons: ${allAddons.map((a) => a.name).join(", ")}`);

  // Load add-on selections for this month
  const addonSelectionRows = await db
    .select()
    .from(schema.addonSelections)
    .where(eq(schema.addonSelections.studentId, studentDbId))
    .all();
  const monthSelections = addonSelectionRows.filter((s) => s.specificDate.startsWith(monthYear));
  const optedInAddonIds = new Set(monthSelections.map((s) => s.addonId));
  console.log(`Opted-in addons: ${optedInAddonIds.size} → IDs: [${Array.from(optedInAddonIds).join(",")}]`);

  // Load entitlements for this month
  const entitlementRows = await db
    .select({
      id: schema.entitlements.id,
      entitlementType: schema.entitlements.entitlementType,
      itemName: schema.entitlements.itemName,
      applicableDate: schema.entitlements.applicableDate,
      status: schema.entitlements.status,
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

  console.log(`Entitlement rows for ${monthYear}: ${entitlementRows.length}`);

  const messSelection = await getStudentMessSelection(studentDbId, monthYear);
  console.log(`Mess selection: ${messSelection ? messSelection.messName : "NONE"}`);

  // Sample a few days
  const sampleDays = [1, 7, 15, 25, daysInMonth];
  for (const d of sampleDays) {
    const dayStr = String(d).padStart(2, "0");
    const monthStr = String(month).padStart(2, "0");
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    const dateObj = new Date(dateStr + "T00:00:00Z");
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateObj.getUTCDay()];

    const optedInAddons = allAddons.filter((addon) => optedInAddonIds.has(addon.id));
    const scheduledOptedIn = optedInAddons.filter((addon) =>
      isDateAllowedForAddon(dateStr, addon.availableDaysOfWeek)
    );

    const messEnt = entitlementRows.find(
      (e) => e.entitlementType === "MESS_MEAL" && e.applicableDate === dateStr
    );

    const addonEnts = entitlementRows.filter(
      (e) => e.entitlementType === "ADDON" && e.applicableDate === dateStr
    );

    console.log(`  Day ${d} (${weekday} ${dateStr}): mess=${messEnt?.status || (messSelection ? "AVAILABLE" : "NONE")} addon_ents=${addonEnts.length} scheduled_opted_in=${scheduledOptedIn.map((a) => a.name).join(",") || "none"}`);
  }

  // Count totals
  const availableAddons = entitlementRows.filter(
    (e) => e.entitlementType === "ADDON" && e.status === "AVAILABLE"
  ).length;
  const redeemedAddons = entitlementRows.filter(
    (e) => e.entitlementType === "ADDON" && e.status === "REDEEMED"
  ).length;
  console.log(`\nSummary: ${availableAddons} available addon entitlements, ${redeemedAddons} redeemed`);
}

async function testScannerLookup(studentId: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST: Scanner lookup for ${studentId}`);
  console.log("=".repeat(60));

  const studentRows = await db
    .select({
      id: schema.students.id,
      studentId: schema.students.studentId,
      qrToken: schema.students.qrToken,
    })
    .from(schema.students)
    .where(eq(schema.students.studentId, studentId))
    .all();

  if (!studentRows.length) {
    console.log(`ERROR: Student not found`);
    return;
  }

  const student = studentRows[0];
  console.log(`QR Token: ${student.qrToken}`);

  // Simulate today in Kolkata
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  console.log(`Today (Kolkata): ${today}`);

  // Check today's entitlements
  const todayEnts = await db
    .select({
      id: schema.entitlements.id,
      entitlementType: schema.entitlements.entitlementType,
      itemName: schema.entitlements.itemName,
      mealSlot: schema.entitlements.mealSlot,
      status: schema.entitlements.status,
    })
    .from(schema.entitlements)
    .where(
      and(
        eq(schema.entitlements.studentId, student.id),
        eq(schema.entitlements.applicableDate, today)
      )
    )
    .all();

  console.log(`Today's entitlements (${today}):`);
  if (todayEnts.length === 0) {
    console.log("  NONE");
  }
  for (const ent of todayEnts) {
    console.log(`  [${ent.entitlementType}] ${ent.itemName} (${ent.mealSlot}) → ${ent.status}`);
  }
}

async function testNoAddonStudent() {
  // Find a student who has NO addon bookings for Dec 2026
  const allStudents = await db
    .select({ id: schema.students.id, studentId: schema.students.studentId })
    .from(schema.students)
    .limit(5)
    .all();

  for (const s of allStudents) {
    const sels = await db
      .select()
      .from(schema.addonSelections)
      .where(eq(schema.addonSelections.studentId, s.id))
      .all();
    const dec = sels.filter((x) => x.specificDate.startsWith("2026-12"));
    if (dec.length === 0) {
      console.log(`\nStudent ${s.studentId} has NO Dec 2026 addons — testing NOT_SELECTED status`);
      await testCalendar(s.studentId, "2026-12");
      break;
    }
  }
}

// Run all tests
(async () => {
  try {
    // Test 1: NNM24CS042 (should have milk addon for Dec 2026)
    await testCalendar("NNM24CS042", "2026-12");

    // Test 2: Check Nov 2026 (before enrolment window for Dec — no addons expected)
    await testCalendar("NNM24CS042", "2026-11");

    // Test 3: Scanner lookup
    await testScannerLookup("NNM24CS042");

    // Test 4: Student with no addons
    await testNoAddonStudent();

    console.log("\n✅ ALL TESTS COMPLETE");
    process.exit(0);
  } catch (err) {
    console.error("TEST FAILED:", err);
    process.exit(1);
  }
})();
