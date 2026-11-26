import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { formatIndianDate } from "../../utils/formatDate";
import {
  Users,
  UtensilsCrossed,
  DollarSign,
  QrCode,
  TrendingUp,
  Scale,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ArrowRight,
  PieChart,
} from "lucide-react";

interface Props {
  onNavigate: (tab: string) => void;
}

export const AdminOverview: React.FC<Props> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [rebates, setRebates] = useState<any[]>([]);
  const [rebateActionId, setRebateActionId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      const [res, rebateList] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminRebates().catch(() => []),
      ]);
      setData(res);
      setRebates(Array.isArray(rebateList) ? rebateList : []);
    } catch (err) {
      console.error("Failed to load admin overview:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRebateDecision = async (id: number, approve: boolean) => {
    setRebateActionId(id);
    try {
      if (approve) {
        await api.approveRebate(id, "Approved by Warden");
      } else {
        await api.rejectRebate(id, "Rejected by Warden");
      }
      await loadOverview();
    } catch (err: any) {
      alert(err.message || "Failed to process rebate");
    } finally {
      setRebateActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-3 border-[#52796F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const m = data?.metrics;
  const dist = data?.distribution;
  const addons = data?.addonsDemand || [];
  const totalEnrolments = (dist?.south || 0) + (dist?.north || 0) + (dist?.unselected || 0);

  const southPct = totalEnrolments > 0 ? Math.round(((dist?.south || 0) / totalEnrolments) * 100) : 0;
  const northPct = totalEnrolments > 0 ? Math.round(((dist?.north || 0) / totalEnrolments) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#081C15] text-[#FAF8F5] mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#52796F]" />
            <span>Chief Mess Warden & Admin Command</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#081C15]">
            College Mess Operations Overview
          </h1>
          <p className="text-sm text-[#081C15]/70 mt-1 max-w-xl">
            Live institutional metrics for {data?.currentMonthYear}. Real-time monitoring of student enrolments, daily counter throughput, and financial settlement reconciliations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate("admin-students")}
            className="px-4 py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-semibold hover:bg-[#132F22] shadow-md transition-all"
          >
            Manage Students
          </button>
          <button
            onClick={() => onNavigate("admin-settlement")}
            className="px-4 py-2.5 rounded-xl bg-[#C5A059] text-white text-xs font-semibold hover:bg-[#D4AF37] shadow-md transition-all"
          >
            Final Settlement
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25">
          <div className="flex items-center justify-between text-xs text-[#081C15]/70 mb-2">
            <span>Enrolled Students</span>
            <Users className="w-4 h-4 text-[#52796F]" />
          </div>
          <div className="text-3xl font-serif font-bold text-[#081C15]">
            {m?.totalStudents?.toLocaleString()}
          </div>
          <p className="text-xs text-[#52796F] font-medium mt-1">
            {m?.activeStudents} active this semester
          </p>
        </div>

        {/* Total Advance Collected */}
        <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25">
          <div className="flex items-center justify-between text-xs text-[#081C15]/70 mb-2">
            <span>Total Advance Collected</span>
            <DollarSign className="w-4 h-4 text-[#52796F]" />
          </div>
          <div className="text-3xl font-serif font-bold text-[#081C15]">
            ₹{m?.totalAdvanceCollected?.toLocaleString()}
          </div>
          <p className="text-xs text-[#52796F] font-medium mt-1">
            Surplus Float: ₹{m?.advanceSurplus?.toLocaleString()}
          </p>
        </div>

        {/* Total Billed */}
        <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25">
          <div className="flex items-center justify-between text-xs text-[#081C15]/70 mb-2">
            <span>Mess & Add-on Charges</span>
            <TrendingUp className="w-4 h-4 text-[#C5A059]" />
          </div>
          <div className="text-3xl font-serif font-bold text-[#C5A059]">
            ₹{m?.totalChargesBilled?.toLocaleString()}
          </div>
          <p className="text-xs text-[#081C15]/60 mt-1">
            Deducted from advance balances
          </p>
        </div>

        {/* Coupons Velocity */}
        <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25">
          <div className="flex items-center justify-between text-xs text-[#081C15]/70 mb-2">
            <span>Coupon Redemption Rate</span>
            <QrCode className="w-4 h-4 text-[#52796F]" />
          </div>
          <div className="text-3xl font-serif font-bold text-[#081C15]">
            {m?.redemptionRate}%
          </div>
          <p className="text-xs text-[#081C15]/60 mt-1">
            {m?.totalCouponsRedeemed} of {m?.totalCouponsIssued} coupons served
          </p>
        </div>
      </div>

      {/* 3. South vs North Mess Distribution Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 glass-card rounded-2xl p-6 border border-[#52796F]/25">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-serif font-bold text-[#081C15]">
                South Mess vs North Mess Distribution
              </h3>
              <p className="text-xs text-[#081C15]/70">
                Monthly student choice breakdown for {data?.currentMonthYear}
              </p>
            </div>
            <button
              onClick={() => onNavigate("admin-messes")}
              className="text-xs font-semibold text-[#C5A059] hover:underline"
            >
              Config →
            </button>
          </div>

          {/* Progress Bar Visualizer */}
          <div className="w-full h-6 rounded-xl bg-[#E8E3D9] overflow-hidden flex my-4 p-0.5 border border-[#52796F]/20 shadow-inner">
            <div
              style={{ width: `${southPct}%` }}
              className="h-full bg-[#081C15] rounded-l-lg transition-all duration-500 relative group"
              title={`South Mess: ${dist?.south} (${southPct}%)`}
            />
            <div
              style={{ width: `${northPct}%` }}
              className="h-full bg-[#C5A059] rounded-r-lg transition-all duration-500 relative group"
              title={`North Mess: ${dist?.north} (${northPct}%)`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-4 rounded-xl bg-white/70 border border-[#52796F]/25">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-[#081C15]" />
                <span className="text-xs font-bold text-[#081C15]">South Mess</span>
              </div>
              <div className="text-2xl font-serif font-bold text-[#081C15]">
                {dist?.south} <span className="text-xs font-sans font-normal opacity-70">({southPct}%)</span>
              </div>
              <p className="text-[11px] text-[#081C15]/60 mt-0.5">
                Traditional Coastal & South Indian
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/70 border border-[#52796F]/25">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-[#C5A059]" />
                <span className="text-xs font-bold text-[#081C15]">North Mess</span>
              </div>
              <div className="text-2xl font-serif font-bold text-[#C5A059]">
                {dist?.north} <span className="text-xs font-sans font-normal opacity-70">({northPct}%)</span>
              </div>
              <p className="text-[11px] text-[#081C15]/60 mt-0.5">
                North Indian & Punjabi cuisine
              </p>
            </div>
          </div>
        </div>

        {/* Add-on Demand Breakdown */}
        <div className="lg:col-span-6 glass-card rounded-2xl p-6 border border-[#52796F]/25">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-serif font-bold text-[#081C15]">
                Add-on Nutrition Demand
              </h3>
              <p className="text-xs text-[#081C15]/70">
                Total student pre-bookings across all calendar slots
              </p>
            </div>
            <button
              onClick={() => onNavigate("admin-addons")}
              className="text-xs font-semibold text-[#C5A059] hover:underline"
            >
              Rules →
            </button>
          </div>

          <div className="space-y-3.5 mt-4">
            {addons.map((a: any) => {
              const maxCount = Math.max(...addons.map((item: any) => item.count), 1);
              const barWidth = Math.min(100, Math.round((a.count / maxCount) * 100));

              return (
                <div key={a.code} className="space-y-1">
                  <div className="flex justify-between text-xs text-[#081C15]">
                    <span className="font-semibold">{a.name}</span>
                    <strong className="font-serif text-sm">{a.count} bookings</strong>
                  </div>
                  <div className="w-full h-3 rounded-full bg-[#E8E3D9] overflow-hidden">
                    <div
                      style={{ width: `${barWidth}%` }}
                      className="h-full bg-gradient-to-r from-[#52796F] to-[#081C15] rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Warden Hostel Leave Rebate Requests */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-serif font-bold text-[#081C15]">
              Hostel Leave Rebate Requests
            </h3>
            <p className="text-xs text-[#081C15]/70">
              Pending student leave rebate requests awaiting Warden approval (4–7 days = 50%, 8+ days = 100%).
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#C5A059]/15 text-[#081C15]">
            {rebates.filter((r) => r.status === "PENDING").length} Pending
          </span>
        </div>

        {rebates.length === 0 ? (
          <p className="text-xs text-[#081C15]/60 py-4 text-center">
            No hostel leave rebate requests submitted yet.
          </p>
        ) : (
          <div className="space-y-3">
            {rebates.slice(0, 10).map((r: any) => (
              <div
                key={r.id}
                className="p-4 rounded-xl bg-white/70 border border-[#52796F]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#081C15]">{r.studentName}</span>
                    <span className="font-mono text-[11px] text-[#081C15]/60">({r.studentId})</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        r.status === "PENDING"
                          ? "bg-amber-100 text-amber-800"
                          : r.status === "APPROVED" || r.status === "CONFIRMED"
                          ? "bg-[#52796F]/20 text-[#081C15]"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#081C15]/70 mt-1">
                    {formatIndianDate(r.startDate)} — {formatIndianDate(r.endDate)} ({r.totalDays} days • {r.rebatePercentage}% rebate)
                    {r.reason ? ` • "${r.reason}"` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-serif font-bold text-base text-[#C5A059]">
                    ₹{Number(r.rebateAmount ?? 0).toLocaleString()}
                  </span>
                  {r.status === "PENDING" && (
                    <div className="flex items-center gap-2">
                      <button
                        disabled={rebateActionId === r.id}
                        onClick={() => handleRebateDecision(r.id, true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#081C15] text-[#FAF8F5] text-xs font-semibold hover:bg-[#132F22] disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#52796F]" />
                        Approve
                      </button>
                      <button
                        disabled={rebateActionId === r.id}
                        onClick={() => handleRebateDecision(r.id, false)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
