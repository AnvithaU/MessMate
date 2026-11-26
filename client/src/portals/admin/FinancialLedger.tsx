import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { formatIndianDateTime } from "../../utils/formatDate";
import {
  DollarSign,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Receipt,
  Search,
  Filter,
  X,
  CreditCard,
} from "lucide-react";

export const FinancialLedger: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showProvisionalModal, setShowProvisionalModal] = useState<boolean>(false);
  const [students, setStudents] = useState<any[]>([]);

  const [paymentForm, setPaymentForm] = useState({
    studentDbId: "1",
    semesterId: "1",
    amount: "25000",
    paymentMode: "UPI",
    paymentType: "ONE_SEMESTER",
  });

  const [provisionalForm, setProvisionalForm] = useState({
    studentDbId: "1",
    semesterLabel: "current",
    allocatedAmount: "25000",
    notes: "",
  });

  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadLedger();
    loadStudentsList();
  }, []);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminLedger();
      setEntries(data || []);
    } catch (err) {
      console.error("Failed to load ledger:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentsList = async () => {
    try {
      const list = await api.getAdminStudents();
      setStudents(list || []);
    } catch (err) {
      console.error("Failed to load students:", err);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.recordPayment({
        studentDbId: Number(paymentForm.studentDbId),
        semesterId: Number(paymentForm.semesterId),
        amount: Number(paymentForm.amount),
        paymentMode: paymentForm.paymentMode,
        paymentType: paymentForm.paymentType,
      });
      setShowPaymentModal(false);
      setFeedback(`Successfully recorded advance deposit of ₹${Number(paymentForm.amount).toLocaleString()} into student ledger.`);
      await loadLedger();
    } catch (err: any) {
      alert("Payment record failed: " + err.message);
    }
  };

  const handleSetProvisional = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.setProvisionalAdvance({
        studentDbId: Number(provisionalForm.studentDbId),
        semesterLabel: provisionalForm.semesterLabel,
        allocatedAmount: Number(provisionalForm.allocatedAmount),
        notes: provisionalForm.notes || undefined,
      });
      setShowProvisionalModal(false);
      setFeedback(`Updated provisional advance allocation to ₹${Number(provisionalForm.allocatedAmount).toLocaleString()}.`);
      await loadLedger();
    } catch (err: any) {
      alert("Failed to update provisional advance: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#52796F]/15 text-[#081C15] border border-[#52796F]/30 mb-2">
            <DollarSign className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Campus Institutional Ledger</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#081C15]">
            Immutable Financial Ledger
          </h1>
          <p className="text-sm text-[#081C15]/70 mt-1 max-w-xl">
            Append-only audit trail of all advance collections, monthly mess deductions, add-on meals, and final settlements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => setShowProvisionalModal(true)}
            className="px-4 py-2.5 rounded-xl border border-[#52796F]/40 bg-white/80 text-[#081C15] text-xs font-bold hover:bg-white flex items-center gap-2 shadow-sm"
          >
            <CreditCard className="w-4 h-4 text-[#C5A059]" />
            <span>Set Provisional Advance</span>
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-bold hover:bg-[#132F22] flex items-center gap-2 shadow-md"
          >
            <Plus className="w-4 h-4 text-[#52796F]" />
            <span>Record Advance Payment</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-[#52796F]/15 border border-[#52796F]/40 text-xs font-semibold text-[#081C15] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#52796F]" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Ledger Table */}
      <div className="glass-card rounded-2xl border border-[#52796F]/25 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#081C15]">
            <thead>
              <tr className="bg-[#E8E3D9]/60 border-b border-[#52796F]/20 uppercase tracking-wider text-[10px] text-[#081C15]/70">
                <th className="py-3 px-4 font-bold">Txn Ref</th>
                <th className="py-3 px-4 font-bold">Student</th>
                <th className="py-3 px-4 font-bold">Transaction Type</th>
                <th className="py-3 px-4 font-bold">Adjustment Reason</th>
                <th className="py-3 px-4 font-bold">Timestamp</th>
                <th className="py-3 px-4 font-bold text-right">Amount</th>
                <th className="py-3 px-4 font-bold text-right">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#52796F]/15">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs opacity-60">
                    Loading ledger transactions...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs opacity-60">
                    No transactions recorded in ledger.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isCredit = entry.amount > 0;
                  const handleSetProvisional = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.setProvisionalAdvance({
        studentDbId: Number(provisionalForm.studentDbId),
        semesterLabel: provisionalForm.semesterLabel,
        allocatedAmount: Number(provisionalForm.allocatedAmount),
        notes: provisionalForm.notes || undefined,
      });
      setShowProvisionalModal(false);
      setFeedback(`Updated provisional advance allocation to ₹${Number(provisionalForm.allocatedAmount).toLocaleString()}.`);
      await loadLedger();
    } catch (err: any) {
      alert("Failed to update provisional advance: " + err.message);
    }
  };

  return (
                    <tr key={entry.id} className="hover:bg-white/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold">{entry.referenceId || `TXN-${entry.id}`}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold block">{entry.studentName}</span>
                        <span className="font-mono text-[10px] text-[#081C15]/60">{entry.studentId}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isCredit
                              ? "bg-[#52796F]/20 text-[#081C15]"
                              : "bg-[#C5A059]/15 text-[#C5A059]"
                          }`}
                        >
                          {isCredit ? <ArrowUpRight className="w-3 h-3 text-[#52796F]" /> : <ArrowDownLeft className="w-3 h-3 text-[#C5A059]" />}
                          {entry.transactionType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#081C15]/80 max-w-xs">{entry.adjustmentReason}</td>
                      <td className="py-3 px-4 text-[#081C15]/60 whitespace-nowrap">
                        {formatIndianDateTime(entry.createdAt)}
                      </td>
                      <td className={`py-3 px-4 text-right font-serif font-bold text-sm ${isCredit ? "text-[#52796F]" : "text-[#C5A059]"}`}>
                        {isCredit ? `+₹${entry.amount.toLocaleString()}` : `-₹${Math.abs(entry.amount).toLocaleString()}`}
                      </td>
                      <td className="py-3 px-4 text-right font-serif font-bold text-sm">
                        ₹{entry.balanceAfter.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Advance Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleRecordPayment} className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full">
            <h3 className="text-2xl font-serif font-bold text-[#081C15] mb-2">Record Advance Payment</h3>
            <p className="text-xs text-[#081C15]/70 mb-4">
              Credits advance mess balance to student account and appends to the immutable ledger.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Select Student *</label>
                <select
                  value={paymentForm.studentDbId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, studentDbId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.studentId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Payment Tier / Type</label>
                <select
                  value={paymentForm.paymentType}
                  onChange={(e) => {
                    const type = e.target.value;
                    let amt = paymentForm.amount;
                    if (type === "ONE_SEMESTER") amt = "25000";
                    if (type === "TWO_SEMESTERS") amt = "50000";
                    setPaymentForm({ ...paymentForm, paymentType: type, amount: amt });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                >
                  <option value="ONE_SEMESTER">One Semester (₹25,000 standard)</option>
                  <option value="TWO_SEMESTERS">Two Semesters (₹50,000 full year)</option>
                  <option value="CUSTOM_ADVANCE">Custom Advance Amount</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15] font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Payment Mode</label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                >
                  <option value="UPI">UPI / QR Payment</option>
                  <option value="ONLINE">Online Portal</option>
                  <option value="NET_BANKING">Net Banking</option>
                  <option value="CHALLAN">Bank Challan</option>
                  <option value="CASH">Cash Deposit</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#52796F]/30 text-xs font-semibold text-[#081C15]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-bold shadow-md hover:bg-[#132F22]"
              >
                Deposit & Credit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Set Provisional Advance Modal */}
      {showProvisionalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSetProvisional} className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full">
            <h3 className="text-2xl font-serif font-bold text-[#081C15] mb-2">Configure Provisional Advance</h3>
            <p className="text-xs text-[#081C15]/70 mb-4">
              Set or update a student&apos;s provisional advance allocation (default ₹25,000). This is NOT recorded as an actual cash/bank payment.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Select Student *</label>
                <select
                  value={provisionalForm.studentDbId}
                  onChange={(e) => setProvisionalForm({ ...provisionalForm, studentDbId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.studentId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Semester Label</label>
                <input
                  type="text"
                  value={provisionalForm.semesterLabel}
                  onChange={(e) => setProvisionalForm({ ...provisionalForm, semesterLabel: e.target.value })}
                  placeholder="e.g. 2026-ODD or Sem 5"
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Provisional Allocation (₹) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={provisionalForm.allocatedAmount}
                  onChange={(e) => setProvisionalForm({ ...provisionalForm, allocatedAmount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15] font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Notes</label>
                <input
                  type="text"
                  value={provisionalForm.notes}
                  onChange={(e) => setProvisionalForm({ ...provisionalForm, notes: e.target.value })}
                  placeholder="Optional admin note"
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowProvisionalModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#52796F]/30 text-xs font-semibold text-[#081C15]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-bold shadow-md hover:bg-[#132F22]"
              >
                Save Allocation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
