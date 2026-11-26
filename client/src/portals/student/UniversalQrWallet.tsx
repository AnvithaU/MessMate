import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  Info,
  UtensilsCrossed,
  Download,
} from "lucide-react";

export const UniversalQrWallet: React.FC = () => {
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    loadWallet();
    // Re-fetch when enrolment is submitted
    const handler = () => loadWallet();
    window.addEventListener("messmate:enrolment-updated", handler);
    return () => window.removeEventListener("messmate:enrolment-updated", handler);
  }, []);

  const loadWallet = async () => {
    try {
      const res = await api.getWallet();
      setWallet(res);
    } catch (err) {
      console.error("Wallet load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    if (wallet?.universalQr?.token) {
      navigator.clipboard.writeText(wallet.universalQr.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadQrAsPng = () => {
    const svg = document.getElementById("student-qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = 3;
      const padding = 32;
      canvas.width = img.width * scale + padding * 2;
      canvas.height = img.height * scale + padding * 2 + 70;

      if (ctx) {
        // High quality solid white background for reliable scanning
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw QR
        ctx.drawImage(img, padding, padding, img.width * scale, img.height * scale);

        // Header and student information
        ctx.fillStyle = "#081C15";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(qr?.fullName || "MessMate Student", canvas.width / 2, canvas.height - 44);

        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#52796F";
        ctx.fillText(
          `${qr?.studentId || ""} • ${qr?.department || ""} • Room ${qr?.roomNumber || ""}`,
          canvas.width / 2,
          canvas.height - 24
        );

        ctx.font = "bold 10px sans-serif";
        ctx.fillStyle = "#C5A059";
        ctx.fillText("NMAMIT HOSTELS • OFFICIAL MESS PASS", canvas.width / 2, canvas.height - 8);

        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = "MessMate_QR_Student.png";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-3 border-[#52796F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const qr = wallet?.universalQr;
  const today = wallet?.today;
  const upcoming = wallet?.upcoming || [];
  const upcomingEnrolment = wallet?.upcomingEnrolment;
  const upcomingMonthLabel = upcomingEnrolment?.monthYear
    ? new Date(`${upcomingEnrolment.monthYear}-01T00:00:00Z`).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#52796F]/15 text-[#081C15] border border-[#52796F]/30 mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Universal Cryptographic Identity</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-[#081C15]">
          Digital Mess Pass & Coupon Wallet
        </h1>
        <p className="text-sm text-[#081C15]/70 mt-1 max-w-2xl">
          You have <strong>ONE universal QR code</strong> that verifies your identity and instantly unlocks all eligible meals and add-on bookings when scanned at the counter.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 2. Permanent Universal QR Card (4 Cols) */}
        <div className="lg:col-span-5">
          <div className="glass-card-dark rounded-3xl p-7 text-center relative overflow-hidden shadow-2xl border border-[#52796F]/40">
            {/* Ambient Lighting Circles */}
            <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-[#52796F]/20 blur-3xl" />
            <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full bg-[#C5A059]/20 blur-3xl" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 text-[#E8C97A] border border-white/20 mb-4">
                <Sparkles className="w-3 h-3" /> Universal Identity
              </div>

              <h2 className="text-2xl font-serif font-bold text-white">
                {qr?.fullName || "Student Name"}
              </h2>
              <p className="text-xs text-[#FAF8F5]/70 mt-0.5">
                Roll No: <span className="font-semibold text-white">{qr?.studentId}</span> • {qr?.department}
              </p>

              {/* QR Code Container */}
              <div className="my-5 p-5 rounded-2xl bg-white shadow-2xl inline-block border-4 border-white/20">
                <QRCodeSVG
                  id="student-qr-svg"
                  value={qr?.token || "MM-QR-DEFAULT"}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Download QR Button */}
              <div className="mb-5 flex justify-center">
                <button
                  onClick={downloadQrAsPng}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#D4AF37] hover:from-[#B8924B] hover:to-[#C5A059] text-[#081C15] font-bold text-xs shadow-lg flex items-center gap-2 transform active:scale-95 transition-all"
                  title="Download permanent QR pass as high-resolution PNG"
                >
                  <Download className="w-4 h-4 text-[#081C15]" />
                  <span>Download QR Pass (PNG)</span>
                </button>
              </div>

              {/* Token Display Pill */}
              <div className="p-3 rounded-xl bg-black/30 border border-white/15 flex items-center justify-between text-xs text-[#FAF8F5]/90 mb-4">
                <span className="font-mono text-[11px] truncate mr-2">
                  {qr?.token || "Generating..."}
                </span>
                <button
                  onClick={copyToken}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1 flex-shrink-0"
                  title="Copy QR token"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#52796F]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[10px] font-medium">{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 text-xs text-[#FAF8F5]/70 border-t border-white/10 pt-4">
                <span>Room: <strong className="text-white">{qr?.roomNumber}</strong></span>
                <span>•</span>
                <span>Status: <strong className="text-[#52796F]">{qr?.status || "ACTIVE"}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Today's Entitlements & Upcoming Bookings (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Confirmed Upcoming Monthly Enrolment Banner */}
          {upcomingEnrolment?.messSelection && (
            <div className="glass-card rounded-2xl p-5 border border-[#C5A059]/45 bg-[#C5A059]/10">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#C5A059]" />
                  <h3 className="text-base font-serif font-bold text-[#081C15]">
                    Confirmed Enrolment — {upcomingMonthLabel}
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#081C15] text-[#E8C97A]">
                  Active from {upcomingEnrolment.monthYear}-01
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/80 border border-[#52796F]/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#52796F] block">
                    Selected Mess
                  </span>
                  <strong className="text-sm text-[#081C15]">
                    {upcomingEnrolment.messSelection.messName}
                  </strong>
                  <span className="block text-[11px] text-[#081C15]/60 mt-0.5">
                    ₹{upcomingEnrolment.messSelection.feeCharged}/month
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/80 border border-[#52796F]/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#52796F] block">
                    Booked Add-ons ({upcomingEnrolment.bookedAddons?.length || 0})
                  </span>
                  {upcomingEnrolment.bookedAddons?.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {upcomingEnrolment.bookedAddons.map((a: any) => (
                        <div key={a.addonId} className="flex items-center justify-between text-[11px]">
                          <strong className="text-[#081C15]">{a.name}</strong>
                          <span className="text-[#52796F] font-semibold">
                            {a.servingsCount} days ({a.mealSlot})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#081C15]/60 mt-1 block">No add-ons selected</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Today's Live Deck */}
          <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#52796F]/20">
              <div>
                <h3 className="text-xl font-serif font-bold text-[#081C15]">
                  Today's Entitlements ({today?.date})
                </h3>
                <p className="text-xs text-[#081C15]/70">
                  Enrolled Mess:{" "}
                  <strong>
                    {today?.selectedMess ||
                      (upcomingEnrolment?.messSelection
                        ? `None for current month (${upcomingEnrolment.messSelection.messName} starts ${upcomingEnrolment.monthYear}-01)`
                        : "None Selected")}
                  </strong>
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#52796F]/15 text-[#081C15]">
                {today?.currentSlot} Slot Active
              </span>
            </div>

            <div className="space-y-2.5">
              {(!today?.entitlements || today.entitlements.length === 0) && (
                <div className="p-4 rounded-xl bg-[#E8E3D9]/40 text-xs text-[#081C15]/70 text-center">
                  No active meal or add-on entitlements for today ({today?.date}).
                </div>
              )}
              {today?.entitlements?.map((ent: any, idx: number) => {
                const isAvailable = ent.status === "AVAILABLE";
                const isRedeemed = ent.status === "REDEEMED";

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      isAvailable
                        ? "bg-white/90 border-[#52796F]/40 shadow-sm"
                        : isRedeemed
                        ? "bg-[#52796F]/15 border-[#52796F]/30"
                        : "bg-[#E8E3D9]/30 border-transparent text-[#081C15]/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#52796F]">
                          {ent.category === "MESS_MEAL" ? "Mess Regular" : "Add-on"}
                        </span>
                        <span className="text-[10px] text-[#081C15]/60">• {ent.mealSlot}</span>
                      </div>
                      <h4 className="font-semibold text-sm text-[#081C15] mt-0.5">
                        {ent.itemName}
                      </h4>
                      <p className="text-[11px] text-[#081C15]/70">{ent.details}</p>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      {isAvailable && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#52796F] bg-[#52796F]/20 px-3 py-1 rounded-full border border-[#52796F]/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Available
                        </span>
                      )}
                      {isRedeemed && (
                        <div>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#081C15] bg-white/80 px-3 py-1 rounded-full border border-[#52796F]/30">
                            <Clock className="w-3.5 h-3.5 text-[#52796F]" /> Redeemed
                          </span>
                          {ent.redeemedAt && (
                            <span className="text-[10px] text-[#081C15]/60 block mt-1">
                              {new Date(ent.redeemedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      )}
                      {!isAvailable && !isRedeemed && (
                        <span className="text-[11px] font-medium text-[#081C15]/50 bg-black/5 px-2.5 py-1 rounded-full">
                          {ent.status === "NOT_SELECTED" ? "Not Booked" : "Closed Today"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Entitlements List */}
          <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
            <h3 className="text-xl font-serif font-bold text-[#081C15] mb-3">
              Upcoming Booked Entitlements
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-xs text-[#081C15]/60 py-4 text-center">
                No future add-on bookings found. Visit the Add-ons Calendar to schedule extras.
              </p>
            ) : (
              <div className="divide-y divide-[#52796F]/15 text-xs">
                {upcoming.slice(0, 6).map((item: any) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[#081C15]">{item.itemName}</span>
                      <span className="text-[#081C15]/60 ml-2">({item.mealSlot})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-[#081C15]/80">{item.applicableDate}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#52796F]/15 text-[#081C15]">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
