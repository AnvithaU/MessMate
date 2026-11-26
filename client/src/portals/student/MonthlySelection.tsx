import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Check,
  Calendar,
  Lock,
  UtensilsCrossed,
} from "lucide-react";
import { API_BASE } from "../../services/api";

interface Mess {
  id: number;
  name: string;
  monthlyFee: number;
  description: string;
  cuisineType?: string;
}

interface Addon {
  id: number;
  name: string;
  description: string;
  pricePerDay: number;
  monthlyPrice: number | null;
  code?: string;
}

interface SelectionWindowInfo {
  isOpen: boolean;
  currentDate: string;
  targetMonthYear: string;
  windowStartDate: string;
  windowEndDate: string;
  message: string;
  existingSelection?: {
    id: number;
    messId: number;
    messName: string;
    feeCharged: number;
  } | null;
  existingAddonsCount?: number;
  existingAddons?: Array<{
    addonId: number;
    name: string;
    mealSlot: string;
    servingsCount: number;
  }>;
}

const API = API_BASE;
const tok = () => localStorage.getItem("messmate_token") ?? "";

interface MonthlySelectionProps {
  onNavigate?: (tab: string) => void;
}

export const MonthlySelection: React.FC<MonthlySelectionProps> = ({ onNavigate }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [messes, setMesses] = useState<Mess[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [windowInfo, setWindowInfo] = useState<SelectionWindowInfo | null>(null);
  const [selMess, setSelMess] = useState<number | null>(null);
  const [selAddons, setSelAddons] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Month labels
  const now = new Date();
  const currentMonthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  const targetDateObj = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const upcomingMonthLabel = targetDateObj.toLocaleString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    loadEnrolmentData();
  }, []);

  const loadEnrolmentData = async () => {
    setLoading(true);
    setError(null);
    const h = { Authorization: "Bearer " + tok() };

    try {
      // Parallel fetch with resilient JSON parsing
      const [messesRes, addonsRes, windowRes] = await Promise.all([
        fetch(API + "/student/messes", { headers: h }).then(async (r) => {
          if (!r.ok) throw new Error(`Messes API error (${r.status})`);
          return r.json();
        }),
        fetch(API + "/student/addons", { headers: h }).then(async (r) => {
          if (!r.ok) throw new Error(`Addons API error (${r.status})`);
          return r.json();
        }),
        fetch(API + "/student/selection-window", { headers: h }).then(async (r) => {
          if (!r.ok) return null;
          return r.json();
        }),
      ]);

      const messList = Array.isArray(messesRes) ? messesRes : [];
      const addonList = Array.isArray(addonsRes)
        ? addonsRes
        : Array.isArray(addonsRes?.addons)
        ? addonsRes.addons
        : [];

      setMesses(messList);
      setAddons(addonList);
      if (windowRes) {
        setWindowInfo(windowRes);
        // Pre-select if student already made a selection for upcoming month
        if (windowRes.existingSelection?.messId) {
          setSelMess(windowRes.existingSelection.messId);
        }
      }
    } catch (err: any) {
      console.error("Enrolment fetch error:", err);
      setError(
        err.message?.includes("Cannot reach")
          ? "Cannot reach MessMate server. Please ensure the backend is running on port 5000."
          : `Failed to load enrolment options: ${err.message || "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: number) =>
    setSelAddons((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const selMessObj = messes.find((m) => m.id === selMess);
  const selAddArr = addons.filter((a) => selAddons.has(a.id));
  const totalAddons = selAddArr.reduce((s, a) => s + (a.monthlyPrice ?? a.pricePerDay * 30), 0);
  const total = (selMessObj?.monthlyFee ?? 0) + totalAddons;

  const targetMonthYear = windowInfo?.targetMonthYear || `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}`;

  const submit = async () => {
    if (!selMess) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(API + "/student/enrolment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok() },
        body: JSON.stringify({
          monthYear: targetMonthYear,
          messId: selMess,
          addonIds: Array.from(selAddons),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Enrolment failed");
      setSuccess(
        `Enrolment confirmed for ${upcomingMonthLabel}. \u20B9${total.toFixed(0)} debited from your advance balance.`
      );
      // Notify sibling components (Overview, Wallet, Calendar) to refresh
      window.dispatchEvent(new CustomEvent("messmate:enrolment-updated"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--gold)" }} />
        <p className="text-xs font-medium" style={{ color: "rgba(8,28,21,0.6)" }}>
          Loading active mess and add-on options...
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center space-y-5 p-8 glass-card rounded-2xl border border-[#52796F]/25">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2"
          style={{ background: "rgba(197,160,89,0.12)" }}
        >
          <CheckCircle2 className="w-8 h-8" style={{ color: "var(--gold)" }} />
        </div>
        <h2 className="font-serif text-2xl font-bold" style={{ color: "var(--obsidian)" }}>
          Monthly Enrolment Confirmed
        </h2>
        <p className="text-sm" style={{ color: "rgba(8,28,21,0.65)" }}>
          {success}
        </p>

        <div
          className="p-4 rounded-xl text-left text-xs space-y-2"
          style={{ background: "rgba(8,28,21,0.03)", border: "1px solid rgba(82,121,111,0.2)" }}
        >
          <div className="flex justify-between">
            <span style={{ color: "rgba(8,28,21,0.6)" }}>Enrolment Month</span>
            <strong style={{ color: "var(--obsidian)" }}>{upcomingMonthLabel}</strong>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "rgba(8,28,21,0.6)" }}>Selected Mess</span>
            <strong style={{ color: "var(--obsidian)" }}>{selMessObj?.name || "Confirmed"}</strong>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "rgba(8,28,21,0.6)" }}>Booked Add-ons</span>
            <strong style={{ color: "var(--obsidian)" }}>
              {selAddArr.length > 0 ? selAddArr.map((a) => a.name.split("(")[0].trim()).join(", ") : "None"}
            </strong>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          {onNavigate && (
            <>
              <button
                onClick={() => onNavigate("addons")}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs shadow-sm transition-all"
                style={{ background: "var(--obsidian)", color: "#FAF8F5" }}
              >
                View Add-on Calendar
              </button>
              <button
                onClick={() => onNavigate("wallet")}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs border transition-all"
                style={{ borderColor: "rgba(197,160,89,0.5)", color: "var(--obsidian)", background: "rgba(197,160,89,0.1)" }}
              >
                Open QR Wallet
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Already Enrolled Lock Screen (One-time monthly booking enforced)
  if (windowInfo?.existingSelection) {
    const bookedAddons = windowInfo.existingAddons || [];
    return (
      <div className="max-w-lg mx-auto mt-10 text-center space-y-5 p-8 glass-card rounded-2xl border border-[#52796F]/25">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2"
          style={{ background: "rgba(197,160,89,0.12)" }}
        >
          <CheckCircle2 className="w-8 h-8" style={{ color: "var(--gold)" }} />
        </div>
        <h2 className="font-serif text-2xl font-bold" style={{ color: "var(--obsidian)" }}>
          Enrolment Locked for {upcomingMonthLabel}
        </h2>
        <p className="text-sm" style={{ color: "rgba(8,28,21,0.65)" }}>
          Your monthly mess and add-on selection has already been submitted and finalized. Duplicate bookings are not permitted.
        </p>

        <div
          className="p-4 rounded-xl text-left text-xs space-y-2"
          style={{ background: "rgba(8,28,21,0.03)", border: "1px solid rgba(82,121,111,0.2)" }}
        >
          <div className="flex justify-between">
            <span style={{ color: "rgba(8,28,21,0.6)" }}>Enrolment Month</span>
            <strong style={{ color: "var(--obsidian)" }}>{upcomingMonthLabel}</strong>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "rgba(8,28,21,0.6)" }}>Selected Mess</span>
            <strong style={{ color: "var(--obsidian)" }}>
              {windowInfo.existingSelection.messName} (₹{windowInfo.existingSelection.feeCharged})
            </strong>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "rgba(8,28,21,0.6)" }}>Booked Add-ons</span>
            <strong style={{ color: "var(--obsidian)" }}>
              {bookedAddons.length > 0
                ? bookedAddons.map((a) => `${a.name} (${a.servingsCount}d)`).join(", ")
                : "None"}
            </strong>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          {onNavigate && (
            <>
              <button
                onClick={() => onNavigate("addons")}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs shadow-sm transition-all"
                style={{ background: "var(--obsidian)", color: "#FAF8F5" }}
              >
                View Add-on Calendar
              </button>
              <button
                onClick={() => onNavigate("wallet")}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs border transition-all"
                style={{ borderColor: "rgba(197,160,89,0.5)", color: "var(--obsidian)", background: "rgba(197,160,89,0.1)" }}
              >
                Open QR Wallet
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Outside Selection Window Screen (Before 25th)
  if (windowInfo && !windowInfo.isOpen) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold" style={{ color: "var(--obsidian)" }}>
            Monthly Mess Enrolment
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(8,28,21,0.55)" }}>
            South/North mess coupon and monthly add-ons selection for {upcomingMonthLabel}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(197,160,89,0.15)", color: "var(--gold-dark)" }}
            >
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: "var(--obsidian)" }}>
                Selection Window Closed
              </h3>
              <p className="text-xs" style={{ color: "rgba(8,28,21,0.55)" }}>
                Window opens from the 25th through the last calendar day of every month.
              </p>
            </div>
          </div>

          <div
            className="p-4 rounded-xl space-y-2 text-xs"
            style={{ background: "rgba(8,28,21,0.03)", border: "1px solid rgba(82,121,111,0.15)" }}
          >
            <div className="flex justify-between">
              <span style={{ color: "rgba(8,28,21,0.6)" }}>Current Date (Kolkata Time):</span>
              <strong style={{ color: "var(--obsidian)" }}>{windowInfo.currentDate}</strong>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "rgba(8,28,21,0.6)" }}>Next Window Opens:</span>
              <strong style={{ color: "var(--gold-dark)" }}>{windowInfo.windowStartDate}</strong>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "rgba(8,28,21,0.6)" }}>Window Closes:</span>
              <strong style={{ color: "var(--obsidian)" }}>{windowInfo.windowEndDate}</strong>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "rgba(8,28,21,0.6)" }}>Applicable Month:</span>
              <strong style={{ color: "var(--obsidian)" }}>{upcomingMonthLabel}</strong>
            </div>
          </div>

          {windowInfo.existingSelection ? (
            <div
              className="p-4 rounded-xl text-xs space-y-2"
              style={{ background: "rgba(82,121,111,0.08)", border: "1px solid rgba(82,121,111,0.2)" }}
            >
              <p className="font-bold uppercase tracking-wider" style={{ color: "var(--olive)" }}>
                Existing Selection for {upcomingMonthLabel}
              </p>
              <div className="flex justify-between">
                <span>Selected Mess:</span>
                <strong>{windowInfo.existingSelection.messName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Monthly Fee Charged:</span>
                <strong>&#8377;{windowInfo.existingSelection.feeCharged.toLocaleString()}</strong>
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color: "rgba(8,28,21,0.5)" }}>
              No advance selection has been recorded yet for {upcomingMonthLabel}. The portal will open automatically on the 25th.
            </p>
          )}
        </div>
      </div>
    );
  }

  const steps = ["Mess Selection", "Monthly Add-ons", "Review & Confirm"];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ background: "rgba(82,121,111,0.12)", color: "var(--olive)" }}
          >
            Selection Window Active (25th &ndash; End of Month)
          </span>
        </div>
        <h1 className="font-serif text-3xl font-bold" style={{ color: "var(--obsidian)" }}>
          Monthly Enrolment
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(8,28,21,0.55)" }}>
          Selecting South/North mess &amp; monthly add-ons for <strong>{upcomingMonthLabel}</strong>
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center">
        {steps.map((lbl, i) => {
          const n = i + 1;
          const done = step > n;
          const active = step === n;
          return (
            <React.Fragment key={lbl}>
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                  style={{
                    background: done ? "var(--gold)" : active ? "var(--obsidian)" : "rgba(8,28,21,0.08)",
                    color: done || active ? "white" : "rgba(8,28,21,0.4)",
                  }}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : n}
                </div>
                <span
                  className="text-xs font-semibold hidden sm:block"
                  style={{ color: active ? "var(--obsidian)" : "rgba(8,28,21,0.4)" }}
                >
                  {lbl}
                </span>
              </div>
              {i < 2 && (
                <div
                  className="flex-1 h-px mx-3"
                  style={{ background: done ? "var(--gold)" : "rgba(8,28,21,0.1)" }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {error && (
        <div
          className="p-3.5 rounded-xl flex items-start gap-2.5 text-xs"
          style={{
            background: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.2)",
            color: "#b91c1c",
          }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1 — Mess Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold" style={{ color: "var(--obsidian)" }}>
              Step 1: Choose Mess Coupon
            </h2>
            <span className="text-xs font-semibold" style={{ color: "var(--olive)" }}>
              Exactly one choice
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {messes.map((m) => {
              const sel = selMess === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelMess(m.id);
                    setError(null);
                  }}
                  className="text-left p-5 rounded-2xl border-2 transition-all glass-card"
                  style={{
                    borderColor: sel ? "var(--gold)" : "rgba(197,160,89,0.15)",
                    background: sel ? "rgba(197,160,89,0.06)" : "rgba(255,255,255,0.76)",
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-serif text-lg font-bold" style={{ color: "var(--obsidian)" }}>
                      {m.name}
                    </span>
                    {sel && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: "var(--gold)" }}
                      >
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs mb-4 line-clamp-3" style={{ color: "rgba(8,28,21,0.55)" }}>
                    {m.description}
                  </p>
                  <span
                    className="text-xs font-semibold uppercase tracking-wider block"
                    style={{ color: "var(--olive)" }}
                  >
                    &#8377;{m.monthlyFee.toLocaleString()} / month
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                if (selMess) {
                  setError(null);
                  setStep(2);
                } else setError("Please choose South Mess or North Mess to continue.");
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: "var(--obsidian)",
                color: "var(--gold-light)",
                boxShadow: "0 4px 14px -4px rgba(8,28,21,0.3)",
              }}
            >
              Continue to Add-ons <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Monthly Add-ons */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-serif text-xl font-semibold" style={{ color: "var(--obsidian)" }}>
              Step 2: Monthly Add-ons ({upcomingMonthLabel})
            </h2>
            <p className="text-xs mt-1" style={{ color: "rgba(8,28,21,0.5)" }}>
              Select any combination or none. Add-ons apply for the entire month following their fixed weekly schedule.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {addons.map((a) => {
              const sel = selAddons.has(a.id);
              const price = a.monthlyPrice ?? a.pricePerDay * 30;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="text-left p-4 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: sel ? "var(--gold)" : "rgba(197,160,89,0.12)",
                    background: sel ? "rgba(197,160,89,0.05)" : "white",
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold" style={{ color: "var(--obsidian)" }}>
                      {a.name}
                    </span>
                    <div
                      className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: sel ? "var(--gold)" : "rgba(8,28,21,0.2)",
                        background: sel ? "var(--gold)" : "transparent",
                      }}
                    >
                      {sel && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                  </div>
                  <p className="text-xs mb-2" style={{ color: "rgba(8,28,21,0.5)" }}>
                    {a.description}
                  </p>
                  <span className="text-xs font-semibold" style={{ color: "var(--olive)" }}>
                    +&#8377;{price.toFixed(0)} / mo
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-all"
              style={{ borderColor: "rgba(8,28,21,0.15)", color: "rgba(8,28,21,0.6)" }}
            >
              <ChevronLeft className="w-4 h-4" /> Back to Mess
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep(3);
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: "var(--obsidian)",
                color: "var(--gold-light)",
                boxShadow: "0 4px 14px -4px rgba(8,28,21,0.3)",
              }}
            >
              Review &amp; Confirm <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Review & Confirm */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="font-serif text-xl font-semibold" style={{ color: "var(--obsidian)" }}>
            Step 3: Review &amp; Confirm
          </h2>
          <div className="rounded-2xl p-6 space-y-4 glass-card">
            <div className="flex justify-between text-sm">
              <span style={{ color: "rgba(8,28,21,0.6)" }}>Enrolment Month</span>
              <span className="font-bold" style={{ color: "var(--obsidian)" }}>
                {upcomingMonthLabel}
              </span>
            </div>
            <div className="gold-divider" />
            <div className="flex justify-between text-sm">
              <span style={{ color: "rgba(8,28,21,0.6)" }}>Selected Mess Coupon</span>
              <span className="font-bold" style={{ color: "var(--obsidian)" }}>
                {selMessObj?.name}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "rgba(8,28,21,0.6)" }}>Mess Fee</span>
              <span>&#8377;{selMessObj?.monthlyFee?.toLocaleString()}</span>
            </div>

            <div className="gold-divider" />
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(8,28,21,0.5)" }}>
              Monthly Add-on Subscriptions ({selAddArr.length})
            </div>
            {selAddArr.length > 0 ? (
              selAddArr.map((a) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span style={{ color: "rgba(8,28,21,0.7)" }}>{a.name}</span>
                  <span>&#8377;{(a.monthlyPrice ?? a.pricePerDay * 30).toFixed(0)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs" style={{ color: "rgba(8,28,21,0.45)" }}>
                No add-ons selected for this month.
              </p>
            )}

            <div className="gold-divider" />
            <div className="flex justify-between font-bold text-base">
              <span style={{ color: "var(--obsidian)" }}>Total Monthly Charge</span>
              <span style={{ color: "var(--gold-dark)" }}>&#8377;{total.toLocaleString()}</span>
            </div>
          </div>

          <p className="text-xs" style={{ color: "rgba(8,28,21,0.45)" }}>
            This amount will be debited from your advance payment balance. Both mess choice and add-on selections apply for the entirety of {upcomingMonthLabel}.
          </p>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border"
              style={{ borderColor: "rgba(8,28,21,0.15)", color: "rgba(8,28,21,0.6)" }}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-70"
              style={{
                background: "linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%)",
                color: "var(--obsidian)",
                boxShadow: "0 4px 14px -4px rgba(197,160,89,0.5)",
              }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {submitting ? "Submitting Enrolment..." : "Confirm & Enroll"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
