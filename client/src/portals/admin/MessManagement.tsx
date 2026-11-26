import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { Mess, MonthlyWindow } from "../../types";
import { Building2, Calendar, Check, Save, Sparkles, Lock, Unlock, CheckCircle2 } from "lucide-react";

export const MessManagement: React.FC = () => {
  const [messes, setMesses] = useState<Mess[]>([]);
  const [windows, setWindows] = useState<MonthlyWindow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminMesses();
      setMesses(res.messes || []);
      setWindows(res.windows || []);
    } catch (err) {
      console.error("Failed to load messes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMess = async (mess: Mess) => {
    setSavingId(mess.id);
    setFeedback(null);
    try {
      await api.updateMess(mess.id, {
        name: mess.name,
        monthlyFee: mess.monthlyFee,
        description: mess.description,
        isActive: mess.isActive,
      });
      setFeedback(`Successfully updated ${mess.name} configuration.`);
      await loadData();
    } catch (err: any) {
      alert("Failed to update mess: " + err.message);
    } finally {
      setSavingId(null);
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
          <Building2 className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Mess Operations & Pricing</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-[#081C15]">
          Mess & Window Configuration
        </h1>
        <p className="text-sm text-[#081C15]/70 mt-1 max-w-xl">
          Control South and North Mess pricing, culinary profiles, and configure selection opening deadlines and lock dates.
        </p>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-[#52796F]/15 border border-[#52796F]/40 text-xs font-semibold text-[#081C15] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#52796F]" />
          <span>{feedback}</span>
        </div>
      )}

      {/* 1. Mess Cards Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {messes.map((mess) => (
          <div key={mess.id} className="glass-card rounded-3xl p-6 sm:p-7 border border-[#52796F]/25 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#52796F]/20">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#081C15]" />
                <h3 className="font-serif font-bold text-2xl text-[#081C15]">{mess.name}</h3>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E8E3D9] text-[#081C15]">
                Code: {mess.code}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Display Name</label>
                <input
                  type="text"
                  value={mess.name}
                  onChange={(e) => {
                    const updated = messes.map((m) => (m.id === mess.id ? { ...m, name: e.target.value } : m));
                    setMesses(updated);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Monthly Fee (₹)</label>
                <input
                  type="number"
                  value={mess.monthlyFee}
                  onChange={(e) => {
                    const updated = messes.map((m) =>
                      m.id === mess.id ? { ...m, monthlyFee: Number(e.target.value) } : m
                    );
                    setMesses(updated);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15] font-serif font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Menu & Cuisine Description</label>
                <textarea
                  rows={3}
                  value={mess.description}
                  onChange={(e) => {
                    const updated = messes.map((m) =>
                      m.id === mess.id ? { ...m, description: e.target.value } : m
                    );
                    setMesses(updated);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id={`active-${mess.id}`}
                  checked={mess.isActive === 1}
                  onChange={(e) => {
                    const updated = messes.map((m) =>
                      m.id === mess.id ? { ...m, isActive: e.target.checked ? 1 : 0 } : m
                    );
                    setMesses(updated);
                  }}
                  className="rounded text-[#081C15]"
                />
                <label htmlFor={`active-${mess.id}`} className="font-semibold text-[#081C15]">
                  Active for student monthly enrolment
                </label>
              </div>
            </div>

            <button
              onClick={() => handleUpdateMess(mess)}
              disabled={savingId === mess.id}
              className="w-full py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-bold shadow-md hover:bg-[#132F22] flex items-center justify-center gap-2 transition-all"
            >
              <Save className="w-4 h-4 text-[#52796F]" />
              <span>{savingId === mess.id ? "Saving Changes..." : "Save Configuration"}</span>
            </button>
          </div>
        ))}
      </div>

      {/* 2. Monthly Selection Windows Table */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
        <h3 className="text-xl font-serif font-bold text-[#081C15] mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#52796F]" />
          <span>Monthly Selection Windows & Deadlines</span>
        </h3>

        <div className="divide-y divide-[#52796F]/15 text-xs">
          {windows.map((win) => (
            <div key={win.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-sm text-[#081C15] block">
                  Month Window: {win.monthYear}
                </span>
                <p className="text-xs text-[#081C15]/60 mt-0.5">
                  Opening: <strong>{win.openDate}</strong> • Selection Deadline: <strong>{win.deadlineDate}</strong> • Locking Date: <strong>{win.lockDate}</strong>
                </p>
              </div>

              <div className="flex items-center gap-3">
                {win.isLocked === 1 ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200">
                    <Lock className="w-3.5 h-3.5" /> Locked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-[#52796F] bg-[#52796F]/20 border border-[#52796F]/30">
                    <Unlock className="w-3.5 h-3.5" /> Open for Selection
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
