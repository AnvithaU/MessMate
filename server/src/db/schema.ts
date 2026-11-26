import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * 1. USERS TABLE
 * Database-defined role column: 'student' | 'admin' | 'staff'
 * Defaults strictly to 'student'.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["student", "admin", "staff"] })
    .notNull()
    .default("student"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});


/**
 * 2. STUDENTS TABLE
 * Holds universal QR identity, department, semester, and hostel room.
 */
export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().unique(), // e.g. 2026CSE001
  department: text("department").notNull(), // e.g. Computer Science
  semester: integer("semester").notNull().default(5),
  roomNumber: text("room_number").notNull(), // e.g. B-304
  phone: text("phone"),
  qrToken: text("qr_token").notNull().unique(), // Secure cryptographic token
  qrIssuedAt: text("qr_issued_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  qrStatus: text("qr_status", { enum: ["ACTIVE", "REVOKED"] })
    .notNull()
    .default("ACTIVE"),
});


/**
 * 3. ACADEMIC SEMESTERS
 */
export const semesters = sqliteTable("semesters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // e.g. Fall 2026
  academicYear: text("academic_year").notNull(), // e.g. 2026-2027
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  isCurrent: integer("is_current").notNull().default(1),
  defaultAdvanceOneSem: real("default_advance_one_sem").notNull().default(25000),
  defaultAdvanceTwoSem: real("default_advance_two_sem").notNull().default(50000),
});


/**
 * 4. MESSES (South Mess and North Mess)
 */
export const messes = sqliteTable("messes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code", { enum: ["SOUTH", "NORTH"] }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  monthlyFee: real("monthly_fee").notNull().default(3800),
  cuisineType: text("cuisine_type").notNull(),
  dailyMealCount: integer("daily_meal_count").notNull().default(3),
  isActive: integer("is_active").notNull().default(1),
  imageUrl: text("image_url"),
});


/**
 * 5. MONTHLY SELECTION WINDOWS
 */
export const monthlyMessWindows = sqliteTable("monthly_mess_windows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  semesterId: integer("semester_id")
    .notNull()
    .references(() => semesters.id),
  monthYear: text("month_year").notNull().unique(), // e.g. 2026-11
  openDate: text("open_date").notNull(),
  deadlineDate: text("deadline_date").notNull(),
  lockDate: text("lock_date").notNull(),
  isLocked: integer("is_locked").notNull().default(0),
});


/**
 * 6. MONTHLY MESS SELECTIONS (Student independent selection per month)
 */
export const monthlyMessSelections = sqliteTable("monthly_mess_selections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id),
  monthYear: text("month_year").notNull(), // e.g. 2026-11
  messId: integer("mess_id")
    .notNull()
    .references(() => messes.id),
  feeCharged: real("fee_charged").notNull(),
  selectedAt: text("selected_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  lockedAt: text("locked_at"),
  overriddenByAdminId: integer("overridden_by_admin_id").references(() => users.id),
  overrideReason: text("override_reason"),
});


/**
 * 7. ADD-ONS MASTER (Milk, Egg, Fish, Ice Cream, Chicken)
 */
export const addons = sqliteTable("addons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(), // MILK, EGG, FISH, ICE_CREAM, CHICKEN
  name: text("name").notNull(),
  description: text("description").notNull(),
  unitPrice: real("unit_price").notNull(),
  availableDaysOfWeek: text("available_days_of_week").notNull(), // 'DAILY' | 'MON,WED,FRI' | 'TUE' | 'THU' | 'SUN'
  mealSlot: text("meal_slot", { enum: ["BREAKFAST", "LUNCH", "DINNER"] }).notNull(),
  maxDailyCapacity: integer("max_daily_capacity").notNull().default(300),
  isActive: integer("is_active").notNull().default(1),
  iconName: text("icon_name"),
});


/**
 * 8. ADD-ON AVAILABILITY OVERRIDES
 */
export const addonAvailabilities = sqliteTable("addon_availabilities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  addonId: integer("addon_id")
    .notNull()
    .references(() => addons.id),
  specificDate: text("specific_date").notNull(), // YYYY-MM-DD
  isAvailable: integer("is_available").notNull().default(1),
  overridePrice: real("override_price"),
  maxCapacity: integer("max_capacity"),
});


/**
 * 9. ADD-ON SELECTIONS (Student specific day bookings)
 */
export const addonSelections = sqliteTable("addon_selections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id),
  addonId: integer("addon_id")
    .notNull()
    .references(() => addons.id),
  specificDate: text("specific_date").notNull(), // YYYY-MM-DD
  mealSlot: text("meal_slot", { enum: ["BREAKFAST", "LUNCH", "DINNER"] }).notNull(),
  unitPrice: real("unit_price").notNull(),
  selectedAt: text("selected_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  status: text("status", { enum: ["CONFIRMED", "CANCELLED"] })
    .notNull()
    .default("CONFIRMED"),
});


/**
 * 10. ENTITLEMENTS (Universal redeemable items)
 */
export const entitlements = sqliteTable("entitlements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id),
  entitlementType: text("entitlement_type", {
    enum: ["MESS_MEAL", "ADDON"],
  }).notNull(),
  referenceId: integer("reference_id"), // monthlyMessSelectionId or addonSelectionId
  itemName: text("item_name").notNull(), // e.g. 'South Mess Lunch', 'Milk', 'Egg'
  applicableDate: text("applicable_date").notNull(), // YYYY-MM-DD
  mealSlot: text("meal_slot", { enum: ["BREAKFAST", "LUNCH", "DINNER"] }).notNull(),
  status: text("status", {
    enum: ["AVAILABLE", "REDEEMED", "EXPIRED", "CANCELLED", "CANCELLED_REBATE"],
  })
    .notNull()
    .default("AVAILABLE"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});


