import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { formatIndianDate } from "../../utils/formatDate";
import { History, Calendar, CheckCircle, Utensils, Clock } from "lucide-react";

export const StudentHistory: React.FC = () => {
  const [data, setData] = useState<{ messHistory: any[]; redemptionHistory: any[] }>({
    messHistory: [],
    redemptionHistory: [],
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await api.getStudentHistory();
      setData(res);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-3 border-[#52796F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#52796F]/15 text-[#081C15] border border-[#52796F]/30 mb-2">
          <History className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Complete Audit Trail</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-[#081C15]">
          Activity & Redemption History
        </h1>
        <p className="text-sm text-[#081C15]/70 mt-1">
          Historical log of all your monthly mess selections, add-on meals, and counter redemption timestamps.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Monthly Mess Selections History */}
        <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
          <h3 className="text-xl font-serif font-bold text-[#081C15] mb-4 flex items-center gap-2">
            <Utensils className="w-5 h-5 text-[#52796F]" />
            <span>Monthly Mess Selections</span>
          </h3>

          <div className="space-y-3">
            {data.messHistory.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-white/70 border border-[#52796F]/25 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-[#C5A059] uppercase tracking-wider block">
                    Month: {item.monthYear}
                  </span>
                  <h4 className="font-semibold text-base text-[#081C15] mt-0.5">
                    {item.messName}
                  </h4>
                  <p className="text-xs text-[#081C15]/60 mt-0.5">
                    Enrolled on {formatIndianDate(item.selectedAt)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-serif font-bold text-[#081C15]">
                    ₹{item.feeCharged?.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-[#52796F] font-semibold block">
                    Active / Recorded
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Redemption Records History */}
        <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
          <h3 className="text-xl font-serif font-bold text-[#081C15] mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#C5A059]" />
            <span>Counter Scan Log</span>
          </h3>

          {data.redemptionHistory.length === 0 ? (
            <p className="text-xs text-[#081C15]/60 py-8 text-center">
              No scanned redemptions recorded yet. Your scans will appear here immediately after mess counter verification.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {data.redemptionHistory.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3.5 rounded-xl bg-white/60 border border-[#52796F]/20 flex items-center justify-between text-xs"
                >
                  <div>
                    <h5 className="font-semibold text-sm text-[#081C15]">
                      {rec.itemName}
                    </h5>
                    <p className="text-[#081C15]/60 mt-0.5">
                      Date: {formatIndianDate(rec.applicableDate)} • {rec.mealSlot} • Scanned by: {rec.staffName || "Staff"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#52796F]/20 text-[#081C15]">
                      <CheckCircle className="w-3 h-3 text-[#52796F]" /> Verified
                    </span>
                    <span className="text-[10px] text-[#081C15]/50 block mt-1">
                      {new Date(rec.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
