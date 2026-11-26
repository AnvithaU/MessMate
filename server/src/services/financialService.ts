import { db, client } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

const PROVISIONAL_ADVANCE_DEFAULT = 25000;

export async function getStudentFinancialSummary(studentDbId: number) {
  // 0. Provisional advance — from semester_advances table or default ₹25,000
  let provisionalAdvance = PROVISIONAL_ADVANCE_DEFAULT;
  try {
    const advRow = await client.execute({
      sql: `SELECT allocated_amount FROM semester_advances WHERE student_id = ? ORDER BY id DESC LIMIT 1`,
      args: [studentDbId],
    });
    if (advRow.rows.length > 0) {
      provisionalAdvance = Number(advRow.rows[0][0]);
    }
  } catch {
    // table may not exist yet — use default
  }

  // 1. Fetch all verified payments (actual deposits)
  const payments = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.studentId, studentDbId))
    .orderBy(sql`id DESC`)
    .all();

  const totalAdvancePaid = payments.reduce((sum, p) => sum + p.amount, 0);

  // 2. Fetch monthly mess selections
  const messSelections = await db
    .select({
      id: schema.monthlyMessSelections.id,
      monthYear: schema.monthlyMessSelections.monthYear,
      feeCharged: schema.monthlyMessSelections.feeCharged,
      selectedAt: schema.monthlyMessSelections.selectedAt,
      messName: schema.messes.name,
    })
    .from(schema.monthlyMessSelections)
    .innerJoin(schema.messes, eq(schema.monthlyMessSelections.messId, schema.messes.id))
    .where(eq(schema.monthlyMessSelections.studentId, studentDbId))
    .all();

  const totalMessCharges = messSelections.reduce((sum, m) => sum + m.feeCharged, 0);

  // 3. Fetch add-on selections
  const addonSelections = await db
    .select({
      id: schema.addonSelections.id,
      specificDate: schema.addonSelections.specificDate,
      unitPrice: schema.addonSelections.unitPrice,
      addonName: schema.addons.name,
    })
    .from(schema.addonSelections)
    .innerJoin(schema.addons, eq(schema.addonSelections.addonId, schema.addons.id))
    .where(
      and(
        eq(schema.addonSelections.studentId, studentDbId),
        eq(schema.addonSelections.status, "CONFIRMED")
      )
    )
    .all();

  const totalAddonCharges = addonSelections.reduce((sum, a) => sum + a.unitPrice, 0);
  const totalCharges = totalMessCharges + totalAddonCharges;

  // 4. Fetch complete immutable financial ledger
  const ledgerEntries = await db
    .select()
    .from(schema.financialLedger)
    .where(eq(schema.financialLedger.studentId, studentDbId))
    .orderBy(sql`id DESC`)
    .all();

  // Reconstructed balance from ledger
  const ledgerSum = ledgerEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalRefunds = ledgerEntries
    .filter((e) => e.transactionType === "REBATE_REFUND_CREDIT")
    .reduce((sum, e) => sum + Math.max(0, e.amount), 0);

  // Net charges after approved rebate refunds
  const netCharges = Math.max(0, totalCharges - totalRefunds);

  // Available balance uses provisional advance as the "funding pool" when no actual deposits exist
  const fundingBase = totalAdvancePaid > 0 ? totalAdvancePaid : provisionalAdvance;
  const availableBalance = Math.max(0, fundingBase - netCharges);
  const outstandingAmount = Math.max(0, netCharges - fundingBase);

  // 5. Fetch settlement status if any
  const settlement = await db
    .select()
    .from(schema.settlementRecords)
    .where(eq(schema.settlementRecords.studentId, studentDbId))
    .orderBy(sql`id DESC`)
    .limit(1)
    .get();

  return {
    provisionalAdvance,
    hasVerifiedDeposits: totalAdvancePaid > 0,
    totalAdvancePaid,
    totalCharges,
    totalMessCharges,
    totalAddonCharges,
    totalRefunds,
    availableBalance,
    outstandingAmount,
    netBalance: fundingBase - netCharges, // Positive = surplus, Negative = due
    ledgerReconstructedBalance: ledgerSum,
    isSettled: !!settlement,
    settlementRecord: settlement || null,
    payments,
    messSelections,
    addonCount: addonSelections.length,
    ledgerEntries,
  };
}

export async function setStudentProvisionalAdvance(params: {
  studentDbId: number;
  semesterLabel?: string;
  allocatedAmount: number;
  notes?: string;
  adminUserId: number;
}) {
  const { studentDbId, semesterLabel = "current", allocatedAmount, notes, adminUserId } = params;
  if (allocatedAmount < 0) {
    throw new Error("Provisional advance allocation cannot be negative");
  }

  const record = await db
    .insert(schema.semesterAdvances)
    .values({
      studentId: studentDbId,
      semesterLabel,
      allocatedAmount,
      notes: notes || null,
      allocatedByUserId: adminUserId,
    })
    .returning()
    .get();

  await db.insert(schema.auditLogs).values({
    userId: adminUserId,
    action: "SET_PROVISIONAL_ADVANCE",
    entityType: "semester_advances",
    entityId: String(record.id),
    newState: JSON.stringify({ studentDbId, semesterLabel, allocatedAmount, notes }),
  });

  return record;
}

