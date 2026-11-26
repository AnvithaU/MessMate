import React, { useState, useEffect, useCallback } from "react";
import { api } from "../../services/api";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Milk,
  Egg,
  Fish,
  IceCream,
  Drumstick,
  Utensils,
  RefreshCw,
  Info,
  AlertCircle,
  Check,
} from "lucide-react";

type AddonStatus = "AVAILABLE" | "REDEEMED" | "EXPIRED" | "CANCELLED" | "NOT_SELECTED" | "NOT_SCHEDULED" | "PENDING";

interface DayAddon {
  addonId: number;
  code: string;
  name: string;
  fullName: string;
  mealSlot: string;
  unitPrice: number;
  schedule: string;
  isOptedIn: boolean;
  isScheduledToday: boolean;
  entitlementId: number | null;
  status: AddonStatus;
  redeemedAt: string | null;
}

interface CalendarDay {
  date: string;
  dayOfMonth: number;
  weekday: string;
  weekdayFull: string;
  isToday: boolean;
  messName: string | null;
  messStatus: string;
  messEntitlementId: number | null;
  addons: DayAddon[];
  hasAnyEntitlement: boolean;
  redeemedCount: number;
  availableCount: number;
}

interface CalendarData {
  monthYear: string;
  year: number;
  month: number;
  daysInMonth: number;
  messSelection: any;
  optedInAddonIds: number[];
  allAddons: any[];
  days: CalendarDay[];
}

const ADDON_ICONS: Record<string, React.ComponentType<any>> = {
  MILK: Milk,
  EGG: Egg,
  FISH: Fish,
  ICE_CREAM: IceCream,
  CHICKEN: Drumstick,
};

const STATUS_CONFIG: Record<AddonStatus, { label: string; dotColor: string; textColor: string; bg: string }> = {
  AVAILABLE:    { label: "Available",    dotColor: "#52796F", textColor: "#081C15", bg: "bg-[#52796F]/15" },
  REDEEMED:     { label: "Redeemed",     dotColor: "#C5A059", textColor: "#081C15", bg: "bg-[#C5A059]/15" },
  EXPIRED:      { label: "Expired",      dotColor: "#9ca3af", textColor: "#6b7280", bg: "bg-gray-100" },
  CANCELLED:    { label: "Cancelled",    dotColor: "#ef4444", textColor: "#dc2626", bg: "bg-rose-50" },
  NOT_SELECTED: { label: "Not Booked",   dotColor: "#d1d5db", textColor: "#9ca3af", bg: "bg-gray-50" },
  NOT_SCHEDULED:{ label: "Off Schedule", dotColor: "#e5e7eb", textColor: "#d1d5db", bg: "bg-gray-50/50" },
  PENDING:      { label: "Pending",      dotColor: "#f59e0b", textColor: "#b45309", bg: "bg-amber-50" },
};

function getKolkataMonthYear(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit",
  }).format(new Date()).slice(0, 7);
}

