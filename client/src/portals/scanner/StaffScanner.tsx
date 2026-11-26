import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../../services/api";
import { Html5Qrcode } from "html5-qrcode";
import { CameraModal } from "./CameraModal";
import {
  ScanLine,
  Camera,
  Search,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  UtensilsCrossed,
  ShieldCheck,
  Check,
  RefreshCw,
  XCircle,
  User,
  CheckSquare,
  Square,
  FileImage,
} from "lucide-react";
import confetti from "canvas-confetti";

function safeConfetti() {
  try {
    if (typeof confetti === "function") {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#081C15", "#52796F", "#C5A059"],
      });
    } else if ((confetti as any)?.default) {
      (confetti as any).default({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#081C15", "#52796F", "#C5A059"],
      });
    }
  } catch (e) {
    console.warn("Confetti display skipped:", e);
  }
}

export const StaffScanner: React.FC = () => {
  const [scanMethod, setScanMethod] = useState<"CAMERA" | "FILE" | "MANUAL">("CAMERA");
  const [manualIdInput, setManualIdInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [activeScanData, setActiveScanData] = useState<any>(null);
  const [selectedEntitlementIds, setSelectedEntitlementIds] = useState<number[]>([]);
  const [redeemSubmitting, setRedeemSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);
  const [recentStudents, setRecentStudents] = useState<{ studentId: string; name: string }[]>([]);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadShiftHistory();
    loadRecentStudents();
  }, []);

  const loadRecentStudents = async () => {
    try {
      const recent = await api.getRecentStudents(5);
      if (Array.isArray(recent) && recent.length > 0) {
        setRecentStudents(recent);
      }
    } catch {
      // Not critical — panel just stays hidden if no history yet
    }
  };

  const loadShiftHistory = async () => {
    try {
      const history = await api.getStaffHistory(15);
      const arr = Array.isArray(history) ? history : [];
      setShiftHistory(arr);
      // Derive unique recently-scanned students from history (for quick re-scan)
      const seen = new Map<string, { studentId: string; name: string }>();
      for (const item of arr) {
        const sid = item.studentId || item.student_id;
        const name = item.studentName || item.student_name || sid;
        if (sid && !seen.has(sid)) seen.set(sid, { studentId: sid, name });
        if (seen.size >= 5) break;
      }
      setRecentStudents(Array.from(seen.values()));
    } catch (err) {
      console.error("Failed to load shift history:", err);
      setShiftHistory([]);
      setRecentStudents([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      // Use temporary scanner instance for image file decoding
      const tempScanner = new Html5Qrcode("qr-file-decoder");
      const decodedText = await tempScanner.scanFile(file, true);
      tempScanner.clear();
      await handleLookup({ qrToken: decodedText });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: "Could not decode a QR code from the uploaded file. Please ensure the QR pass image is clear and fully visible.",
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLookup = useCallback(async (params: { qrToken?: string; studentId?: string }) => {
    setLoading(true);
    setFeedback(null);
    setActiveScanData(null);
    setSelectedEntitlementIds([]);

    try {
      const data = await api.lookupScan(params);
      setActiveScanData(data);

      // Auto-select all currently available items for rapid one-click counter service
      const availableIds = Array.isArray(data?.entitlements)
        ? data.entitlements
            .filter((e: any) => e.isSelectableForRedemption && e.id !== null)
            .map((e: any) => e.id)
        : [];

      setSelectedEntitlementIds(availableIds);
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Student lookup failed.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleEntitlementSelection = (id: number) => {
    if (selectedEntitlementIds.includes(id)) {
      setSelectedEntitlementIds(selectedEntitlementIds.filter((item) => item !== id));
    } else {
      setSelectedEntitlementIds([...selectedEntitlementIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (!activeScanData || !Array.isArray(activeScanData.entitlements)) return;
    const availableIds = activeScanData.entitlements
      .filter((e: any) => e.isSelectableForRedemption && e.id !== null)
      .map((e: any) => e.id);

    if (selectedEntitlementIds.length === availableIds.length) {
      setSelectedEntitlementIds([]);
    } else {
      setSelectedEntitlementIds(availableIds);
    }
  };

  const handleBatchRedeem = async () => {
    if (!activeScanData?.student?.studentDbId || selectedEntitlementIds.length === 0) return;
    setRedeemSubmitting(true);
    setFeedback(null);

    try {
      const res = await api.redeemBatch({
        entitlementIds: selectedEntitlementIds,
        studentDbId: activeScanData.student.studentDbId,
        scanMethod: scanMethod === "CAMERA" ? "CAMERA_QR" : "MANUAL_LOOKUP",
      });

      if (res?.succeededCount > 0) {
        safeConfetti();

        setFeedback({
          type: "success",
          text: `Redemption Confirmed! Successfully served ${res.succeededCount} item(s) for ${activeScanData.student.fullName} (${activeScanData.student.studentId}).`,
        });

        // Refresh shift history
        await loadShiftHistory();

        // Refresh student entitlements state
        const refreshedData = await api.lookupScan({
          studentId: activeScanData.student.studentId,
        });
        setActiveScanData(refreshedData);
        setSelectedEntitlementIds([]);
      }

      if (res?.failedCount > 0) {
        const reasons = res.failed?.map((f: any) => f.reason).join("; ") || "Item not redeemable";
        setFeedback({
          type: "warning",
          text: `Some items could not be redeemed: ${reasons}`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Batch redemption failed.",
      });
    } finally {
      setRedeemSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden container for file-based QR decoding */}
      <div id="qr-file-decoder" style={{ display: "none" }} />

      {/* Live Camera QR Scanner Modal */}
      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onScanSuccess={(qrToken) => handleLookup({ qrToken })}
        onSwitchToUpload={() => setScanMethod("FILE")}
        onSwitchToManual={() => setScanMethod("MANUAL")}
      />

      {/* 1. Header Banner */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 mb-2">
            <ScanLine className="w-3.5 h-3.5" />
            <span>High-Velocity Counter Scanner</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#081C15]">
            Mess Counter QR Scanner
          </h1>
          <p className="text-sm text-[#081C15]/70 mt-1 max-w-xl">
            Scan a student's universal QR once to inspect all today's entitlements and perform atomic multi-item redemptions. Only their confirmed booked items are shown.
          </p>
        </div>

        {/* Recently Scanned — dynamic from live shift history */}
        {recentStudents.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-[#E8E3D9]/80 border border-[#52796F]/30 flex flex-col gap-1.5 self-start md:self-center">
            <span className="text-[11px] font-bold text-[#081C15]/70 uppercase tracking-wider">
              ⚡ Recently Scanned:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {recentStudents.map((s) => (
                <button
                  key={s.studentId}
                  onClick={() => handleLookup({ studentId: s.studentId })}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#081C15] text-[#FAF8F5] hover:bg-[#132F22] shadow-sm transition-all"
                >
                  {s.name} ({s.studentId})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
            feedback.type === "success"
              ? "bg-[#52796F]/15 border-[#52796F]/40 text-[#081C15]"
              : feedback.type === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-[#52796F] flex-shrink-0 mt-0.5" />
          ) : feedback.type === "warning" ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 2. Scanner Interface Deck: Camera, File Upload & Manual Roll Search */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scanning Area (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-card rounded-3xl p-6 border border-[#52796F]/25">
            {/* Mode Tabs */}
            <div className="flex rounded-xl p-1 bg-[#E8E3D9] mb-4 gap-1">
              <button
                onClick={() => {
                  setScanMethod("CAMERA");
                  setIsCameraModalOpen(true);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  scanMethod === "CAMERA"
                    ? "bg-[#081C15] text-[#FAF8F5] shadow-sm"
                    : "text-[#081C15]/70 hover:text-[#081C15]"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Webcam</span>
              </button>
              <button
                onClick={() => {
                  setScanMethod("FILE");
                  setIsCameraModalOpen(false);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  scanMethod === "FILE"
                    ? "bg-[#081C15] text-[#FAF8F5] shadow-sm"
                    : "text-[#081C15]/70 hover:text-[#081C15]"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload QR</span>
              </button>
              <button
                onClick={() => {
                  setScanMethod("MANUAL");
                  setIsCameraModalOpen(false);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  scanMethod === "MANUAL"
                    ? "bg-[#081C15] text-[#FAF8F5] shadow-sm"
                    : "text-[#081C15]/70 hover:text-[#081C15]"
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Roll ID</span>
              </button>
            </div>

            {scanMethod === "CAMERA" && (
              <div className="space-y-3">
                <div className="w-full h-64 rounded-2xl bg-[#E8E3D9]/40 border-2 border-dashed border-[#52796F]/40 overflow-hidden flex items-center justify-center relative">
                  <div className="text-center p-6">
                    <Camera className="w-10 h-10 text-[#52796F] mx-auto mb-2 opacity-70" />
                    <p className="text-xs text-[#081C15]/70 font-medium max-w-xs mx-auto">
                      Click 'Start Camera Scanner' to open the live QR scanner pop-up and scan from a mobile screen or printed pass.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCameraModalOpen(true)}
                      className="mt-3 px-5 py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-bold shadow-md hover:bg-[#132F22] transition-all"
                    >
                      Start Camera Scanner
                    </button>
                  </div>
                </div>
              </div>
            )}

            {scanMethod === "FILE" && (
              <div className="space-y-3 text-center p-6 border-2 border-dashed border-[#52796F]/30 rounded-2xl bg-[#E8E3D9]/30">
                <FileImage className="w-10 h-10 text-[#52796F] mx-auto mb-2 opacity-70" />
                <h4 className="text-sm font-bold text-[#081C15]">Upload Student QR Pass</h4>
                <p className="text-xs text-[#081C15]/60 max-w-xs mx-auto">
                  Select or drop the student's downloaded <code>MessMate_QR_Student.png</code> pass to verify and redeem.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="qr-file-upload-input"
                />
                <label
                  htmlFor="qr-file-upload-input"
                  className="mt-3 inline-block px-5 py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-bold shadow-md hover:bg-[#132F22] cursor-pointer"
                >
                  Choose QR Image File
                </label>
              </div>
            )}

            {scanMethod === "MANUAL" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualIdInput.trim()) {
                    handleLookup({ studentId: manualIdInput.trim() });
                  }
                }}
                className="space-y-3"
              >
                <label className="text-xs font-bold uppercase tracking-wider text-[#081C15]/70 block">
                  Enter Student Roll Number:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={manualIdInput}
                    onChange={(e) => setManualIdInput(e.target.value)}
                    placeholder="e.g. NNM24CS123"
                    className="w-full px-4 py-3 rounded-xl bg-white/80 border border-[#52796F]/30 text-sm font-semibold text-[#081C15] focus:outline-none focus:ring-2 focus:ring-[#52796F] placeholder:text-[#081C15]/30 uppercase"
                  />
                  <button
                    type="submit"
                    disabled={loading || !manualIdInput.trim()}
                    className="absolute right-2 top-2 px-3 py-1.5 rounded-lg bg-[#081C15] text-white text-xs font-bold hover:bg-[#132F22]"
                  >
                    {loading ? "Searching..." : "Lookup"}
                  </button>
                </div>
                <p className="text-[11px] text-[#081C15]/60">
                  Enter the student's official roll number (e.g. <code className="bg-[#E8E3D9] px-1 rounded">NNM24CS001</code>)
                </p>
              </form>
            )}
          </div>

          {/* Shift Scan History (Staff Log) */}
          <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25">
            <h4 className="text-sm font-bold text-[#081C15] mb-3 flex items-center justify-between">
              <span>Your Shift Redemption History</span>
              <span className="text-[10px] font-semibold text-[#52796F]">Live Feed</span>
            </h4>
            {shiftHistory.length === 0 ? (
              <p className="text-xs text-[#081C15]/60 py-4 text-center">
                No redemptions completed during this session yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 text-xs">
                {shiftHistory.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-2.5 rounded-lg bg-white/70 border border-[#52796F]/20 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-[#081C15]">{item.itemName || "Meal"}</span>
                      <span className="text-[#081C15]/60 block text-[10px]">
                        {item.studentName || "Student"} ({item.studentId || ""})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#081C15]/60">
                      {item.scannedAt
                        ? new Date(item.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "Now"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Scan Result Panel & Batch Redeemer (7 Cols) */}
        <div className="lg:col-span-7">
          {loading ? (
            <div className="glass-card rounded-3xl p-12 text-center border border-[#52796F]/25 flex flex-col items-center justify-center min-h-[450px]">
              <div className="w-10 h-10 border-3 border-[#52796F] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium text-[#081C15]">Resolving Universal QR Identity...</p>
            </div>
          ) : !activeScanData ? (
            <div className="glass-card rounded-3xl p-12 text-center border border-[#52796F]/25 flex flex-col items-center justify-center min-h-[450px]">
              <div className="w-16 h-16 rounded-2xl bg-[#52796F]/15 text-[#081C15] flex items-center justify-center mb-4">
                <ScanLine className="w-8 h-8 text-[#52796F]" />
              </div>
              <h3 className="text-xl font-serif font-bold text-[#081C15]">
                Awaiting Next Student Scan
              </h3>
              <p className="text-xs text-[#081C15]/60 max-w-sm mt-1">
                Scan the student's universal QR code via webcam, upload their downloaded QR PNG pass, or lookup by roll number to view today's entitlements.
              </p>
            </div>
          ) : (
            <div className="glass-card rounded-3xl p-6 sm:p-7 border border-[#52796F]/30 shadow-lg space-y-5">
              {/* Student Identification Strip */}
              <div className="p-4 rounded-2xl bg-white/80 border border-[#52796F]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#081C15] text-[#FAF8F5] flex items-center justify-center font-bold text-base shadow-sm">
                    {activeScanData.student?.fullName?.slice(0, 2).toUpperCase() || "ST"}
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-[#081C15] leading-tight">
                      {activeScanData.student?.fullName || "Student"}
                    </h3>
                    <p className="text-xs text-[#081C15]/70">
                      ID: <strong className="text-[#081C15]">{activeScanData.student?.studentId}</strong> • {activeScanData.student?.department} • Room {activeScanData.student?.roomNumber}
                    </p>
                  </div>
                </div>

                <div className="text-right sm:border-l sm:border-[#52796F]/20 sm:pl-4">
                  <span className="text-[10px] font-bold text-[#081C15]/60 uppercase tracking-wider block">
                    Active Monthly Mess
                  </span>
                  <span className="text-sm font-bold text-[#C5A059]">
                    {activeScanData.selectedMess || "No Mess Enrolled"}
                  </span>
                </div>
              </div>

              {/* Confirmed Upcoming Enrolment Summary */}
              {activeScanData.upcomingEnrolment?.messSelection && (
                <div className="p-3.5 rounded-xl bg-[#C5A059]/10 border border-[#C5A059]/35 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059] block">
                      Confirmed Enrolment ({activeScanData.upcomingEnrolment.monthYear})
                    </span>
                    <strong className="text-[#081C15]">
                      {activeScanData.upcomingEnrolment.messSelection.messName}
                    </strong>
                    {activeScanData.upcomingEnrolment.bookedAddons?.length > 0 && (
                      <span className="text-[#081C15]/75 ml-2">
                        • Add-ons:{" "}
                        {activeScanData.upcomingEnrolment.bookedAddons
                          .map((a: any) => `${a.name} (${a.servingsCount}d)`)
                          .join(", ")}
                      </span>
                    )}
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#081C15] text-[#E8C97A]">
                    Starts {activeScanData.upcomingEnrolment.monthYear}-01
                  </span>
                </div>
              )}

              {/* Today's Entitlement Deck */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-serif font-bold text-lg text-[#081C15]">
                      Today's Entitlements ({activeScanData.date})
                    </h4>
                    <p className="text-xs text-[#081C15]/60">
                      Select items to redeem and confirm with one batch click.
                    </p>
                  </div>

                  {/* Select All Toggle */}
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#081C15] hover:text-[#C5A059] transition-colors"
                  >
                    <span>Toggle Select All Available</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {(!Array.isArray(activeScanData.entitlements) || activeScanData.entitlements.length === 0) && (
                    <div className="p-4 rounded-xl bg-[#E8E3D9]/40 text-xs text-[#081C15]/70 text-center">
                      No active meal or add-on entitlements for today ({activeScanData.date}).
                    </div>
                  )}
                  {Array.isArray(activeScanData.entitlements) && activeScanData.entitlements.map((item: any, idx: number) => {
                    const isAvailable = item.status === "AVAILABLE";
                    const isRedeemed = item.status === "REDEEMED";
                    const isChecked = item.id !== null && selectedEntitlementIds.includes(item.id);

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (isAvailable && item.id !== null) {
                            toggleEntitlementSelection(item.id);
                          }
                        }}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                          isAvailable
                            ? isChecked
                              ? "bg-[#081C15] text-white border-[#C5A059] ring-2 ring-[#C5A059] cursor-pointer shadow-md"
                              : "bg-white/90 border-[#52796F]/40 text-[#081C15] hover:border-[#52796F] cursor-pointer"
                            : isRedeemed
                            ? "bg-[#52796F]/15 border-[#52796F]/30 text-[#081C15] opacity-80"
                            : "bg-[#E8E3D9]/30 border-transparent text-[#081C15]/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isAvailable && item.id !== null ? (
                            <div className="flex-shrink-0">
                              {isChecked ? (
                                <CheckSquare className="w-5 h-5 text-[#E8C97A]" />
                              ) : (
                                <Square className="w-5 h-5 text-[#52796F]" />
                              )}
                            </div>
                          ) : (
                            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                              {isRedeemed ? (
                                <CheckCircle2 className="w-4 h-4 text-[#52796F]" />
                              ) : (
                                <XCircle className="w-4 h-4 opacity-40" />
                              )}
                            </div>
                          )}

                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider ${
                                  isChecked ? "text-[#E8C97A]" : "text-[#52796F]"
                                }`}
                              >
                                {item.category === "MESS_MEAL" ? "Mess Meal" : "Add-on Extra"} • {item.mealSlot}
                              </span>
                            </div>
                            <h5
                              className={`font-semibold text-sm ${
                                isChecked ? "text-white" : "text-[#081C15]"
                              }`}
                            >
                              {item.itemName}
                            </h5>
                            <p
                              className={`text-[11px] ${
                                isChecked ? "text-white/70" : "text-[#081C15]/60"
                              }`}
                            >
                              {item.details}
                            </p>
                          </div>
                        </div>

                        {/* Status Chip */}
                        <div className="flex-shrink-0 text-right">
                          {isAvailable ? (
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                isChecked
                                  ? "bg-[#E8C97A] text-[#081C15]"
                                  : "bg-[#52796F]/20 text-[#081C15]"
                              }`}
                            >
                              {isChecked ? "Ready to Redeem" : "Available"}
                            </span>
                          ) : isRedeemed ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/70 text-[#081C15] border border-[#52796F]/30">
                              Already Redeemed
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/5 text-[#081C15]/50">
                              {item.status === "NOT_SELECTED" ? "Not Selected" : "Not Today"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Batch Confirm Action Button */}
              <div className="pt-2 border-t border-[#52796F]/20 flex items-center justify-between gap-3">
                <span className="text-xs text-[#081C15]/70">
                  Selected for batch redemption: <strong>{selectedEntitlementIds.length} item(s)</strong>
                </span>

                <button
                  onClick={handleBatchRedeem}
                  disabled={selectedEntitlementIds.length === 0 || redeemSubmitting}
                  className={`px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 ${
                    selectedEntitlementIds.length > 0 && !redeemSubmitting
                      ? "bg-[#081C15] hover:bg-[#132F22] text-[#FAF8F5]"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <Check className="w-4 h-4 text-[#52796F]" />
                  <span>
                    {redeemSubmitting
                      ? "Processing Batch..."
                      : `Confirm Redemption (${selectedEntitlementIds.length})`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
