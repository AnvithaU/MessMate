import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { FinancialSummary } from "../../types";
import { formatIndianDateTime } from "../../utils/formatDate";
import {
  WalletCards,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Scale,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  CreditCard,
} from "lucide-react";

export const PaymentBalance: React.FC = () => {
  const [financials, setFinancials] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadFinancials();
  }, []);

  const loadFinancials = async () => {
    try {
      const res = await api.getFinancials();
      setFinancials(res);
    } catch (err) {
      console.error("Failed to load financials:", err);
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

  const f = financials;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#52796F]/15 text-[#081C15] border border-[#52796F]/30 mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Immutable Financial Integrity</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-[#081C15]">
          Advance Payments & Ledger
        </h1>
        <p className="text-sm text-[#081C15]/70 mt-1 max-w-2xl">
          Track all advance fees collected, monthly mess debits, add-on charges, and end-of-semester settlement calculations in an append-only verifiable ledger.
        </p>
      </div>

      {/* 2. Key Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Provisional / Available Balance */}
        <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25">
          <span className="text-xs text-[#081C15]/70 block mb-1">
            {f?.hasVerifiedDeposits ? "Available Advance Balance" : "Remaining Provisional Balance"}
          </span>
          <div className="text-3xl font-serif font-bold text-[#081C15]">
            ₹{(f?.availableBalance ?? 0).toLocaleString()}
          </div>
          <p className="text-xs text-[#52796F] font-medium mt-1">
            {f?.hasVerifiedDeposits
              ? "From verified advance deposits"
              : `From ₹${(f?.provisionalAdvance ?? 25000).toLocaleString()} Provisional Advance`}
          </p>
        </div>

        {/* Verified Deposits (kept separate from Provisional Advance) */}
        <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25">
          <span className="text-xs text-[#081C15]/70 block mb-1">Verified Deposits Paid</span>
          <div className="text-3xl font-serif font-bold text-[#081C15]">
            ₹{(f?.totalAdvancePaid ?? 0).toLocaleString()}
          </div>
          <p className="text-xs text-[#081C15]/60 mt-1">
            {f?.payments?.length
              ? `${f.payments.length} verified deposit(s)`
              : "No actual deposits recorded yet"}
          </p>
        </div>

        {/* Total Charges */}
        <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25">
          <span className="text-xs text-[#081C15]/70 block mb-1">Total Eligible Charges</span>
          <div className="text-3xl font-serif font-bold text-[#C5A059]">
            ₹{(f?.totalCharges ?? 0).toLocaleString()}
          </div>
          <p className="text-xs text-[#081C15]/60 mt-1">
            Mess: ₹{(f?.totalMessCharges ?? 0).toLocaleString()} • Addons: ₹{(f?.totalAddonCharges ?? 0).toLocaleString()}
            {(f?.totalRefunds ?? 0) > 0 ? ` • Rebates: -₹${f?.totalRefunds?.toLocaleString()}` : ""}
          </p>
        </div>

        {/* Settlement Status / Outstanding */}
        <div className="glass-card rounded-2xl p-5 border border-[#52796F]/25">
          <span className="text-xs text-[#081C15]/70 block mb-1">
            {f?.hasVerifiedDeposits ? "Final Settlement Position" : "Provisional Advance & Dues"}
          </span>
          <div className="text-2xl font-serif font-bold text-[#081C15]">
            {f?.isSettled ? (
              <span className="text-[#52796F]">Account Settled</span>
            ) : (f?.outstandingAmount ?? 0) > 0 ? (
              <span className="text-rose-700">Outstanding: ₹{f?.outstandingAmount?.toLocaleString()}</span>
            ) : f && f.netBalance >= 0 ? (
              <span className="text-[#52796F]">
                {f.hasVerifiedDeposits ? `Refundable: ₹${f.netBalance.toLocaleString()}` : `₹${(f.provisionalAdvance ?? 25000).toLocaleString()} Allocated`}
              </span>
            ) : (
              <span className="text-rose-700">Due: ₹{f?.outstandingAmount.toLocaleString()}</span>
            )}
          </div>
          <p className="text-xs text-[#081C15]/60 mt-1">
            {f?.hasVerifiedDeposits
              ? "Refunds processed at semester end"
              : "Provisional allocation — not an actual payment"}
          </p>
        </div>
      </div>

      {/* 3. Final Settlement Policy Guide Banner */}
      <div className="p-4 rounded-2xl bg-[#E8E3D9]/70 border border-[#52796F]/25 flex items-start gap-3 text-xs text-[#081C15]">
        <Scale className="w-5 h-5 text-[#C5A059] flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-sm font-semibold block mb-0.5">College Final Refund & Settlement Policy</strong>
          <p className="opacity-85 leading-relaxed">
            Changing your monthly mess selection between South and North Mess does not trigger immediate refunds. Instead, all advance deposits and monthly debits accumulate in your student ledger. At final semester closing, if your advance exceeds total eligible charges, the exact remaining balance is refunded to your bank account. If charges exceed your advance, the outstanding amount is billed.
          </p>
        </div>
      </div>

      {/* 4. Immutable Append-Only Financial Ledger Table */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#52796F]/20">
          <div>
            <h3 className="text-xl font-serif font-bold text-[#081C15]">
              Append-Only Financial Ledger
            </h3>
            <p className="text-xs text-[#081C15]/70">
              Audit log of all credits (deposits) and debits (monthly mess and add-ons).
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52796F]/20 text-[#081C15] border border-[#52796F]/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#52796F]" />
            <span>Balance Reconstructed: ₹{f?.ledgerReconstructedBalance?.toLocaleString()}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#081C15]">
            <thead>
              <tr className="border-b border-[#52796F]/25 text-[#081C15]/60 uppercase tracking-wider text-[10px]">
                <th className="pb-3 font-semibold">Txn ID / Ref</th>
                <th className="pb-3 font-semibold">Type</th>
                <th className="pb-3 font-semibold">Adjustment Reason</th>
                <th className="pb-3 font-semibold">Timestamp</th>
                <th className="pb-3 font-semibold text-right">Amount</th>
                <th className="pb-3 font-semibold text-right">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#52796F]/15">
              {f?.ledgerEntries?.map((entry) => {
                const isCredit = entry.amount > 0;
                return (
                  <tr key={entry.id} className="hover:bg-white/40 transition-colors">
                    <td className="py-3 font-mono font-medium">{entry.referenceId || `TXN-${entry.id}`}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isCredit
                            ? "bg-[#52796F]/20 text-[#081C15]"
                            : "bg-[#C5A059]/15 text-[#C5A059]"
                        }`}
                      >
                        {isCredit ? <ArrowUpRight className="w-3 h-3 text-[#52796F]" /> : <ArrowDownLeft className="w-3 h-3 text-[#C5A059]" />}
                        {entry.transactionType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 text-[#081C15]/80 max-w-xs">{entry.adjustmentReason || "N/A"}</td>
                    <td className="py-3 text-[#081C15]/60 whitespace-nowrap">
                      {formatIndianDateTime(entry.createdAt)}
                    </td>
                    <td className={`py-3 text-right font-semibold font-serif text-sm ${isCredit ? "text-[#52796F]" : "text-[#C5A059]"}`}>
                      {isCredit ? `+₹${entry.amount.toLocaleString()}` : `-₹${Math.abs(entry.amount).toLocaleString()}`}
                    </td>
                    <td className="py-3 text-right font-serif font-bold text-sm">
                      ₹{entry.balanceAfter.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