function formatMonthLabel(monthYear: string): string {
  const [year, month] = monthYear.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function prevMonth(my: string): string {
  const [y, m] = my.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonth(my: string): string {
  const [y, m] = my.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export const AddonBooking: React.FC = () => {
  const currentMY = getKolkataMonthYear();
  const [monthYear, setMonthYear] = useState<string>(currentMY);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadCalendar = useCallback(async (my: string) => {
    setLoading(true);
    setFeedback(null);
    try {
      const data = await api.getStudentCalendar(my);
      setCalendarData(data);
      // If currently selected day changes month, clear it
      setSelectedDay((prev) => {
        if (prev && !prev.date.startsWith(my)) return null;
        // Refresh selected day data from new calendar data
        if (prev) {
          const refreshed = data.days.find((d: CalendarDay) => d.date === prev.date);
          return refreshed || null;
        }
        return prev;
      });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to load calendar data." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendar(monthYear);
  }, [monthYear, loadCalendar]);

  useEffect(() => {
    const handler = () => loadCalendar(monthYear);
    window.addEventListener("messmate:enrolment-updated", handler);
    return () => window.removeEventListener("messmate:enrolment-updated", handler);
  }, [monthYear, loadCalendar]);

  const handleDayClick = (day: CalendarDay) => {
    setSelectedDay((prev) => (prev?.date === day.date ? null : day));
  };

  const getDayDotColor = (day: CalendarDay): string => {
    if (day.redeemedCount > 0) return "#C5A059";
    if (day.availableCount > 0) return "#52796F";
    if (day.hasAnyEntitlement) return "#9ca3af";
    return "transparent";
  };

  const getDayBg = (day: CalendarDay, isSelected: boolean): string => {
    if (isSelected) return "bg-[#081C15] border-[#C5A059] ring-2 ring-[#C5A059]";
    if (day.isToday) return "bg-[#C5A059]/10 border-[#C5A059]/50";
    if (day.redeemedCount > 0 && day.availableCount === 0) return "bg-[#52796F]/10 border-[#52796F]/30";
    if (day.availableCount > 0) return "bg-white/90 border-[#52796F]/40 hover:border-[#52796F] hover:shadow-sm";
    return "bg-white/40 border-[#E8E3D9] hover:bg-white/60";
  };

  // Build the first weekday offset for the month grid
  const getMonthStartOffset = (): number => {
    if (!calendarData) return 0;
    const firstDay = new Date(`${calendarData.monthYear}-01T00:00:00Z`);
    return firstDay.getUTCDay(); // 0=Sun
  };

  const AddonStatusPill: React.FC<{ status: AddonStatus; small?: boolean }> = ({ status, small }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NOT_SCHEDULED;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${small ? "text-[9px]" : "text-[10px]"} ${cfg.bg}`}
        style={{ color: cfg.textColor }}>
        <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: cfg.dotColor }} />
        {cfg.label}
      </span>
    );
  };

  const AddonIcon: React.FC<{ code: string; className?: string }> = ({ code, className }) => {
    const Icon = ADDON_ICONS[code] || Sparkles;
    return <Icon className={className || "w-4 h-4"} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#52796F]/15 text-[#081C15] border border-[#52796F]/30 mb-2">
            <CalendarDays className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Live Entitlement Calendar</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#081C15]">Add-on Calendar</h1>
          <p className="text-sm text-[#081C15]/70 mt-1 max-w-xl">
            Your actual add-on entitlements for each date — driven by your monthly booking and kitchen schedules.
          </p>
        </div>

        {/* Summary Pills */}
        {calendarData && (
          <div className="flex flex-wrap gap-2 items-center">
            {calendarData.allAddons.filter((a: any) => calendarData.optedInAddonIds.includes(a.id)).map((a: any) => (
              <div key={a.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#52796F]/12 border border-[#52796F]/25 text-xs font-semibold text-[#081C15]">
                <AddonIcon code={a.code} className="w-3.5 h-3.5 text-[#52796F]" />
                {a.name.split("(")[0].trim()}
              </div>
            ))}
            {calendarData.optedInAddonIds.length === 0 && (
              <p className="text-xs text-[#081C15]/50 italic">No add-ons booked for this month. Use the Enrolment tab during the 25th–end window.</p>
            )}
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
          feedback.type === "success" ? "bg-[#52796F]/15 border-[#52796F]/40 text-[#081C15]" : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          {feedback.type === "success" ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#52796F]" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Panel */}
        <div className="lg:col-span-8">
          <div className="glass-card rounded-2xl border border-[#52796F]/25 overflow-hidden">
            {/* Month Nav */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#52796F]/15">
              <button
                onClick={() => setMonthYear(prevMonth(monthYear))}
                className="p-2 rounded-xl hover:bg-[#E8E3D9] text-[#081C15] transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center">
                <h2 className="font-serif font-bold text-lg text-[#081C15]">{formatMonthLabel(monthYear)}</h2>
                {monthYear === currentMY && (
                  <span className="text-[10px] text-[#52796F] font-semibold uppercase tracking-wider">Current Month</span>
                )}
                {monthYear !== currentMY && (
                  <button onClick={() => setMonthYear(currentMY)} className="text-[10px] text-[#C5A059] font-semibold uppercase tracking-wider hover:underline">
                    Back to Today
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => loadCalendar(monthYear)}
                  className="p-2 rounded-xl hover:bg-[#E8E3D9] text-[#081C15] transition-all"
                  title="Refresh calendar"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMonthYear(nextMonth(monthYear))}
                  className="p-2 rounded-xl hover:bg-[#E8E3D9] text-[#081C15] transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-[#52796F]/10">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-[#081C15]/50 py-2">
                  {d}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center min-h-[320px]">
                <div className="w-8 h-8 border-3 border-[#52796F] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : calendarData ? (
              <div className="p-3">
                <div className="grid grid-cols-7 gap-1.5">
                  {/* Offset empty cells */}
                  {Array.from({ length: getMonthStartOffset() }).map((_, i) => (
                    <div key={`pad-${i}`} />
                  ))}

                  {/* Day cells */}
                  {calendarData.days.map((day) => {
                    const isSelected = selectedDay?.date === day.date;
                    const entitledAddons = day.addons.filter((a) => a.isOptedIn && a.isScheduledToday);
                    const redeemedAddons = day.addons.filter((a) => a.status === "REDEEMED");

                    return (
                      <button
                        key={day.date}
                        onClick={() => handleDayClick(day)}
                        className={`relative rounded-xl border p-1.5 text-left transition-all min-h-[72px] ${getDayBg(day, isSelected)}`}
                      >
                        {/* Day number */}
                        <div className={`text-sm font-bold leading-none mb-1 ${isSelected ? "text-white" : day.isToday ? "text-[#C5A059]" : "text-[#081C15]"}`}>
                          {day.dayOfMonth}
                        </div>

                        {/* Mess pill */}
                        {day.messName && (
                          <div className={`text-[8px] font-semibold truncate mb-0.5 ${isSelected ? "text-white/70" : "text-[#52796F]"}`}>
                            <Utensils className="w-2 h-2 inline-block mr-0.5" />
                            {day.messStatus === "REDEEMED" ? "✓" : ""}{day.messName.replace(" Mess", "")}
                          </div>
                        )}

                        {/* Addon dots */}
                        {entitledAddons.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {entitledAddons.map((a) => {
                              const Icon = ADDON_ICONS[a.code] || Sparkles;
                              const isRed = a.status === "REDEEMED";
                              return (
                                <div
                                  key={a.addonId}
                                  className={`w-4 h-4 rounded-md flex items-center justify-center ${isRed ? "bg-[#C5A059]/30" : "bg-[#52796F]/20"}`}
                                  title={`${a.name}: ${a.status}`}
                                >
                                  <Icon className={`w-2.5 h-2.5 ${isSelected ? "text-white/80" : isRed ? "text-[#C5A059]" : "text-[#52796F]"}`} />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Summary badges */}
                        {day.isToday && !isSelected && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#C5A059]" />
                        )}
                        {redeemedAddons.length > 0 && (
                          <div className="absolute bottom-1 right-1">
                            <Check className={`w-2.5 h-2.5 ${isSelected ? "text-[#E8C97A]" : "text-[#52796F]"}`} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Legend */}
            <div className="px-5 py-3 border-t border-[#52796F]/10 flex flex-wrap gap-4 text-[10px] text-[#081C15]/60">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#52796F]/15 border border-[#52796F]/30 inline-block" /> Available</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#C5A059]/15 border border-[#C5A059]/30 inline-block" /> Redeemed</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] inline-block" /> Today</span>
              <span className="flex items-center gap-1.5"><Check className="w-2.5 h-2.5 text-[#52796F]" /> Partially served</span>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-4">
          {selectedDay ? (
            <div className="glass-card rounded-2xl border border-[#52796F]/25 p-5 space-y-4 sticky top-20">
              {/* Day Header */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#52796F]">
                    {selectedDay.weekdayFull}
                  </span>
                  {selectedDay.isToday && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#C5A059]/15 text-[#C5A059]">Today</span>
                  )}
                </div>
                <h3 className="text-2xl font-serif font-bold text-[#081C15]">
                  {new Date(selectedDay.date + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
                </h3>
              </div>

              {/* Mess Row */}
              <div className="p-3 rounded-xl border border-[#52796F]/20 bg-white/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#081C15]/8 flex items-center justify-center">
                    <Utensils className="w-4 h-4 text-[#081C15]/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#081C15]/50">Monthly Mess</p>
                    <p className="text-sm font-semibold text-[#081C15] truncate">
                      {selectedDay.messName || "No mess selected"}
                    </p>
                  </div>
                  <AddonStatusPill status={selectedDay.messStatus as AddonStatus} small />
                </div>
              </div>

              {/* Add-on Rows (only booked add-ons) */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#081C15]/50">Booked Add-ons</p>
                {(() => {
                  const bookedAddons = (calendarData?.allAddons || []).filter((addon: any) =>
                    calendarData?.optedInAddonIds?.includes(addon.id)
                  );
                  if (bookedAddons.length === 0) {
                    return (
                      <div className="p-3 rounded-xl bg-white/50 border border-[#E8E3D9] text-xs text-[#081C15]/60">
                        No add-ons booked for this month.
                      </div>
                    );
                  }
                  return bookedAddons.map((addon: any) => {
                    const dayAddon = selectedDay.addons.find((a) => a.addonId === addon.id);
                    if (!dayAddon) return null;
                    const Icon = ADDON_ICONS[addon.code] || Sparkles;
                    const isEntitled = dayAddon.isOptedIn && dayAddon.isScheduledToday;

                    return (
                      <div
                        key={addon.id}
                        className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                          dayAddon.status === "REDEEMED"
                            ? "bg-[#C5A059]/8 border-[#C5A059]/25"
                            : dayAddon.status === "AVAILABLE"
                            ? "bg-white/80 border-[#52796F]/30"
                            : isEntitled && dayAddon.status === "PENDING"
                            ? "bg-amber-50 border-amber-200"
                            : "bg-white/30 border-[#E8E3D9] opacity-60"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          dayAddon.status === "REDEEMED" ? "bg-[#C5A059]/20" : isEntitled ? "bg-[#52796F]/15" : "bg-gray-100"
                        }`}>
                          <Icon className={`w-4 h-4 ${
                            dayAddon.status === "REDEEMED" ? "text-[#C5A059]" : isEntitled ? "text-[#52796F]" : "text-gray-400"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#081C15] truncate">{dayAddon.name}</p>
                          <p className="text-[10px] text-[#081C15]/50">
                            {dayAddon.mealSlot} • {dayAddon.isScheduledToday ? addon.availableDaysOfWeek === "DAILY" ? "Daily" : addon.availableDaysOfWeek : "Off today"}
                          </p>
                          {dayAddon.redeemedAt && (
                            <p className="text-[9px] text-[#C5A059] font-medium mt-0.5">
                              Served at {new Date(dayAddon.redeemedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                        <AddonStatusPill status={dayAddon.status} small />
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Summary Footer */}
              <div className="pt-3 border-t border-[#52796F]/15 grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-[#52796F]/8 text-center">
                  <p className="font-bold text-lg text-[#081C15]">{selectedDay.availableCount}</p>
                  <p className="text-[#081C15]/60 font-medium">Available</p>
                </div>
                <div className="p-2.5 rounded-lg bg-[#C5A059]/8 text-center">
                  <p className="font-bold text-lg text-[#081C15]">{selectedDay.redeemedCount}</p>
                  <p className="text-[#081C15]/60 font-medium">Redeemed</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDay(null)}
                className="w-full py-2 rounded-xl text-xs font-semibold text-[#081C15]/60 hover:bg-[#E8E3D9] transition-all"
              >
                Close Detail View
              </button>
            </div>
          ) : (
            <div className="glass-card rounded-2xl border border-[#52796F]/25 p-6 text-center flex flex-col items-center justify-center min-h-[320px]">
              <CalendarDays className="w-10 h-10 text-[#52796F]/40 mb-3" />
              <h3 className="font-serif font-bold text-[#081C15] mb-1">Select a Day</h3>
              <p className="text-xs text-[#081C15]/50 max-w-xs">
                Click any calendar date to see your exact mess and add-on entitlements for that day, including redemption status.
              </p>

              {calendarData && (
                <div className="mt-5 w-full space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#081C15]/40 mb-2">Month Summary</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-[#52796F]/8 text-center">
                      <p className="font-bold text-base text-[#081C15]">
                        {calendarData.days.reduce((sum: number, d: CalendarDay) => sum + d.availableCount, 0)}
                      </p>
                      <p className="text-[#081C15]/60">Remaining</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#C5A059]/8 text-center">
                      <p className="font-bold text-base text-[#081C15]">
                        {calendarData.days.reduce((sum: number, d: CalendarDay) => sum + d.redeemedCount, 0)}
                      </p>
                      <p className="text-[#081C15]/60">Redeemed</p>
                    </div>
                  </div>
                  {calendarData.messSelection && (
                    <div className="p-3 rounded-xl bg-white/70 border border-[#52796F]/20 text-left">
                      <p className="text-[10px] text-[#081C15]/50 font-semibold uppercase tracking-wider">Active Mess</p>
                      <p className="text-sm font-bold text-[#081C15]">{calendarData.messSelection.messName}</p>
                      <p className="text-[10px] text-[#52796F]">₹{calendarData.messSelection.feeCharged}/month</p>
                    </div>
                  )}
                  {calendarData.optedInAddonIds.length === 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-left flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-800">No Add-ons Booked</p>
                        <p className="text-[10px] text-amber-700 mt-0.5">Go to <strong>Enrolment</strong> during the 25th–end window to book add-ons for next month.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
