import bcrypt from "bcryptjs";
import { client, db } from "./index.js";
import * as schema from "./schema.js";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  // Check if users already seeded
  const existingUsers = await db.select().from(schema.users).limit(1);
  if (existingUsers.length > 0) {
    // Migrate legacy @messmate.edu emails to NMAMIT domains if still present
    const allUsers = await db.select().from(schema.users).all();
    for (const u of allUsers) {
      if (u.email.endsWith("@messmate.edu")) {
        const local = u.email.split("@")[0];
        const newDomain =
          u.role === "admin"
            ? "@admin.nmamit.in"
            : u.role === "staff"
            ? "@staff.nmamit.in"
            : "@nmamit.in";
        await db
          .update(schema.users)
          .set({ email: `${local}${newDomain}` })
          .where(eq(schema.users.id, u.id));
      }
    }
    console.log("Database already contains data. Skipping initial seed.");
    return;
  }

  console.log("Seeding MessMate database with initial realistic data...");

  // Password hashes
  const passwordHash = await bcrypt.hash("password123", 10);
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const staffPasswordHash = await bcrypt.hash("staff123", 10);

  // 1. Seed Semesters
  const semester = await db
    .insert(schema.semesters)
    .values({
      name: "Fall 2026",
      academicYear: "2026-2027",
      startDate: "2026-08-01",
      endDate: "2026-12-31",
      isCurrent: 1,
      defaultAdvanceOneSem: 25000,
      defaultAdvanceTwoSem: 50000,
    })
    .returning()
    .get();

  // 2. Seed Messes
  const southMess = await db
    .insert(schema.messes)
    .values({
      code: "SOUTH",
      name: "South Mess",
      description:
        "Authentic South Indian & Coastal culinary experience: Sambar, Rasam, curd, soft idlis, dosas, fresh coconut chutney, avial, ghee pongal, steamed Kerala matta rice, and filter coffee.",
      monthlyFee: 3800,
      cuisineType: "South Indian & Coastal",
      dailyMealCount: 3,
      isActive: 1,
      imageUrl: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=800&q=80",
    })
    .returning()
    .get();

  const northMess = await db
    .insert(schema.messes)
    .values({
      code: "NORTH",
      name: "North Mess",
      description:
        "Hearty North Indian & Punjabi fare: Creamy Dal Makhani, Paneer butter masala, tandoori rotis, fragrant jeera rice, seasonal subzis, Punjabi kadhi, cooling chaas, and sweet gulab jamun.",
      monthlyFee: 3950,
      cuisineType: "North Indian & Punjabi",
      dailyMealCount: 3,
      isActive: 1,
      imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
    })
    .returning()
    .get();

  // 3. Seed Monthly Mess Windows
  await db.insert(schema.monthlyMessWindows).values([
    {
      semesterId: semester.id,
      monthYear: "2026-11",
      openDate: "2026-10-20",
      deadlineDate: "2026-10-31",
      lockDate: "2026-11-01",
      isLocked: 0,
    },
    {
      semesterId: semester.id,
      monthYear: "2026-12",
      openDate: "2026-11-20",
      deadlineDate: "2026-11-30",
      lockDate: "2026-12-01",
      isLocked: 0,
    },
  ]);

  // 4. Seed Addons
  const addonsData = [
    {
      code: "MILK",
      name: "Farm Fresh Milk (250ml)",
      description: "Pasteurized, high-protein whole milk served warm.",
      unitPrice: 25,
      availableDaysOfWeek: "DAILY",
      mealSlot: "DINNER" as const,
      maxDailyCapacity: 400,
      isActive: 1,
      iconName: "Milk",
    },
    {
      code: "EGG",
      name: "Boiled Farm Eggs (Pair)",
      description: "Two freshly boiled farm eggs sprinkled with fresh crushed black pepper.",
      unitPrice: 20,
      availableDaysOfWeek: "DAILY",
      mealSlot: "LUNCH" as const,
      maxDailyCapacity: 350,
      isActive: 1,
      iconName: "Egg",
    },
    {
      code: "FISH",
      name: "Coastal Fish Fry / Curry",
      description: "Crispy rava-fried or masala simmered fresh catch with coastal spices.",
      unitPrice: 85,
      availableDaysOfWeek: "MON,WED,SAT",
      mealSlot: "DINNER" as const,
      maxDailyCapacity: 200,
      isActive: 1,
      iconName: "Fish",
    },
    {
      code: "ICE_CREAM",
      name: "Gourmet Ice Cream Cup",
      description: "Choice of Belgian Dark Chocolate, Alphonso Mango, or Malai Kulfi.",
      unitPrice: 50,
      availableDaysOfWeek: "TUE",
      mealSlot: "DINNER" as const,
      maxDailyCapacity: 300,
      isActive: 1,
      iconName: "IceCream",
    },
    {
      code: "CHICKEN",
      name: "Tandoori Chicken Roast",
      description: "Juicy chicken roasted in clay tandoor with mint dip and sliced onions.",
      unitPrice: 90,
      availableDaysOfWeek: "TUE,THU,SUN",
      mealSlot: "DINNER" as const,
      maxDailyCapacity: 250,
      isActive: 1,
      iconName: "Drumstick",
    },
  ];

  const insertedAddons = [];
  for (const a of addonsData) {
    const res = await db.insert(schema.addons).values(a).returning().get();
    insertedAddons.push(res);
  }

  // 5. Seed Admin and Staff Users
  const adminUser = await db
    .insert(schema.users)
    .values({
      email: "warden@admin.nmamit.in",
      passwordHash: adminPasswordHash,
      fullName: "Dr. K. Ramanathan",
      role: "admin",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80",
    })
    .returning()
    .get();

  const staffUser = await db
    .insert(schema.users)
    .values({
      email: "staff@staff.nmamit.in",
      passwordHash: staffPasswordHash,
      fullName: "Rajesh Kumar (Staff)",
      role: "staff",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
    })
    .returning()
    .get();

  // 6. Seed Students Cohort
  const studentProfiles = [
    {
      email: "aarav.sharma@nmamit.in",
      name: "Aarav Sharma",
      studentId: "2026CSE001",
      dept: "Computer Science & Engineering",
      sem: 5,
      room: "B-304",
      phone: "+91 98765 43210",
      qrToken: "MM-QR-2026CSE001-A9F4",
      advance: 50000,
      paymentType: "TWO_SEMESTERS" as const,
      messChoice: southMess.id,
      messFee: southMess.monthlyFee,
    },
    {
      email: "priya.patel@nmamit.in",
      name: "Priya Patel",
      studentId: "2026ECE042",
      dept: "Electronics & Communication",
      sem: 5,
      room: "A-212",
      phone: "+91 98765 43211",
      qrToken: "MM-QR-2026ECE042-C83E",
      advance: 25000,
      paymentType: "ONE_SEMESTER" as const,
      messChoice: northMess.id,
      messFee: northMess.monthlyFee,
    },
    {
      email: "rohan.iyer@nmamit.in",
      name: "Rohan Iyer",
      studentId: "2026ME089",
      dept: "Mechanical Engineering",
      sem: 3,
      room: "C-105",
      phone: "+91 98765 43212",
      qrToken: "MM-QR-2026ME089-D51A",
      advance: 25000,
      paymentType: "ONE_SEMESTER" as const,
      messChoice: southMess.id,
      messFee: southMess.monthlyFee,
    },
    {
      email: "sneha.reddy@nmamit.in",
      name: "Sneha Reddy",
      studentId: "2026BT015",
      dept: "Biotechnology",
      sem: 7,
      room: "D-401",
      phone: "+91 98765 43213",
      qrToken: "MM-QR-2026BT015-E79B",
      advance: 35000,
      paymentType: "CUSTOM_ADVANCE" as const,
      messChoice: northMess.id,
      messFee: northMess.monthlyFee,
    },
    {
      email: "vikram.malhotra@nmamit.in",
      name: "Vikram Malhotra",
      studentId: "2026CE033",
      dept: "Civil Engineering",
      sem: 5,
      room: "B-108",
      phone: "+91 98765 43214",
      qrToken: "MM-QR-2026CE033-F12C",
      advance: 25000,
      paymentType: "ONE_SEMESTER" as const,
      messChoice: southMess.id,
      messFee: southMess.monthlyFee,
    },
    {
      email: "ananya.verma@nmamit.in",
      name: "Ananya Verma",
      studentId: "2026EE028",
      dept: "Electrical Engineering",
      sem: 3,
      room: "A-315",
      phone: "+91 98765 43215",
      qrToken: "MM-QR-2026EE028-G63D",
      advance: 50000,
      paymentType: "TWO_SEMESTERS" as const,
      messChoice: northMess.id,
      messFee: northMess.monthlyFee,
    },
    {
      email: "karthik.rajan@nmamit.in",
      name: "Karthik Rajan",
      studentId: "2026CH051",
      dept: "Chemical Engineering",
      sem: 7,
      room: "C-209",
      phone: "+91 98765 43216",
      qrToken: "MM-QR-2026CH051-H47E",
      advance: 25000,
      paymentType: "ONE_SEMESTER" as const,
      messChoice: southMess.id,
      messFee: southMess.monthlyFee,
    },
    {
      email: "divya.nair@nmamit.in",
      name: "Divya Nair",
      studentId: "2026IT019",
      dept: "Information Technology",
      sem: 5,
      room: "D-112",
      phone: "+91 98765 43217",
      qrToken: "MM-QR-2026IT019-J82F",
      advance: 25000,
      paymentType: "ONE_SEMESTER" as const,
      messChoice: southMess.id,
      messFee: southMess.monthlyFee,
    },
  ];

  const currentDateStr = "2026-11-25";

  for (const p of studentProfiles) {
    // 1. Create User
    const userRec = await db
      .insert(schema.users)
      .values({
        email: p.email,
        passwordHash,
        fullName: p.name,
        role: "student",
      })
      .returning()
      .get();

    // 2. Create Student profile
    const studentRec = await db
      .insert(schema.students)
      .values({
        userId: userRec.id,
        studentId: p.studentId,
        department: p.dept,
        semester: p.sem,
        roomNumber: p.room,
        phone: p.phone,
        qrToken: p.qrToken,
      })
      .returning()
      .get();

    // 3. Payment record
    const ref = `TXN-${p.studentId}-${Date.now().toString().slice(-6)}`;
    const rcpt = `RCP-${p.studentId.slice(-4)}-2026`;
    await db.insert(schema.payments).values({
      studentId: studentRec.id,
      semesterId: semester.id,
      amount: p.advance,
      paymentMode: "UPI",
      paymentType: p.paymentType,
      transactionReference: ref,
      receiptNumber: rcpt,
      recordedByUserId: adminUser.id,
    });

    let runningBalance = p.advance;

    // 4. Ledger: Advance payment credit
    await db.insert(schema.financialLedger).values({
      studentId: studentRec.id,
      transactionType: "ADVANCE_PAYMENT",
      amount: p.advance,
      balanceAfter: runningBalance,
      referenceId: ref,
      referenceType: "payment",
      recordedByUserId: adminUser.id,
      adjustmentReason: `Initial semester advance payment (${p.paymentType})`,
    });

    // 5. Monthly Mess Selection for November 2026
    const messSel = await db
      .insert(schema.monthlyMessSelections)
      .values({
        studentId: studentRec.id,
        monthYear: "2026-11",
        messId: p.messChoice,
        feeCharged: p.messFee,
      })
      .returning()
      .get();

    runningBalance -= p.messFee;

    // Ledger: Monthly Mess Charge debit
    await db.insert(schema.financialLedger).values({
      studentId: studentRec.id,
      transactionType: "MONTHLY_MESS_CHARGE",
      amount: -p.messFee,
      balanceAfter: runningBalance,
      referenceId: `MESS-2026-11-${messSel.id}`,
      referenceType: "monthly_mess",
      recordedByUserId: adminUser.id,
      adjustmentReason: `Monthly Mess enrolment fee for November 2026 (${p.messChoice === southMess.id ? "South Mess" : "North Mess"})`,
    });

    // 6. Entitlement: Today's Mess Lunch
    const messMealName =
      p.messChoice === southMess.id ? "South Mess Lunch" : "North Mess Lunch";
    await db.insert(schema.entitlements).values({
      studentId: studentRec.id,
      entitlementType: "MESS_MEAL",
      referenceId: messSel.id,
      itemName: messMealName,
      applicableDate: currentDateStr,
      mealSlot: "LUNCH",
      status: "AVAILABLE",
    });

    // 7. Addon selections for primary demo student Aarav
    if (p.studentId === "2026CSE001") {
      const milkAddon = insertedAddons.find((a) => a.code === "MILK")!;
      const eggAddon = insertedAddons.find((a) => a.code === "EGG")!;

      // Aarav selects Milk for today
      const addonSel1 = await db
        .insert(schema.addonSelections)
        .values({
          studentId: studentRec.id,
          addonId: milkAddon.id,
          specificDate: currentDateStr,
          mealSlot: "BREAKFAST",
          unitPrice: milkAddon.unitPrice,
          status: "CONFIRMED",
        })
        .returning()
        .get();

      runningBalance -= milkAddon.unitPrice;

      await db.insert(schema.financialLedger).values({
        studentId: studentRec.id,
        transactionType: "ADDON_CHARGE",
        amount: -milkAddon.unitPrice,
        balanceAfter: runningBalance,
        referenceId: `ADDON-${addonSel1.id}`,
        referenceType: "addon_selection",
        recordedByUserId: adminUser.id,
        adjustmentReason: `Add-on booking: ${milkAddon.name} for ${currentDateStr}`,
      });

      // Milk Entitlement
      await db.insert(schema.entitlements).values({
        studentId: studentRec.id,
        entitlementType: "ADDON",
        referenceId: addonSel1.id,
        itemName: "Milk",
        applicableDate: currentDateStr,
        mealSlot: "BREAKFAST",
        status: "AVAILABLE",
      });

      // Aarav selects Egg for today (Wed Nov 25)
      const addonSel2 = await db
        .insert(schema.addonSelections)
        .values({
          studentId: studentRec.id,
          addonId: eggAddon.id,
          specificDate: currentDateStr,
          mealSlot: "DINNER",
          unitPrice: eggAddon.unitPrice,
          status: "CONFIRMED",
        })
        .returning()
        .get();

      runningBalance -= eggAddon.unitPrice;

      await db.insert(schema.financialLedger).values({
        studentId: studentRec.id,
        transactionType: "ADDON_CHARGE",
        amount: -eggAddon.unitPrice,
        balanceAfter: runningBalance,
        referenceId: `ADDON-${addonSel2.id}`,
        referenceType: "addon_selection",
        recordedByUserId: adminUser.id,
        adjustmentReason: `Add-on booking: ${eggAddon.name} for ${currentDateStr}`,
      });

      // Egg Entitlement
      await db.insert(schema.entitlements).values({
        studentId: studentRec.id,
        entitlementType: "ADDON",
        referenceId: addonSel2.id,
        itemName: "Egg",
        applicableDate: currentDateStr,
        mealSlot: "DINNER",
        status: "AVAILABLE",
      });
    }
  }

  console.log("Seeding completed successfully!");
}
