import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { db, client } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { generateSecureQrToken } from "../src/services/qrService.js";
import { submitUnifiedMonthlyEnrolment } from "../src/services/monthlyEnrolmentService.js";

export async function importStudentDataset(csvPath: string, targetMonthYear = "2026-12") {
  console.log(`\n=================================================`);
  console.log(`📥 Starting Student Dataset Import from: ${csvPath}`);
  console.log(`📅 Target Subscription Month: ${targetMonthYear}`);
  console.log(`=================================================`);

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`);
  }

  const rawCsv = fs.readFileSync(csvPath, "utf8");
  const lines = rawCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV file does not contain valid data rows.");
  }

  const header = lines[0].split(",").map((h) => h.trim());
  console.log(`Header fields (${header.length}):`, header.join(" | "));

  // Add-on code mapping
  // South (Coupon), North (Coupon), Milk, Egg, Chicken, Fish, Icecream
  const addonCodeMap: Record<string, string> = {
    Milk: "MILK",
    Egg: "EGG",
    Chicken: "CHICKEN",
    Fish: "FISH",
    Icecream: "ICE_CREAM",
  };

  // Pre-load Messes
  const messes = await db.select().from(schema.messes).all();
  const southMess = messes.find((m) => m.code === "SOUTH") || messes[0];
  const northMess = messes.find((m) => m.code === "NORTH") || messes[1];

  // Pre-load Addons
  const addons = await db.select().from(schema.addons).all();
  const addonByCode = new Map(addons.map((a) => [a.code, a]));

  // Default initial password hash for imported students
  const defaultPasswordHash = await bcrypt.hash("Password@123", 10);

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let invalidCount = 0;
  const invalidReasons: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map((c) => c.trim());
    if (row.length < 12) {
      invalidCount++;
      invalidReasons.push(`Row ${i + 1}: incomplete columns (found ${row.length}, expected 12)`);
      continue;
    }

    const [
      name,
      email,
      courseRaw,
      department,
      semesterRaw,
      southCoupon,
      northCoupon,
      milk,
      egg,
      chicken,
      fish,
      icecream,
    ] = row;

    // Validate course
    const course = courseRaw.toUpperCase();
    const validCourses = ["PU", "BTECH", "BBA", "MBA"];
    if (!validCourses.includes(course)) {
      invalidCount++;
      invalidReasons.push(`Row ${i + 1} (${email}): Invalid course '${course}'`);
      continue;
    }

    // Validate mess coupon selection: exactly one must be YES
    const isSouth = southCoupon.toUpperCase() === "YES";
    const isNorth = northCoupon.toUpperCase() === "YES";
    if ((isSouth && isNorth) || (!isSouth && !isNorth)) {
      invalidCount++;
      invalidReasons.push(`Row ${i + 1} (${email}): Must select exactly one mess (South: ${southCoupon}, North: ${northCoupon})`);
      continue;
    }

    const selectedMessId = isSouth ? southMess.id : northMess.id;
    const semester = parseInt(semesterRaw, 10) || 1;
    const normalizedEmail = email.toLowerCase();

    // Generate student ID from email or index
    let studentIdStr = "";
    if (normalizedEmail.includes("@nmamit.in")) {
      studentIdStr = normalizedEmail.split("@")[0].toUpperCase();
    } else {
      const match = normalizedEmail.match(/student(\d+)/i);
      const numStr = match ? match[1].padStart(3, "0") : String(i).padStart(3, "0");
      studentIdStr = `2026${course}${numStr}`;
    }

    // Database atomic operation per record
    try {
      // 1. Check or insert User
      let existingUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, normalizedEmail))
        .limit(1)
        .get();

      let userId: number;
      if (!existingUser) {
        const newUser = await db
          .insert(schema.users)
          .values({
            email: normalizedEmail,
            passwordHash: defaultPasswordHash,
            fullName: name,
            role: "student",
          })
          .returning()
          .get();
        userId = newUser.id;
        insertedCount++;
      } else {
        userId = existingUser.id;
        // Keep fullName up to date
        await db
          .update(schema.users)
          .set({ fullName: name })
          .where(eq(schema.users.id, userId));
        updatedCount++;
      }

      // 2. Check or insert Student Profile
      let existingStudent = await db
        .select()
        .from(schema.students)
        .where(eq(schema.students.userId, userId))
        .limit(1)
        .get();

      let studentDbId: number;
      const deptWithCourse = `${course} - ${department}`;

      if (!existingStudent) {
        const qrToken = generateSecureQrToken(studentIdStr);
        const newStudent = await db
          .insert(schema.students)
          .values({
            userId,
            studentId: studentIdStr,
            department: deptWithCourse,
            semester,
            roomNumber: `H-${100 + (i % 80)}`,
            phone: `+91 98765 ${String(10000 + i).slice(1)}`,
            qrToken,
          })
          .returning()
          .get();
        studentDbId = newStudent.id;

        // Give initial student advance payment if no ledger exists
        await db.insert(schema.financialLedger).values({
          studentId: studentDbId,
          transactionType: "ADVANCE_PAYMENT",
          amount: 35000,
          balanceAfter: 35000,
          referenceId: `INIT-ADVANCE-${studentIdStr}`,
          referenceType: "payment",
          adjustmentReason: "Semester mess advance deposit",
        });
      } else {
        studentDbId = existingStudent.id;
        // Update semester/department
        await db
          .update(schema.students)
          .set({
            department: deptWithCourse,
            semester,
          })
          .where(eq(schema.students.id, studentDbId));
      }

      // 3. Prepare addonPlans for targetMonthYear
      const addonSelectionsMap: Record<string, string> = {
        Milk: milk,
        Egg: egg,
        Chicken: chicken,
        Fish: fish,
        Icecream: icecream,
      };

      const addonPlans: Array<{ addonId: number; optIn: boolean }> = [];
      for (const [nameKey, optValue] of Object.entries(addonSelectionsMap)) {
        const code = addonCodeMap[nameKey];
        const addonObj = addonByCode.get(code);
        if (addonObj) {
          addonPlans.push({
            addonId: addonObj.id,
            optIn: optValue.toUpperCase() === "YES",
          });
        }
      }

      // 4. Enroll in target month (e.g. 2026-12)
      await submitUnifiedMonthlyEnrolment({
        studentDbId,
        monthYear: targetMonthYear,
        messId: selectedMessId,
        addonPlans,
        overrideReason: "Bulk initial dataset enrolment",
      });
    } catch (err: any) {
      console.error(`Error processing row ${i + 1} (${email}):`, err.message);
      invalidCount++;
      invalidReasons.push(`Row ${i + 1} (${email}): ${err.message}`);
    }
  }

  console.log(`\n=================================================`);
  console.log(`📊 Import Report Summary:`);
  console.log(`   Total Rows Processed: ${lines.length - 1}`);
  console.log(`   New Users Created:   ${insertedCount}`);
  console.log(`   Users Preserved/Upd: ${updatedCount}`);
  console.log(`   Invalid/Failed:      ${invalidCount}`);
  if (invalidReasons.length > 0) {
    console.log(`   Warnings/Failures:`);
    invalidReasons.forEach((r) => console.log(`     - ${r}`));
  }
  console.log(`=================================================\n`);

  return {
    total: lines.length - 1,
    inserted: insertedCount,
    updated: updatedCount,
    invalid: invalidCount,
    errors: invalidReasons,
  };
}

// Allow direct CLI execution: npx tsx scripts/importDataset.ts
if (process.argv[1]?.includes("importDataset")) {
  const csvArg = process.argv[2] || path.resolve(process.cwd(), "data/students_dataset.csv");
  const monthArg = process.argv[3] || "2026-12";
  importStudentDataset(csvArg, monthArg)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Dataset import fatal error:", err);
      process.exit(1);
    });
}