export async function recordStudentAdvancePayment(params: {
  studentDbId: number;
  semesterId: number;
  amount: number;
  paymentMode: "ONLINE" | "UPI" | "NET_BANKING" | "CHALLAN" | "CASH";
  paymentType: "ONE_SEMESTER" | "TWO_SEMESTERS" | "CUSTOM_ADVANCE";
  transactionReference?: string;
  receiptNumber?: string;
  recordedByUserId?: number;
}) {
  const {
    studentDbId,
    semesterId,
    amount,
    paymentMode,
    paymentType,
    transactionReference,
    receiptNumber,
    recordedByUserId,
  } = params;

  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const ref =
    transactionReference ||
    `TXN-${studentDbId}-${Date.now().toString().slice(-6)}`;
  const rcpt = receiptNumber || `RCP-${Date.now().toString().slice(-8)}`;

  // 1. Insert Payment
  const payment = await db
    .insert(schema.payments)
    .values({
      studentId: studentDbId,
      semesterId,
      amount,
      paymentMode,
      paymentType,
      transactionReference: ref,
      receiptNumber: rcpt,
      recordedByUserId: recordedByUserId || null,
    })
    .returning()
    .get();

  // 2. Fetch last ledger balance
  const lastLedger = await db
    .select()
    .from(schema.financialLedger)
    .where(eq(schema.financialLedger.studentId, studentDbId))
    .orderBy(sql`id DESC`)
    .limit(1)
    .get();

  const currentBalance = lastLedger ? lastLedger.balanceAfter : 0;
  const newBalance = currentBalance + amount;

  // 3. Append to immutable ledger
  await db.insert(schema.financialLedger).values({
    studentId: studentDbId,
    transactionType: "ADVANCE_PAYMENT",
    amount,
    balanceAfter: newBalance,
    referenceId: ref,
    referenceType: "payment",
    recordedByUserId: recordedByUserId || null,
    adjustmentReason: `Advance payment received (${paymentType} via ${paymentMode})`,
  });

  return payment;
}

export async function executeFinalSettlement(params: {
  studentDbId: number;
  semesterId: number;
  settledByUserId: number;
  refundPaymentReference?: string;
  remarks?: string;
}) {
  const { studentDbId, semesterId, settledByUserId, refundPaymentReference, remarks } = params;

  // Calculate current financial position
  const summary = await getStudentFinancialSummary(studentDbId);

  let settlementStatus: "REFUND_ISSUED" | "OUTSTANDING_OWED" | "EXACT_SETTLED";
  let refundAmount = 0;
  let outstandingAmount = 0;

  if (summary.netBalance > 0) {
    settlementStatus = "REFUND_ISSUED";
    refundAmount = summary.netBalance;
  } else if (summary.netBalance < 0) {
    settlementStatus = "OUTSTANDING_OWED";
    outstandingAmount = Math.abs(summary.netBalance);
  } else {
    settlementStatus = "EXACT_SETTLED";
  }

  // Insert settlement record
  const settlement = await db
    .insert(schema.settlementRecords)
    .values({
      studentId: studentDbId,
      semesterId,
      totalAdvancePaid: summary.totalAdvancePaid,
      totalEligibleCharges: summary.totalCharges,
      netBalance: summary.netBalance,
      settlementStatus,
      refundAmount,
      outstandingAmount,
      settledByUserId,
      refundPaymentReference: refundPaymentReference || null,
      remarks: remarks || `Final semester reconciliation completed on ${new Date().toLocaleDateString()}`,
    })
    .returning()
    .get();

  // Record balancing transaction in ledger to bring final balance to 0
  const lastLedger = await db
    .select()
    .from(schema.financialLedger)
    .where(eq(schema.financialLedger.studentId, studentDbId))
    .orderBy(sql`id DESC`)
    .limit(1)
    .get();

  const currentBalance = lastLedger ? lastLedger.balanceAfter : 0;

  if (refundAmount > 0) {
    await db.insert(schema.financialLedger).values({
      studentId: studentDbId,
      transactionType: "REFUND_SETTLEMENT",
      amount: -refundAmount,
      balanceAfter: currentBalance - refundAmount,
      referenceId: `SETTLE-${settlement.id}`,
      referenceType: "settlement",
      recordedByUserId: settledByUserId,
      adjustmentReason: `Final semester refund disbursement: ₹${refundAmount.toLocaleString()}`,
    });
  } else if (outstandingAmount > 0) {
    await db.insert(schema.financialLedger).values({
      studentId: studentDbId,
      transactionType: "OUTSTANDING_SETTLEMENT",
      amount: outstandingAmount,
      balanceAfter: currentBalance + outstandingAmount,
      referenceId: `SETTLE-${settlement.id}`,
      referenceType: "settlement",
      recordedByUserId: settledByUserId,
      adjustmentReason: `Final outstanding dues recorded: ₹${outstandingAmount.toLocaleString()}`,
    });
  }

  // Audit log
  await db.insert(schema.auditLogs).values({
    userId: settledByUserId,
    action: "FINAL_SETTLEMENT",
    entityType: "settlement_records",
    entityId: String(settlement.id),
    newState: JSON.stringify(settlement),
  });

  return settlement;
}
