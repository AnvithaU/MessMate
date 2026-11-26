import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { formatIndianDate } from "../../utils/formatDate";
import { QRCodeSVG } from "qrcode.react";
import {
  Utensils,
  Wallet,
  Calendar,
  QrCode,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  TrendingDown,
} from "lucide-react";

interface Props {
  onNavigate: (tab: string) => void;
}

export const StudentOverview: React.FC<Props> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
    // Re-fetch when enrolment is submitted from another tab
    const handler = () => loadDashboard();
    window.addEventListener("messmate:enrolment-updated", handler);
    return () => window.removeEventListener("messmate:enrolment-updated", handler);
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.getStudentDashboard();
      setData(res);
    } catch (err) {
      console.error("Dashboard load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="w-8 h-8 border-3 border-[#52796F] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const student = data?.student;
  const currentMess = data?.currentMess;
  const upcomingMess = data?.upcomingMess;
  const financials = data?.financials;
  const today = data?.todayEntitlements;
  const activeWindow = data?.activeWindow;

  return (
    <div className="space-y-6">
      {/* 1. Welcoming Hero Banner with Glassmorphism */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 relative overflow-hidden border border-[#52796F]/25">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#52796F]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 rounded-full bg-[#C5A059]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#52796F]/15 text-[#081C15] border border-[#52796F]/30 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Academic Year 2026-2027 • Fall Semester</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#081C15]">
              Welcome back, {student?.fullName || "Student"}
            </h1>
            <p className="text-sm text-[#081C15]/70 mt-1">
              Roll No: <span className="font-semibold text-[#081C15]">{student?.studentId}</span> • Department: {student?.department} • Room: {student?.roomNumber}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate("wallet")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs sm:text-sm font-semibold shadow-md hover:bg-[#132F22] transition-all"
            >
              <QrCode className="w-4 h-4 text-[#52796F]" />
              <span>View Universal QR</span>
            </button>
            <button
              onClick={() => onNavigate("mess-selection")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C5A059] text-white text-xs sm:text-sm font-semibold shadow-md hover:bg-[#D4AF37] transition-all"
            >
              <Utensils className="w-4 h-4" />
              <span>Change Mess</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metric Glass Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Mess */}
        <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#081C15]/70">
            <span>{upcomingMess ? `Upcoming (${upcomingMess.monthYear})` : "Enrolled Mess"}</span>
            <Utensils className="w-4 h-4 text-[#52796F]" />
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-serif font-bold text-[#081C15]">
              {currentMess?.messName || "Not Selected"}
            </h3>
            <p className="text-xs text-[#081C15]/70 mt-1">
              {currentMess ? `₹${currentMess.feeCharged?.toLocaleString()} / month` : "Action required"}
            </p>
          </div>
          <button
            onClick={() => onNavigate("mess-selection")}
            className="mt-4 text-xs font-semibold text-[#C5A059] hover:underline flex items-center gap-1"
          >
            <span>{currentMess ? "View Enrolment" : "Modify Selection"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Advance Balance */}
        <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#081C15]/70">
            <span>{financials?.hasVerifiedDeposits ? "Available Balance" : "Provisional Balance"}</span>
            <Wallet className="w-4 h-4 text-[#52796F]" />
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-serif font-bold text-[#081C15]">
              ₹{financials?.availableBalance?.toLocaleString() || "0"}
            </h3>
            <p className="text-xs text-[#52796F] font-medium mt-1">
              {financials?.hasVerifiedDeposits
                ? `Verified Deposits: ₹${financials?.totalAdvancePaid?.toLocaleString()}`
                : `Provisional Advance: ₹${(financials?.provisionalAdvance ?? 25000).toLocaleString()}`}
            </p>
            {(financials?.outstandingAmount ?? 0) > 0 && (
              <p className="text-[11px] text-rose-700 font-semibold mt-0.5">
                Outstanding: ₹{financials.outstandingAmount.toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={() => onNavigate("financials")}
            className="mt-4 text-xs font-semibold text-[#C5A059] hover:underline flex items-center gap-1"
          >
            <span>Ledger & Receipts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Total Billed */}
        <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#081C15]/70">
            <span>Total Debits Billed</span>
            <TrendingDown className="w-4 h-4 text-[#C5A059]" />
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-serif font-bold text-[#081C15]">
              ₹{financials?.totalCharges?.toLocaleString() || "0"}
            </h3>
            <p className="text-xs text-[#081C15]/70 mt-1">
              Mess fees & add-on meals
            </p>
          </div>
          <div className="mt-4 text-xs text-[#081C15]/60 flex items-center gap-1">
            <span>Immutable ledger tracked</span>
          </div>
        </div>

        {/* Universal QR Quick Card */}
        <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25 flex items-center gap-4 bg-gradient-to-br from-white/80 to-[#E8E3D9]/60">
          <div className="p-2 rounded-xl bg-white shadow-sm border border-[#52796F]/20 flex-shrink-0">
            <QRCodeSVG value={student?.qrToken || "MM-QR"} size={68} />
          </div>
          <div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#52796F]/20 text-[#081C15]">
              PERMANENT QR
            </span>
            <h4 className="font-semibold text-xs text-[#081C15] mt-1">Universal Identity</h4>
            <p className="text-[11px] text-[#081C15]/70 line-clamp-1">{student?.qrToken}</p>
            <button
              onClick={() => onNavigate("wallet")}
              className="text-xs font-semibold text-[#C5A059] mt-1.5 hover:underline block"
            >
              Open Full Wallet →
            </button>
          </div>
        </div>
      </div>

      {/* 3. Today's Entitlements Deck Preview */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-[#081C15]">
              Today's Meal & Add-on Entitlements
            </h2>
            <p className="text-xs text-[#081C15]/70">
              Present your Universal QR at the mess counter to redeem all available items together.
            </p>
          </div>
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#E8E3D9] text-[#081C15]">
            {today?.date ? formatIndianDate(today.date) : "Today"} • {today?.currentSlot}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {today?.entitlements?.map((item: any, idx: number) => {
            const isAvailable = item.status === "AVAILABLE";
            const isRedeemed = item.status === "REDEEMED";

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all ${
                  isAvailable
                    ? "bg-white/80 border-[#52796F]/40 shadow-sm"
                    : isRedeemed
                    ? "bg-[#52796F]/10 border-[#52796F]/30 opacity-75"
                    : "bg-[#E8E3D9]/40 border-transparent text-[#081C15]/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#52796F]">
                    {item.category === "MESS_MEAL" ? "Mess Meal" : "Add-on"} • {item.mealSlot}
                  </span>
                  {isAvailable && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#52796F] bg-[#52796F]/15 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Available
                    </span>
                  )}
                  {isRedeemed && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#081C15] bg-white/70 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" /> Redeemed
                    </span>
                  )}
                  {!isAvailable && !isRedeemed && (
                    <span className="text-[11px] font-medium text-[#081C15]/50 bg-black/5 px-2 py-0.5 rounded-full">
                      {item.status === "NOT_SELECTED" ? "Not Booked" : "Not Today"}
                    </span>
                  )}
                </div>

                <h4 className="font-semibold text-sm text-[#081C15] mt-2">
                  {item.itemName}
                </h4>
                <p className="text-xs text-[#081C15]/70 mt-0.5 line-clamp-1">
                  {item.details}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
