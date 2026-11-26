import React, { useState, useEffect } from "react";
import { Home, Calendar, Calculator, Loader2, AlertCircle, CheckCircle2, ArrowRight, Clock } from "lucide-react";
import { API_BASE } from "../../services/api";
import { formatIndianDate } from "../../utils/formatDate";

const API = API_BASE;
const tok = () => localStorage.getItem("messmate_token") ?? "";

interface RebateCalc {
  totalDays: number;
  rebatePercentage: number;
  dailyMessRate: number;
  addonChargesInRange: number;
  estimatedRefund: number;
  eligible: boolean;
}

interface RebateRecord {
  id: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  rebatePercentage: number;
  refundAmount: number;
  status: string;
  reason: string | null;
  createdAt: string;
}

export const HostelLeaveRebate: React.FC = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [calc, setCalc] = useState<RebateCalc | null>(null);
  const [history, setHistory] = useState<RebateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const r = await fetch(API + "/student/rebates", {
        headers: { Authorization: "Bearer " + tok() },
      });
      const data = await r.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  };

  const calculate = async () => {
    if (!startDate || !endDate) {
      setError("Please select both start and end dates.");
      return;
    }
    setLoading(true);
    setError(null);
    setCalc(null);
    try {
      const r = await fetch(API + "/student/rebate/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok() },
        body: JSON.stringify({ startDate, endDate }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Calculation failed");
      setCalc(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const submitRebate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(API + "/student/rebate/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok() },
        body: JSON.stringify({ startDate, endDate, reason }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Submission failed");
      setSuccess(
        data.message ?? ("Rebate request of ₹" + (data.calculation?.estimatedRebateAmount ?? calc?.estimatedRefund ?? 0).toFixed(0) + " submitted — pending warden approval.")
      );
      setCalc(null);
      setStartDate("");
      setEndDate("");
      setReason("");
      fetchHistory();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const percentBadge = (pct: number) => {
    if (pct === 100) return { text: "100% Refund", bg: "rgba(197,160,89,0.15)", color: "var(--gold-dark)" };
    if (pct === 50) return { text: "50% Refund", bg: "rgba(82,121,111,0.12)", color: "var(--olive)" };
    return { text: "Ineligible", bg: "rgba(220,38,38,0.08)", color: "#b91c1c" };
  };

  const statusBadge = (s: string) => {
    if (s === "APPROVED" || s === "CREDITED") return { bg: "rgba(197,160,89,0.15)", color: "var(--gold-dark)" };
    if (s === "PENDING") return { bg: "rgba(82,121,111,0.12)", color: "var(--olive)" };
    return { bg: "rgba(220,38,38,0.08)", color: "#b91c1c" };
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold" style={{ color: "var(--obsidian)" }}>
          Hostel Leave Rebate
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(8,28,21,0.5)" }}>
          Going home? Request a refund for unused mess days. 4&ndash;7 days = 50%, 8+ days = 100%.
        </p>
      </div>

      {/* Success banner */}
      {success && (
        <div
          className="p-4 rounded-xl flex items-start gap-3 text-sm"
          style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.25)", color: "var(--obsidian)" }}
        >
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--gold)" }} />
          <div>
            <p className="font-semibold">Rebate Credited</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(8,28,21,0.6)" }}>{success}</p>
          </div>
        </div>
      )}

      {/* Date selection card */}
      <div className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: "var(--olive)" }}>
          <Calendar className="w-4 h-4" />
          Leave Period
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: "rgba(8,28,21,0.6)" }}>
              Departure Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCalc(null); setSuccess(null); }}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all"
              style={{
                background: "white",
                border: "1px solid rgba(82,121,111,0.25)",
                color: "var(--obsidian)",
              }}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: "rgba(8,28,21,0.6)" }}>
              Return Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCalc(null); setSuccess(null); }}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all"
              style={{
                background: "white",
                border: "1px solid rgba(82,121,111,0.25)",
                color: "var(--obsidian)",
              }}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: "rgba(8,28,21,0.6)" }}>
            Reason (optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Going home for festival"
            className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all"
            style={{
              background: "white",
              border: "1px solid rgba(82,121,111,0.25)",
              color: "var(--obsidian)",
            }}
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl flex items-start gap-2 text-xs" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", color: "#b91c1c" }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!calc && (
          <button
            onClick={calculate}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-70"
            style={{ background: "var(--obsidian)", color: "var(--gold-light)", boxShadow: "0 4px 14px -4px rgba(8,28,21,0.3)" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            {loading ? "Calculating..." : "Calculate Rebate"}
          </button>
        )}

        {/* Calculation result */}
        {calc && (
          <div className="space-y-4 pt-2">
            <div className="gold-divider" />

            <div className="flex items-center gap-3">
              <div className="font-serif text-3xl font-bold" style={{ color: "var(--obsidian)" }}>
                {calc.totalDays} days
              </div>
              <div
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: percentBadge(calc.rebatePercentage).bg, color: percentBadge(calc.rebatePercentage).color }}
              >
                {percentBadge(calc.rebatePercentage).text}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: "rgba(8,28,21,0.6)" }}>Daily mess rate</span>
                <span>&#8377;{Number(calc.dailyMessRate ?? 0).toFixed(0)}</span>
              </div>
              {Number(calc.addonChargesInRange ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: "rgba(8,28,21,0.6)" }}>Add-on charges in range</span>
                  <span>&#8377;{Number(calc.addonChargesInRange ?? 0).toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span style={{ color: "rgba(8,28,21,0.6)" }}>Rebate percentage</span>
                <span>{calc.rebatePercentage}%</span>
              </div>
              <div className="gold-divider" />
              <div className="flex justify-between font-bold text-base">
                <span style={{ color: "var(--obsidian)" }}>Estimated Refund</span>
                <span style={{ color: "var(--gold-dark)" }}>&#8377;{Number(calc.estimatedRefund ?? 0).toFixed(0)}</span>
              </div>
            </div>

            {calc.eligible ? (
              <button
                onClick={submitRebate}
                disabled={submitting}
                className="flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-70 w-full justify-center"
                style={{
                  background: "linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%)",
                  color: "var(--obsidian)",
                  boxShadow: "0 4px 14px -4px rgba(197,160,89,0.5)",
                }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {submitting ? "Submitting..." : "Submit Rebate Request"}
              </button>
            ) : (
              <p className="text-xs text-center py-2" style={{ color: "#b91c1c" }}>
                Minimum 4 days required for a rebate. Your leave is {calc.totalDays} day(s).
              </p>
            )}
          </div>
        )}
      </div>

      {/* History section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: "var(--olive)" }}>
          <Clock className="w-4 h-4" />
          Past Rebate Requests
        </div>

        {historyLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--gold)" }} />
          </div>
        ) : history.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <Home className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(8,28,21,0.2)" }} />
            <p className="text-sm" style={{ color: "rgba(8,28,21,0.4)" }}>No rebate requests yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((r) => {
              const badge = statusBadge(r.status);
              return (
                <div key={r.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--obsidian)" }}>
                      {formatIndianDate(r.startDate)} &mdash; {formatIndianDate(r.endDate)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "rgba(8,28,21,0.5)" }}>
                      <span>{r.totalDays} days</span>
                      <span>{r.rebatePercentage}% rebate</span>
                      {r.reason && <span>&middot; {r.reason}</span>}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="font-bold text-sm" style={{ color: "var(--gold-dark)" }}>
                      &#8377;{Number((r as any).refundAmount ?? (r as any).rebateAmount ?? 0).toFixed(0)}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {r.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