/**
 * 11. REDEMPTION RECORDS (Single scan event per entitlement)
 * Unique constraint on entitlementId guarantees atomic prevention of duplicate redemption.
 */
export const redemptionRecords = sqliteTable("redemption_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entitlementId: integer("entitlement_id")
    .notNull()
    .unique()
    .references(() => entitlements.id),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id),
  staffUserId: integer("staff_user_id")
    .notNull()
    .references(() => users.id),
  scannedAt: text("scanned_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  scanMethod: text("scan_method", { enum: ["CAMERA_QR", "MANUAL_LOOKUP"] })
    .notNull()
    .default("CAMERA_QR"),
  notes: text("notes"),
});


/**
 * 12. PAYMENTS TABLE (Advance fees collected)
 */
export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id),
  semesterId: integer("semester_id")
    .notNull()
    .references(() => semesters.id),
  amount: real("amount").notNull(),
  paymentMode: text("payment_mode", {
    enum: ["ONLINE", "UPI", "NET_BANKING", "CHALLAN", "CASH"],
  }).notNull(),
  paymentType: text("payment_type", {
    enum: ["ONE_SEMESTER", "TWO_SEMESTERS", "CUSTOM_ADVANCE"],
  }).notNull(),
  transactionReference: text("transaction_reference").notNull().unique(),
  receiptNumber: text("receipt_number").notNull().unique(),
  paidAt: text("paid_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  recordedByUserId: integer("recorded_by_user_id").references(() => users.id),
});


/**
 * 13. IMMUTABLE FINANCIAL LEDGER
 * Append-only. Never updated or deleted.
 * Net student balance = SUM(amount).
 */
export const financialLedger = sqliteTable("financial_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id),
  transactionType: text("transaction_type", {
    enum: [
      "ADVANCE_PAYMENT",
      "MONTHLY_MESS_CHARGE",
      "ADDON_CHARGE",
      "ADJUSTMENT_CREDIT",
      "ADJUSTMENT_DEBIT",
      "REFUND_SETTLEMENT",
      "OUTSTANDING_SETTLEMENT",
      "REBATE_REFUND_CREDIT",
    ],
  }).notNull(),
  amount: real("amount").notNull(), // Positive = Credit (Payment), Negative = Debit (Charge/Refund)
  balanceAfter: real("balance_after").notNull(),
  referenceId: text("reference_id"),
  referenceType: text("reference_type"), // 'payment' | 'monthly_mess' | 'addon_selection' | 'settlement'
  recordedByUserId: integer("recorded_by_user_id").references(() => users.id),
  adjustmentReason: text("adjustment_reason"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});


/**
 * 14. SETTLEMENT RECORDS (End-of-semester reconciliation)
 */
export const settlementRecords = sqliteTable("settlement_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id),
  semesterId: integer("semester_id")
    .notNull()
    .references(() => semesters.id),
  totalAdvancePaid: real("total_advance_paid").notNull(),
  totalEligibleCharges: real("total_eligible_charges").notNull(),
  netBalance: real("net_balance").notNull(), // advance - charges
  settlementStatus: text("settlement_status", {
    enum: ["REFUND_ISSUED", "OUTSTANDING_OWED", "EXACT_SETTLED"],
  }).notNull(),
  refundAmount: real("refund_amount").notNull().default(0),
  outstandingAmount: real("outstanding_amount").notNull().default(0),
  settledByUserId: integer("settled_by_user_id")
    .notNull()
    .references(() => users.id),
  settledAt: text("settled_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  refundPaymentReference: text("refund_payment_reference"),
  remarks: text("remarks"),
});


/**
 * 15. AUDIT LOGS (Admin actions, overrides, and role changes)
 */
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // e.g. 'ROLE_CHANGE', 'MESS_OVERRIDE', 'PRICE_CHANGE'
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  oldState: text("old_state"),
  newState: text("new_state"),
  ipAddress: text("ip_address"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});


/**
 * 16. HOSTEL REBATE & COUPON RETURN REQUESTS
 * College Leave Rule:
 * - 4 to 7 days leave: 50% refund
 * - 8+ days leave: 100% refund
 * - Entitlements in this window are marked CANCELLED_REBATE
 */
export const hostelRebateRequests = sqliteTable("hostel_rebate_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  totalDays: integer("total_days").notNull(),
  rebatePercentage: integer("rebate_percentage").notNull(),
  dailyRate: real("daily_rate").notNull(),
  rebateAmount: real("rebate_amount").notNull(),
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED", "CONFIRMED", "CANCELLED"] })
    .notNull()
    .default("PENDING"),
  reason: text("reason").notNull(),
  wardenNotes: text("warden_notes"),
  reviewedByUserId: integer("reviewed_by_user_id").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});


/**
 * 17. SEMESTER ADVANCES (Provisional funding allocation per student)
 * Admin-configured provisional advance (default ₹25,000) used as the
 * funding pool until actual verified deposits are recorded.
 */
export const semesterAdvances = sqliteTable("semester_advances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id),
  semesterLabel: text("semester_label").notNull().default("current"),
  allocatedAmount: real("allocated_amount").notNull().default(25000),
  notes: text("notes"),
  allocatedByUserId: integer("allocated_by_user_id").references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
