import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import {
  Scale,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import confetti from "canvas-confetti";

export const FinalSettlement: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("1");
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [settling, setSettling] = useState<boolean>(false);
  const [settlementResult, setSettlementResult] = useState<any>(null);
  const [remarks, setRemarks] = useState<string>("Final Fall 2026 Semester Reconciliation");
  const [refundRef, setRefundRef] = useState<string>("REF-NEFT-2026-9921");

  useEffect(() => {
    loadStudentsList();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentSummary(Number(selectedStudentId));
    }
  }, [selectedStudentId]);

  const loadStudentsList = async () => {
    try {
      const list = await api.getAdminStudents();
      setStudents(list || []);
      if (list && list.length > 0) {
        setSelectedStudentId(String(list[0].id));
      }
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentSummary = async (studentDbId: number) => {
    setLoading(true);
    setSettlementResult(null);
    try {
      const profile = await api.getStudentProfile(studentDbId);
      setSummary(profile);
    } catch (err) {
      console.error("Failed to load student summary:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSettlement = async () => {
    if (!summary) return;
    setSettling(true);
    try {
      const res = await api.executeSettlement({
        studentDbId: Number(selectedStudentId),
        semesterId: 1,
        refundPaymentReference: refundRef,
        remarks,
      });

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#081C15", "#52796F", "#C5A059"],
      });

      setSettlementResult(res.settlement);
      await loadStudentSummary(Number(selectedStudentId));
    } catch (err: any) {
      alert("Settlement execution failed: " + err.message);
    } finally {
      setSettling(false);
    }
  };

  const student = summary?.student;
  const f = summary?.financials;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#52796F]/15 text-[#081C15] border border-[#52796F]/30 mb-2">
          <Scale className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Semester-End Reconciliation Engine</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-[#081C15]">
          Final Settlement & Refunds
        </h1>
        <p className="text-sm text-[#081C15]/70 mt-1 max-w-xl">
          At semester closing, student advance deposits are reconciled against total eligible charges. Automatically determines exact refund disimbursements or outstanding receivables.
        </p>
      </div>

      {/* Student Selector Dropdown */}
      <div className="glass-card rounded-2xl p-4 border border-[#52796F]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#081C15]/70">
            Select Student for Audit:
          </span>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="px-4 py-2 rounded-xl bg-white/90 border border-[#52796F]/30 text-xs font-semibold text-[#081C15] focus:outline-none"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({s.studentId}) — {s.department}
              </option>
            ))}
          </select>
        </div>

        {student && (
          <div className="text-xs text-[#081C15]/70">
            Room: <strong className="text-[#081C15]">{student.roomNumber}</strong> • Semester {student.semester}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[350px]">
          <div className="w-8 h-8 border-3 border-[#52796F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : summary && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Reconciliation Calculation Card (7 Cols) */}
          <div className="lg:col-span-7 glass-card rounded-3xl p-6 sm:p-7 border border-[#52796F]/25 space-y-5">
            <h3 className="text-xl font-serif font-bold text-[#081C15] pb-3 border-b border-[#52796F]/20 flex items-center justify-between">
              <span>Financial Position Breakdown</span>
              <span className="text-xs font-mono font-bold bg-[#E8E3D9] px-2.5 py-0.5 rounded-full text-[#081C15]">
                {student?.studentId}
              </span>
            </h3>

            {/* Reconciliation Math Table */}
            <div className="space-y-3 text-xs text-[#081C15]">
              <div className="p-3.5 rounded-xl bg-white/70 border border-[#52796F]/20 flex items-center justify-between">
                <span>Total Advance Payments Deposited:</span>
                <strong className="text-base font-serif font-bold text-[#081C15]">
                  ₹{f?.totalAdvancePaid?.toLocaleString()}
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-white/70 border border-[#52796F]/20 flex items-center justify-between">
                <div>
                  <span>Total Eligible Mess & Add-on Charges:</span>
                  <span className="text-[10px] text-[#081C15]/60 block">
                    Mess: ₹{f?.totalMessCharges?.toLocaleString()} • Addons: ₹{f?.totalAddonCharges?.toLocaleString()}
                  </span>
                </div>
                <strong className="text-base font-serif font-bold text-[#C5A059]">
                  - ₹{f?.totalCharges?.toLocaleString()}
                </strong>
              </div>

              {/* Net Result Bar */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  f?.netBalance > 0
                    ? "bg-[#52796F]/20 border-[#52796F]/50 text-[#081C15]"
                    : f?.netBalance < 0
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-[#E8E3D9] border-gray-300 text-gray-700"
                }`}
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block">
                    {f?.netBalance > 0
                      ? "Refund Due to Student"
                      : f?.netBalance < 0
                      ? "Outstanding Amount Owed"
                      : "Account Balanced"}
                  </span>
                  <span className="text-[11px] opacity-75">
                    Formula: Total Advance Paid (₹{f?.totalAdvancePaid}) - Total Charges (₹{f?.totalCharges})
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-serif font-bold">
                    ₹{Math.abs(f?.netBalance || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Input fields for settlement */}
            <div className="space-y-3 pt-3 border-t border-[#52796F]/20 text-xs">
              {f?.netBalance > 0 && (
                <div>
                  <label className="font-semibold text-[#081C15] block mb-1">
                    Bank Refund Transaction Reference (NEFT / UPI)
                  </label>
                  <input
                    type="text"
                    value={refundRef}
                    onChange={(e) => setRefundRef(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs font-mono"
                  />
                </div>
              )}

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">
                  Settlement Auditor Remarks
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs"
                />
              </div>

              <button
                onClick={handleExecuteSettlement}
                disabled={settling}
                className="w-full py-3.5 rounded-xl bg-[#081C15] text-[#FAF8F5] font-bold text-sm shadow-md hover:bg-[#132F22] flex items-center justify-center gap-2 transition-all"
              >
                <ShieldCheck className="w-4 h-4 text-[#52796F]" />
                <span>
                  {settling
                    ? "Executing Settlement..."
                    : `Execute Final Settlement & Disburse Refund`}
                </span>
              </button>
            </div>
          </div>

          {/* Right Column: Printable Settlement Receipt (5 Cols) */}
          <div className="lg:col-span-5">
            <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-[#52796F]/30 bg-white shadow-xl space-y-4">
              <div className="text-center pb-4 border-b border-gray-200">
                <span className="font-serif text-xl font-bold tracking-wider text-[#081C15]">
                  MESS<span className="text-[#C5A059]">MATE</span>
                </span>
                <p className="text-[10px] font-bold text-[#081C15]/60 uppercase tracking-widest mt-0.5">
                  Official Final Settlement Certificate
                </p>
              </div>

              <div className="space-y-2 text-xs text-[#081C15]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Student Name:</span>
                  <strong>{student?.fullName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Roll Number:</span>
                  <strong className="font-mono">{student?.studentId}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Department:</span>
                  <span>{student?.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Academic Term:</span>
                  <span>Fall 2026</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Advance Paid:</span>
                  <span>₹{f?.totalAdvancePaid?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Charges:</span>
                  <span>₹{f?.totalCharges?.toLocaleString()}</span>
                </div>

                <div className="py-2.5 my-2 border-t border-b border-dashed border-gray-300 flex justify-between items-center text-sm font-bold">
                  <span>Net Settlement Balance:</span>
                  <span className={f?.netBalance >= 0 ? "text-[#081C15]" : "text-rose-700"}>
                    {f?.netBalance >= 0 ? `Refund ₹${f?.netBalance.toLocaleString()}` : `Due ₹${Math.abs(f?.netBalance).toLocaleString()}`}
                  </span>
                </div>

                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500">Settlement Date:</span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500">Approved By:</span>
                  <span>Chief Mess Warden</span>
                </div>
              </div>

              <button
                onClick={() => window.print()}
                className="w-full py-2.5 rounded-xl border border-[#52796F]/30 text-xs font-semibold text-[#081C15] hover:bg-gray-50 flex items-center justify-center gap-2 mt-4"
              >
                <Printer className="w-3.5 h-3.5 text-[#52796F]" />
                <span>Print Certificate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
