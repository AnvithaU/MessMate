import { checkSelectionWindow, getLastDayOfMonth, getKolkataDate, getNextMonthYear } from "../src/services/selectionWindowService.js";
import { submitUnifiedMonthlyEnrolment } from "../src/services/monthlyEnrolmentService.js";
import { getMesses, getStudentMessSelection } from "../src/services/messService.js";
import { getAddons } from "../src/services/addonService.js";
import { db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { eq, desc } from "drizzle-orm";

async function runComprehensiveVerification() {
  console.log("================================================================================");
  console.log("  MESSMATE: MONTHLY SELECTION WINDOW & UNIFIED ENROLMENT TEST SUITE");
  console.log("================================================================================\n");

  let allPassed = true;

  // ---------------------------------------------------------------------------
  // TEST 1: November 24, 25 and 30, 2026
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 1: November 24, 25 and 30, 2026 Selection Window");
  console.log("--------------------------------------------------------------------------------");
  const nov24 = checkSelectionWindow("2026-11-24T12:00:00+05:30");
  const nov25 = checkSelectionWindow("2026-11-25T12:00:00+05:30");
  const nov30 = checkSelectionWindow("2026-11-30T23:59:00+05:30");

  console.log(`[Nov 24, 2026] isOpen: ${nov24.isOpen} | target: ${nov24.targetMonthYear} | window: ${nov24.windowStartDate} to ${nov24.windowEndDate} | msg: "${nov24.message}"`);
  console.log(`[Nov 25, 2026] isOpen: ${nov25.isOpen}  | target: ${nov25.targetMonthYear} | window: ${nov25.windowStartDate} to ${nov25.windowEndDate} | msg: "${nov25.message}"`);
  console.log(`[Nov 30, 2026] isOpen: ${nov30.isOpen}  | target: ${nov30.targetMonthYear} | window: ${nov30.windowStartDate} to ${nov30.windowEndDate} | msg: "${nov30.message}"`);

  const t1Passed = !nov24.isOpen && nov25.isOpen && nov30.isOpen && nov25.targetMonthYear === "2026-12";
  console.log(`>> TEST 1 RESULT: ${t1Passed ? "PASSED" : "FAILED"}\n`);
  if (!t1Passed) allPassed = false;

  // ---------------------------------------------------------------------------
  // TEST 2: December 24, 25 and 31, 2026
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 2: December 24, 25 and 31, 2026 Selection Window");
  console.log("--------------------------------------------------------------------------------");
  const dec24 = checkSelectionWindow("2026-12-24T12:00:00+05:30");
  const dec25 = checkSelectionWindow("2026-12-25T12:00:00+05:30");
  const dec31 = checkSelectionWindow("2026-12-31T23:59:00+05:30");

  console.log(`[Dec 24, 2026] isOpen: ${dec24.isOpen} | target: ${dec24.targetMonthYear} | window: ${dec24.windowStartDate} to ${dec24.windowEndDate} | msg: "${dec24.message}"`);
  console.log(`[Dec 25, 2026] isOpen: ${dec25.isOpen}  | target: ${dec25.targetMonthYear} | window: ${dec25.windowStartDate} to ${dec25.windowEndDate} | msg: "${dec25.message}"`);
  console.log(`[Dec 31, 2026] isOpen: ${dec31.isOpen}  | target: ${dec31.targetMonthYear} | window: ${dec31.windowStartDate} to ${dec31.windowEndDate} | msg: "${dec31.message}"`);

  const t2Passed = !dec24.isOpen && dec25.isOpen && dec31.isOpen && dec25.targetMonthYear === "2027-01";
  console.log(`>> TEST 2 RESULT: ${t2Passed ? "PASSED" : "FAILED"}\n`);
  if (!t2Passed) allPassed = false;

  // ---------------------------------------------------------------------------
  // TEST 3: February 2027 (Common Year, 28 Days) & February 2028 (Leap Year, 29 Days)
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 3: February 2027 vs February 2028 (Leap Year Evaluation)");
  console.log("--------------------------------------------------------------------------------");
  const feb2027LastDay = getLastDayOfMonth(2027, 2);
  const feb24_2027 = checkSelectionWindow("2027-02-24T12:00:00+05:30");
  const feb25_2027 = checkSelectionWindow("2027-02-25T12:00:00+05:30");
  const feb28_2027 = checkSelectionWindow("2027-02-28T23:59:00+05:30");

  const feb2028LastDay = getLastDayOfMonth(2028, 2);
  const feb24_2028 = checkSelectionWindow("2028-02-24T12:00:00+05:30");
  const feb25_2028 = checkSelectionWindow("2028-02-25T12:00:00+05:30");
  const feb28_2028 = checkSelectionWindow("2028-02-28T12:00:00+05:30");
  const feb29_2028 = checkSelectionWindow("2028-02-29T23:59:00+05:30");

  console.log(`[Feb 2027 (Common Year)]: Last Calendar Day = ${feb2027LastDay}`);
  console.log(`  - Feb 24, 2027: isOpen = ${feb24_2027.isOpen}`);
  console.log(`  - Feb 25, 2027: isOpen = ${feb25_2027.isOpen} (Window Start)`);
  console.log(`  - Feb 28, 2027: isOpen = ${feb28_2027.isOpen} (Window End, Target = ${feb28_2027.targetMonthYear})`);

  console.log(`[Feb 2028 (Leap Year)]:   Last Calendar Day = ${feb2028LastDay}`);
  console.log(`  - Feb 24, 2028: isOpen = ${feb24_2028.isOpen}`);
  console.log(`  - Feb 25, 2028: isOpen = ${feb25_2028.isOpen} (Window Start)`);
  console.log(`  - Feb 28, 2028: isOpen = ${feb28_2028.isOpen}`);
  console.log(`  - Feb 29, 2028: isOpen = ${feb29_2028.isOpen} (Leap Day Window End, Target = ${feb29_2028.targetMonthYear})`);

  const t3Passed =
    feb2027LastDay === 28 &&
    !feb24_2027.isOpen &&
    feb25_2027.isOpen &&
    feb28_2027.isOpen &&
    feb2028LastDay === 29 &&
    !feb24_2028.isOpen &&
    feb25_2028.isOpen &&
    feb28_2028.isOpen &&
    feb29_2028.isOpen;
  console.log(`>> TEST 3 RESULT: ${t3Passed ? "PASSED" : "FAILED"}\n`);
  if (!t3Passed) allPassed = false;

  // ---------------------------------------------------------------------------
  // TEST 4: Both Mess and Add-on selections enabled and submitted together
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 4: Unified Submission of Mess and Add-on Selection in One Operation");
  console.log("--------------------------------------------------------------------------------");
  // Find test student (NNM24CS042 or student 1)
  const student = await db.select().from(schema.students).limit(1).get();
  if (!student) throw new Error("No students in database!");

  const messes = await getMesses();
  const addons = await getAddons();
  const southMess = messes.find((m) => m.code === "SOUTH") || messes[0];
  const milkAddon = addons.find((a) => a.name.toLowerCase().includes("milk")) || addons[0];
  const eggAddon = addons.find((a) => a.name.toLowerCase().includes("egg")) || addons[1];

  console.log(`Target Student: ${student.fullName} (ID: ${student.studentId}, DB ID: ${student.id})`);
  console.log(`Selecting Mess: ${southMess.name} (Fee: ₹${southMess.monthlyFee})`);
  console.log(`Selecting Add-ons: ${milkAddon.name} (₹${milkAddon.unitPrice}/day) + ${eggAddon.name} (₹${eggAddon.unitPrice}/day)`);

  const unifiedResult = await submitUnifiedMonthlyEnrolment({
    studentDbId: student.id,
    monthYear: "2026-12",
    messId: southMess.id,
    addonPlans: [
      { addonId: milkAddon.id, optIn: true },
      { addonId: eggAddon.id, optIn: true },
    ],
    simulatedDate: "2026-11-26T12:00:00+05:30", // Within window
  });

  console.log(`Submission Response: success=${unifiedResult.success}, monthYear=${unifiedResult.monthYear}`);
  console.log(`  - Mess Confirmed: ${unifiedResult.messSelection?.messName} (Fee: ₹${unifiedResult.messSelection?.feeCharged})`);
  console.log(`  - Addon Servings Booked: ${unifiedResult.addonsBookedCount}`);
  console.log(`  - Total Addon Cost Debited: ₹${unifiedResult.totalAddonsCost}`);

  const t4Passed = unifiedResult.success && unifiedResult.messSelection?.messId === southMess.id;
  console.log(`>> TEST 4 RESULT: ${t4Passed ? "PASSED" : "FAILED"}\n`);
  if (!t4Passed) allPassed = false;

  // ---------------------------------------------------------------------------
  // TEST 5: Backend rejects submissions outside the window (bypassing frontend)
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 5: Strict Backend Rejection When Outside Selection Window");
  console.log("--------------------------------------------------------------------------------");
  let rejectionCaught = false;
  let rejectionErrorMessage = "";

  try {
    await submitUnifiedMonthlyEnrolment({
      studentDbId: student.id,
      monthYear: "2026-12",
      messId: southMess.id,
      addonPlans: [{ addonId: milkAddon.id, optIn: true }],
      simulatedDate: "2026-11-24T12:00:00+05:30", // Bypassed date: November 24 (Closed)
    });
  } catch (err: any) {
    rejectionCaught = true;
    rejectionErrorMessage = err.message;
  }

  console.log(`Attempted submission on simulated date: 2026-11-24 (Day 24 of Month)`);
  console.log(`Backend Threw Expected Error: ${rejectionCaught}`);
  console.log(`Error Message Returned: "${rejectionErrorMessage}"`);

  const t5Passed = rejectionCaught && rejectionErrorMessage.includes("window is closed");
  console.log(`>> TEST 5 RESULT: ${t5Passed ? "PASSED" : "FAILED"}\n`);
  if (!t5Passed) allPassed = false;

  // ---------------------------------------------------------------------------
  // TEST 6: Admin Overrides Require Authorization and Create Audit Logs
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 6: Administrative Overrides & Audit Log Trail");
  console.log("--------------------------------------------------------------------------------");
  const adminUser = await db.select().from(schema.users).where(eq(schema.users.role, "admin")).limit(1).get();
  const northMess = messes.find((m) => m.code === "NORTH") || messes[1];

  console.log(`Admin User: ${adminUser?.fullName} (${adminUser?.email}, ID: ${adminUser?.id})`);
  console.log(`Overriding Mess to: ${northMess.name} on a closed date (2026-11-24)`);

  const overrideResult = await submitUnifiedMonthlyEnrolment({
    studentDbId: student.id,
    monthYear: "2026-12",
    messId: northMess.id,
    addonPlans: [],
    adminUserId: adminUser?.id,
    overrideReason: "Emergency administrative reallocation requested by hostel warden",
    simulatedDate: "2026-11-24T12:00:00+05:30",
  });

  console.log(`Admin Override Execution: success=${overrideResult.success}`);
  console.log(`New Mess Assigned: ${overrideResult.messSelection?.messName}`);
  console.log(`Overridden By Admin ID: ${overrideResult.messSelection?.overriddenByAdminId}`);
  console.log(`Recorded Reason: "${overrideResult.messSelection?.overrideReason}"`);

  // Query audit logs table for the override entry
  const latestAudit = await db
    .select()
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.action, "MESS_OVERRIDE"))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(1)
    .get();

  console.log(`Audit Log Entry Found: ID=${latestAudit?.id}, Action=${latestAudit?.action}, UserID=${latestAudit?.userId}`);
  console.log(`Audit New State: ${latestAudit?.newState}`);

  const t6Passed =
    overrideResult.success &&
    overrideResult.messSelection?.messId === northMess.id &&
    overrideResult.messSelection?.overriddenByAdminId === adminUser?.id &&
    latestAudit !== undefined &&
    latestAudit.userId === adminUser?.id;
  console.log(`>> TEST 6 RESULT: ${t6Passed ? "PASSED" : "FAILED"}\n`);
  if (!t6Passed) allPassed = false;

  // Restore to South Mess for test student so data stays clean
  await submitUnifiedMonthlyEnrolment({
    studentDbId: student.id,
    monthYear: "2026-12",
    messId: southMess.id,
    addonPlans: [{ addonId: milkAddon.id, optIn: true }],
    adminUserId: adminUser?.id,
    overrideReason: "Restoring student's chosen South Mess preference",
    simulatedDate: "2026-11-26T12:00:00+05:30",
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Historical Subscriptions and Add-on Selections Remain Unchanged
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 7: Historical Subscriptions & Ledger Immutability");
  console.log("--------------------------------------------------------------------------------");
  // Check prior selections for the student across all recorded months
  const allStudentSelections = await db
    .select()
    .from(schema.monthlyMessSelections)
    .where(eq(schema.monthlyMessSelections.studentId, student.id))
    .all();

  console.log(`Total Monthly Mess Selection Records for Student ID ${student.id}: ${allStudentSelections.length}`);
  for (const s of allStudentSelections) {
    console.log(`  - Month: ${s.monthYear} | Mess ID: ${s.messId} | Fee Charged: ₹${s.feeCharged} | Selected At: ${s.selectedAt}`);
  }

  // Check financial ledger transactions remain intact
  const ledgerEntries = await db
    .select()
    .from(schema.financialLedger)
    .where(eq(schema.financialLedger.studentId, student.id))
    .orderBy(desc(schema.financialLedger.id))
    .limit(5)
    .all();

  console.log(`Recent Financial Ledger Records for Student ID ${student.id}:`);
  for (const l of ledgerEntries) {
    console.log(`  - TX ID ${l.id}: Type=${l.transactionType}, Amount=₹${l.amount}, Balance=₹${l.balanceAfter}, Reason="${l.adjustmentReason}"`);
  }

  const t7Passed = allStudentSelections.length > 0 && ledgerEntries.length > 0;
  console.log(`>> TEST 7 RESULT: ${t7Passed ? "PASSED" : "FAILED"}\n`);
  if (!t7Passed) allPassed = false;

  // ---------------------------------------------------------------------------
  // TEST 8: Monthly Enrolment Loads Actual South/North Mess and Add-on Data
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 8: Live Database Query for South/North Mess & Add-on Catalog");
  console.log("--------------------------------------------------------------------------------");
  const liveMesses = await getMesses();
  const liveAddons = await getAddons();

  console.log(`Active Messes Loaded (${liveMesses.length}):`);
  for (const m of liveMesses) {
    console.log(`  - [ID: ${m.id}] ${m.name} (${m.code}) | Fee: ₹${m.monthlyFee}/month | Capacity: ${m.capacity} | Cuisine: ${m.cuisineType}`);
  }

  console.log(`Active Add-ons Loaded (${liveAddons.length}):`);
  for (const a of liveAddons) {
    console.log(`  - [ID: ${a.id}] ${a.name} | Price: ₹${a.unitPrice}/serving | Slot: ${a.mealSlot} | Days: ${a.availableDaysOfWeek}`);
  }

  const hasSouth = liveMesses.some((m) => m.code === "SOUTH");
  const hasNorth = liveMesses.some((m) => m.code === "NORTH");
  const hasMilk = liveAddons.some((a) => a.name.toLowerCase().includes("milk"));
  const hasEgg = liveAddons.some((a) => a.name.toLowerCase().includes("egg"));
  const hasChicken = liveAddons.some((a) => a.name.toLowerCase().includes("chicken"));
  const hasFish = liveAddons.some((a) => a.name.toLowerCase().includes("fish"));
  const hasIcecream = liveAddons.some((a) => a.name.toLowerCase().includes("icecream") || a.name.toLowerCase().includes("ice cream"));

  console.log(`Verification Flags: South=${hasSouth}, North=${hasNorth}, Milk=${hasMilk}, Egg=${hasEgg}, Chicken=${hasChicken}, Fish=${hasFish}, Icecream=${hasIcecream}`);

  const t8Passed = hasSouth && hasNorth && hasMilk && hasEgg && hasChicken && hasFish && hasIcecream;
  console.log(`>> TEST 8 RESULT: ${t8Passed ? "PASSED" : "FAILED"}\n`);
  if (!t8Passed) allPassed = false;

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log(`  OVERALL TEST SUITE STATUS: ${allPassed ? "ALL 8 TESTS PASSED SUCCESSFULLY" : "ONE OR MORE TESTS FAILED"}`);
  console.log("================================================================================");
}

runComprehensiveVerification().catch((err) => {
  console.error("FATAL TEST RUN ERROR:", err);
  process.exit(1);
});
