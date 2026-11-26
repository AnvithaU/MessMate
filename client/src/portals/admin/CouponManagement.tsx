import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { QrCode, Download, Filter, Search, CheckCircle2, Clock, XCircle } from "lucide-react";

export const CouponManagement: React.FC = () => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("");

  useEffect(() => {
    loadCoupons();
  }, [statusFilter, dateFilter]);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const list = await api.getAdminCoupons(statusFilter, dateFilter);
      setCoupons(list || []);
    } catch (err) {
      console.error("Failed to load coupons:", err);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (coupons.length === 0) return;
    const headers = "ID,StudentID,StudentName,Department,ItemName,Category,Date,Slot,Status,RedeemedAt,Staff\n";
    const rows = coupons
      .map(
        (c) =>
          `"${c.id}","${c.studentId}","${c.studentName}","${c.department}","${c.itemName}","${c.entitlementType}","${c.applicableDate}","${c.mealSlot}","${c.status}","${c.scannedAt || ""}","${c.staffName || ""}"`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `messmate_coupons_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#52796F]/15 text-[#081C15] border border-[#52796F]/30 mb-2">
            <QrCode className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Entitlements & Coupon Hub</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#081C15]">
            Coupon & Entitlement Hub
          </h1>
          <p className="text-sm text-[#081C15]/70 mt-1 max-w-xl">
            Live monitor of all meal and add-on entitlements across campus. Track redemption velocities and export records.
          </p>
        </div>

        <button
          onClick={exportCsv}
          disabled={coupons.length === 0}
          className="px-4 py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-bold hover:bg-[#132F22] flex items-center gap-2 shadow-md self-start sm:self-center"
        >
          <Download className="w-4 h-4 text-[#52796F]" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-2xl p-4 border border-[#52796F]/25 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#081C15]">
          <Filter className="w-3.5 h-3.5 text-[#52796F]" />
          <span>Filter Status:</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
        >
          <option value="ALL">All Statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="REDEEMED">Redeemed</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
        />

        {dateFilter && (
          <button
            onClick={() => setDateFilter("")}
            className="text-xs text-[#C5A059] font-semibold hover:underline"
          >
            Clear Date
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl border border-[#52796F]/25 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#081C15]">
            <thead>
              <tr className="bg-[#E8E3D9]/60 border-b border-[#52796F]/20 uppercase tracking-wider text-[10px] text-[#081C15]/70">
                <th className="py-3 px-4 font-bold">ID</th>
                <th className="py-3 px-4 font-bold">Student</th>
                <th className="py-3 px-4 font-bold">Item & Category</th>
                <th className="py-3 px-4 font-bold">Applicable Date</th>
                <th className="py-3 px-4 font-bold">Meal Slot</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold">Redemption Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#52796F]/15">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs opacity-60">
                    Loading coupon records...
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs opacity-60">
                    No entitlements match the selected filters.
                  </td>
                </tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-white/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold">#{c.id}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold block">{c.studentName}</span>
                      <span className="font-mono text-[10px] text-[#081C15]/60">{c.studentId} • {c.department}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-[#081C15]">{c.itemName}</span>
                      <span className="block text-[10px] uppercase font-bold text-[#52796F]">{c.entitlementType}</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium">{c.applicableDate}</td>
                    <td className="py-3 px-4 font-medium">{c.mealSlot}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === "AVAILABLE"
                            ? "bg-[#52796F]/20 text-[#081C15]"
                            : c.status === "REDEEMED"
                            ? "bg-[#081C15] text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {c.status === "AVAILABLE" && <CheckCircle2 className="w-3 h-3 text-[#52796F]" />}
                        {c.status === "REDEEMED" && <Clock className="w-3 h-3 text-[#E8C97A]" />}
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#081C15]/70 text-[11px]">
                      {c.scannedAt ? (
                        <span>
                          {new Date(c.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span className="opacity-40 italic">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
