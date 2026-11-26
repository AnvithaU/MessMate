import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { Addon } from "../../types";
import { Layers, Save, CheckCircle2, Plus } from "lucide-react";

export const AddonManagement: React.FC = () => {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadAddons();
  }, []);

  const loadAddons = async () => {
    setLoading(true);
    try {
      const list = await api.getAdminAddons();
      setAddons(list || []);
    } catch (err) {
      console.error("Failed to load addons:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (addon: Addon) => {
    setSavingId(addon.id);
    setFeedback(null);
    try {
      await api.updateAddon(addon.id, {
        unitPrice: addon.unitPrice,
        availableDaysOfWeek: addon.availableDaysOfWeek,
        mealSlot: addon.mealSlot,
        maxDailyCapacity: addon.maxDailyCapacity,
        isActive: addon.isActive,
      });
      setFeedback(`Updated ${addon.name} scheduling and pricing.`);
      await loadAddons();
    } catch (err: any) {
      alert("Failed to update addon: " + err.message);
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
          <Layers className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Dietary Extras & Calendar Rules</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-[#081C15]">
          Add-on Management
        </h1>
        <p className="text-sm text-[#081C15]/70 mt-1 max-w-xl">
          Configure prices, available weekdays (e.g. Milk: Daily, Egg: MON,WED,FRI, Fish: TUE, Ice Cream: THU, Chicken: SUN), meal slots, and kitchen preparation capacity.
        </p>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-[#52796F]/15 border border-[#52796F]/40 text-xs font-semibold text-[#081C15] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#52796F]" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Add-ons List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {addons.map((addon) => (
          <div key={addon.id} className="glass-card rounded-2xl p-5 border border-[#52796F]/25 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#52796F]/20 mb-3">
                <h3 className="font-serif font-bold text-lg text-[#081C15]">{addon.name}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E8E3D9] text-[#081C15]">
                  {addon.code}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-[#081C15] block mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    value={addon.unitPrice}
                    onChange={(e) => {
                      const updated = addons.map((a) =>
                        a.id === addon.id ? { ...a, unitPrice: Number(e.target.value) } : a
                      );
                      setAddons(updated);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15] font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#081C15] block mb-1">Allowed Weekdays</label>
                  <input
                    type="text"
                    value={addon.availableDaysOfWeek}
                    onChange={(e) => {
                      const updated = addons.map((a) =>
                        a.id === addon.id ? { ...a, availableDaysOfWeek: e.target.value } : a
                      );
                      setAddons(updated);
                    }}
                    placeholder="DAILY or MON,WED,FRI or TUE"
                    className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15] font-mono"
                  />
                  <p className="text-[10px] text-[#081C15]/60 mt-0.5">Use DAILY or MON,WED,FRI or SUN</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-[#081C15] block mb-1">Meal Slot</label>
                    <select
                      value={addon.mealSlot}
                      onChange={(e) => {
                        const updated = addons.map((a) =>
                          a.id === addon.id ? { ...a, mealSlot: e.target.value as any } : a
                        );
                        setAddons(updated);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                    >
                      <option value="BREAKFAST">BREAKFAST</option>
                      <option value="LUNCH">LUNCH</option>
                      <option value="DINNER">DINNER</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-[#081C15] block mb-1">Max Capacity</label>
                    <input
                      type="number"
                      value={addon.maxDailyCapacity}
                      onChange={(e) => {
                        const updated = addons.map((a) =>
                          a.id === addon.id ? { ...a, maxDailyCapacity: Number(e.target.value) } : a
                        );
                        setAddons(updated);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id={`active-addon-${addon.id}`}
                    checked={addon.isActive === 1}
                    onChange={(e) => {
                      const updated = addons.map((a) =>
                        a.id === addon.id ? { ...a, isActive: e.target.checked ? 1 : 0 } : a
                      );
                      setAddons(updated);
                    }}
                    className="rounded text-[#081C15]"
                  />
                  <label htmlFor={`active-addon-${addon.id}`} className="font-semibold text-[#081C15]">
                    Available for student booking
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleUpdate(addon)}
              disabled={savingId === addon.id}
              className="w-full py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-bold shadow-md hover:bg-[#132F22] flex items-center justify-center gap-2 transition-all"
            >
              <Save className="w-3.5 h-3.5 text-[#52796F]" />
              <span>{savingId === addon.id ? "Saving..." : "Save Rule"}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
