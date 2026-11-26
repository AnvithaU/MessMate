import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, RefreshCw, Upload, Search, AlertTriangle, ScanLine } from "lucide-react";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (qrToken: string) => void;
  onSwitchToUpload?: () => void;
  onSwitchToManual?: () => void;
}

const MODAL_VIEWPORT_ID = "qr-modal-reader-viewport";

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  onSwitchToUpload,
  onSwitchToManual,
}) => {
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onCloseRef = useRef(onClose);

  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const stopScanner = useCallback(async () => {
    const instance = html5QrCodeRef.current;
    if (!instance) return;
    if (isScanningRef.current) {
      isScanningRef.current = false;
      try {
        await instance.stop();
      } catch {
        // Ignore stop errors if stream was already halted
      }
    }
    try {
      instance.clear();
    } catch {
      // Ignore clear errors
    }
    html5QrCodeRef.current = null;
  }, []);

  const startScanner = useCallback(async () => {
    setStatus("starting");
    setErrorMessage(null);

    await stopScanner();

    const container = document.getElementById(MODAL_VIEWPORT_ID);
    if (!container) return;

    const scanner = new Html5Qrcode(MODAL_VIEWPORT_ID);
    html5QrCodeRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 230, height: 230 },
          aspectRatio: 1,
        },
        (decodedText) => {
          if (!isScanningRef.current) return;
          isScanningRef.current = false;
          scanner
            .stop()
            .then(() => {
              try {
                scanner.clear();
              } catch {
                // Ignore
              }
            })
            .catch(() => {})
            .finally(() => {
              html5QrCodeRef.current = null;
              onCloseRef.current();
              onScanSuccessRef.current(decodedText);
            });
        },
        () => {
          // Ignore per-frame decode misses
        }
      );
      isScanningRef.current = true;
      setStatus("scanning");
    } catch (err: any) {
      isScanningRef.current = false;
      html5QrCodeRef.current = null;
      setStatus("error");
      const rawMsg = typeof err === "string" ? err : err?.message || "";
      if (rawMsg.toLowerCase().includes("permission") || rawMsg.toLowerCase().includes("notallowed")) {
        setErrorMessage(
          "Camera permission was denied. Please allow camera access in your browser bar and click Retry, or use Upload QR / Roll ID."
        );
      } else {
        setErrorMessage(
          "No accessible camera stream was found on this device. You can retry or switch to Upload QR / Roll ID."
        );
      }
    }
  }, [stopScanner]);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    const timer = window.setTimeout(() => {
      startScanner();
    }, 60);

    return () => {
      window.clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#081C15]/75 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#FAF8F5] border border-[#C5A059]/40 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#081C15] text-[#FAF8F5] flex items-center justify-between border-b border-[#C5A059]/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center text-[#E8C97A]">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 id="camera-modal-title" className="text-lg font-serif font-bold tracking-tight">
                Show Your QR Code
              </h2>
              <p className="text-[11px] text-[#E8C97A]/90 font-medium">
                Show your QR code from mobile screen or printed pass inside the frame
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-2 rounded-xl text-[#FAF8F5]/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close camera scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport Body */}
        <div className="p-6 space-y-4">
          <div className="relative w-full aspect-square max-h-[320px] mx-auto rounded-2xl overflow-hidden bg-[#081C15] border-2 border-[#C5A059]/40 shadow-inner">
            {/* IMPORTANT: Keep this div completely empty of React children so html5-qrcode can manage its DOM safely */}
            <div id={MODAL_VIEWPORT_ID} className="w-full h-full" />

            {/* Sibling overlay for starting state */}
            {status === "starting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#081C15]/90 text-[#FAF8F5] p-6 text-center">
                <RefreshCw className="w-8 h-8 text-[#C5A059] animate-spin mb-3" />
                <p className="text-sm font-semibold">Initializing camera...</p>
                <p className="text-xs text-[#FAF8F5]/60 mt-1">
                  Please allow camera access if prompted by your browser.
                </p>
              </div>
            )}

            {/* Sibling overlay for live scanning guide */}
            {status === "scanning" && (
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
                <div className="flex justify-between items-center">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#081C15]/80 text-[#E8C97A] text-[10px] font-bold uppercase tracking-wider border border-[#C5A059]/40">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live Camera
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#081C15]/80 text-[#FAF8F5]/80 text-[10px] font-medium">
                    <ScanLine className="w-3 h-3 text-[#C5A059]" />
                    Auto-detect
                  </span>
                </div>
              </div>
            )}

            {/* Sibling overlay for error state */}
            {status === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#FAF8F5] p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[#081C15]">Camera Unavailable</h3>
                <p className="text-xs text-[#081C15]/70 mt-1.5 leading-relaxed">
                  {errorMessage}
                </p>
                <button
                  type="button"
                  onClick={startScanner}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-bold hover:bg-[#132F22] shadow-sm transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#C5A059]" />
                  Retry Camera
                </button>
              </div>
            )}
          </div>

          {/* Helpful footer & quick fallbacks */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onSwitchToUpload && (
                <button
                  type="button"
                  onClick={() => {
                    stopScanner();
                    onClose();
                    onSwitchToUpload();
                  }}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#E8E3D9] hover:bg-[#dfd8ca] text-[#081C15] text-xs font-semibold transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-[#52796F]" />
                  Upload QR
                </button>
              )}
              {onSwitchToManual && (
                <button
                  type="button"
                  onClick={() => {
                    stopScanner();
                    onClose();
                    onSwitchToManual();
                  }}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#E8E3D9] hover:bg-[#dfd8ca] text-[#081C15] text-xs font-semibold transition-colors"
                >
                  <Search className="w-3.5 h-3.5 text-[#52796F]" />
                  Roll ID
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                stopScanner();
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-[#52796F]/30 text-[#081C15]/80 hover:bg-[#081C15]/5 text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
