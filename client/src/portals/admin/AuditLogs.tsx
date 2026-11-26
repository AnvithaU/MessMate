import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { ShieldCheck, History, Clock } from "lucide-react";

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data || []);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#52796F]/15 text-[#081C15] border border-[#52796F]/30 mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Compliance & Security Audit Trail</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-[#081C15]">
          System Audit Logs
        </h1>
        <p className="text-sm text-[#081C15]/70 mt-1 max-w-xl">
          Complete, unalterable log of administrative actions including mess overrides, role modifications, and final settlements.
        </p>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl border border-[#52796F]/25 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#081C15]">
            <thead>
              <tr className="bg-[#E8E3D9]/60 border-b border-[#52796F]/20 uppercase tracking-wider text-[10px] text-[#081C15]/70">
                <th className="py-3 px-4 font-bold">Log ID</th>
                <th className="py-3 px-4 font-bold">Action</th>
                <th className="py-3 px-4 font-bold">Admin User</th>
                <th className="py-3 px-4 font-bold">Entity Type</th>
                <th className="py-3 px-4 font-bold">State Changes</th>
                <th className="py-3 px-4 font-bold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#52796F]/15">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs opacity-60">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs opacity-60">
                    No administrative audit events recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold">#{log.id}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#081C15] text-white">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold">{log.adminName || "System / Warden"}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#081C15]/70">{log.entityType}</td>
                    <td className="py-3.5 px-4 max-w-xs font-mono text-[10px] text-[#081C15]/80 truncate">
                      {log.newState || "N/A"}
                    </td>
                    <td className="py-3.5 px-4 text-[#081C15]/60 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
