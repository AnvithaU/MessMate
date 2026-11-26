import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { StudentProfile } from "../../types";
import {
  Users,
  Search,
  Filter,
  Plus,
  Upload,
  Eye,
  Utensils,
  X,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");

  // Modals
  const [selectedStudentProfile, setSelectedStudentProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [showOverrideModal, setShowOverrideModal] = useState<StudentProfile | null>(null);

  // Forms
  const [newStudentForm, setNewStudentForm] = useState({
    studentId: "",
    fullName: "",
    email: "",
    department: "Computer Science & Engineering",
    semester: "5",
    roomNumber: "B-301",
    phone: "+91 98765 00000",
    initialAdvance: "25000",
  });

  const [overrideForm, setOverrideForm] = useState({
    monthYear: "2026-11",
    messId: "1",
    overrideReason: "Warden administrative reallocation request",
  });

  const [bulkInput, setBulkInput] = useState<string>(
    JSON.stringify(
      [
        {
          studentId: "2026CSE099",
          fullName: "Devika Menon",
          email: "devika.m@messmate.edu",
          department: "Computer Science",
          roomNumber: "A-102",
        },
        {
          studentId: "2026ECE088",
          fullName: "Tarun Chawla",
          email: "tarun.c@messmate.edu",
          department: "Electronics",
          roomNumber: "C-204",
        },
      ],
      null,
      2
    )
  );

  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadStudents();
  }, [search, deptFilter]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const list = await api.getAdminStudents(search, deptFilter);
      setStudents(list || []);
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInspectProfile = async (id: number) => {
    setProfileLoading(true);
    try {
      const data = await api.getStudentProfile(id);
      setSelectedStudentProfile(data);
    } catch (err: any) {
      alert("Failed to load profile: " + err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.registerStudent(newStudentForm);
      setShowRegisterModal(false);
      setActionFeedback(`Successfully registered student ${newStudentForm.fullName} (${newStudentForm.studentId})`);
      loadStudents();
    } catch (err: any) {
      alert("Registration failed: " + err.message);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(bulkInput);
      const res = await api.bulkImportStudents(parsed);
      setShowBulkModal(false);
      setActionFeedback(`Successfully bulk-imported ${res.importedCount} student(s) with Universal QR identities.`);
      loadStudents();
    } catch (err: any) {
      alert("Bulk import failed. Please verify JSON format: " + err.message);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showOverrideModal) return;
    try {
      await api.overrideMess({
        studentDbId: showOverrideModal.id,
        monthYear: overrideForm.monthYear,
        messId: Number(overrideForm.messId),
        overrideReason: overrideForm.overrideReason,
      });
      setShowOverrideModal(null);
      setActionFeedback(`Administrative mess override recorded for ${showOverrideModal.fullName}.`);
      loadStudents();
    } catch (err: any) {
      alert("Mess override failed: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="glass-card rounded-2xl p-6 border border-[#52796F]/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#52796F]/15 text-[#081C15] border border-[#52796F]/30 mb-2">
            <Users className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Student Directory & Enrolment Master</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#081C15]">
            Student Management
          </h1>
          <p className="text-sm text-[#081C15]/70 mt-1 max-w-xl">
            Inspect individual student accounts, view immutable ledger balances, execute administrative mess overrides with audit reasons, and register students.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2.5 rounded-xl border border-[#52796F]/30 bg-white/70 text-[#081C15] text-xs font-bold hover:bg-white flex items-center gap-2 shadow-sm"
          >
            <Upload className="w-4 h-4 text-[#52796F]" />
            <span>Bulk Import</span>
          </button>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-bold hover:bg-[#132F22] flex items-center gap-2 shadow-md"
          >
            <Plus className="w-4 h-4 text-[#52796F]" />
            <span>Register Student</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-4 rounded-xl bg-[#52796F]/15 border border-[#52796F]/40 text-xs font-semibold text-[#081C15] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#52796F]" />
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)}>
            <X className="w-4 h-4 opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* 2. Filters & Search */}
      <div className="glass-card rounded-2xl p-4 border border-[#52796F]/25 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#081C15]/40 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student ID, name, email, or hostel room..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/80 border border-[#52796F]/25 text-xs text-[#081C15] focus:outline-none focus:ring-2 focus:ring-[#52796F]"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-white/80 border border-[#52796F]/25 text-xs text-[#081C15] focus:outline-none"
        >
          <option value="ALL">All Departments</option>
          <option value="Computer Science & Engineering">Computer Science</option>
          <option value="Electronics & Communication">Electronics</option>
          <option value="Mechanical Engineering">Mechanical</option>
          <option value="Biotechnology">Biotechnology</option>
          <option value="Civil Engineering">Civil</option>
          <option value="Electrical Engineering">Electrical</option>
        </select>
      </div>

      {/* 3. Students Table */}
      <div className="glass-card rounded-2xl border border-[#52796F]/25 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#081C15]">
            <thead>
              <tr className="bg-[#E8E3D9]/60 border-b border-[#52796F]/20 uppercase tracking-wider text-[10px] text-[#081C15]/70">
                <th className="py-3 px-4 font-bold">Student</th>
                <th className="py-3 px-4 font-bold">Roll / ID</th>
                <th className="py-3 px-4 font-bold">Department</th>
                <th className="py-3 px-4 font-bold">Room</th>
                <th className="py-3 px-4 font-bold">Active Mess (Nov)</th>
                <th className="py-3 px-4 font-bold">QR Token</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#52796F]/15">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs opacity-60">
                    Loading student directory...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs opacity-60">
                    No students match the search criteria.
                  </td>
                </tr>
              ) : (
                students.map((st) => (
                  <tr key={st.id} className="hover:bg-white/50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#081C15] text-[#FAF8F5] flex items-center justify-center text-[10px] font-bold">
                        {st.fullName?.slice(0, 2).toUpperCase() || "ST"}
                      </div>
                      <div>
                        <span>{st.fullName}</span>
                        <span className="block text-[10px] text-[#081C15]/60 font-normal">{st.email}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#081C15]">{st.studentId}</td>
                    <td className="py-3.5 px-4">{st.department} (Sem {st.semester})</td>
                    <td className="py-3.5 px-4 font-medium">{st.roomNumber}</td>
                    <td className="py-3.5 px-4">
                      {st.messName ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#52796F]/20 text-[#081C15]">
                          {st.messName}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#081C15]/40 italic">Not Selected</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[10px] text-[#081C15]/70 truncate max-w-[120px]">
                      {st.qrToken}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleInspectProfile(st.id)}
                        className="p-1.5 rounded-lg bg-[#081C15]/10 hover:bg-[#081C15] hover:text-white transition-all"
                        title="View Full Profile & Ledger"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setShowOverrideModal(st)}
                        className="p-1.5 rounded-lg bg-[#C5A059]/15 hover:bg-[#C5A059] hover:text-white text-[#C5A059] transition-all"
                        title="Admin Mess Override"
                      >
                        <Utensils className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Student Full Profile & Financial Ledger Modal */}
      {selectedStudentProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#52796F]/20 mb-6">
              <div>
                <h3 className="text-2xl font-serif font-bold text-[#081C15]">
                  {selectedStudentProfile.student.fullName}
                </h3>
                <p className="text-xs text-[#081C15]/70">
                  Roll No: <strong className="text-[#081C15]">{selectedStudentProfile.student.studentId}</strong> • {selectedStudentProfile.student.department} • Room {selectedStudentProfile.student.roomNumber}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentProfile(null)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#081C15]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3.5 rounded-xl bg-[#E8E3D9]/60 border border-[#52796F]/20">
                <span className="text-[10px] font-bold text-[#081C15]/60 uppercase tracking-wider block">Advance Paid</span>
                <span className="text-xl font-serif font-bold text-[#081C15]">
                  ₹{selectedStudentProfile.financials.totalAdvancePaid?.toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#E8E3D9]/60 border border-[#52796F]/20">
                <span className="text-[10px] font-bold text-[#081C15]/60 uppercase tracking-wider block">Total Charges</span>
                <span className="text-xl font-serif font-bold text-[#C5A059]">
                  ₹{selectedStudentProfile.financials.totalCharges?.toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#E8E3D9]/60 border border-[#52796F]/20">
                <span className="text-[10px] font-bold text-[#081C15]/60 uppercase tracking-wider block">Net Balance</span>
                <span className="text-xl font-serif font-bold text-[#52796F]">
                  ₹{selectedStudentProfile.financials.availableBalance?.toLocaleString()}
                </span>
              </div>
            </div>

            {/* QR Card */}
            <div className="p-4 rounded-xl bg-white/80 border border-[#52796F]/25 flex items-center gap-4 mb-6">
              <QRCodeSVG value={selectedStudentProfile.student.qrToken} size={64} />
              <div>
                <span className="text-[10px] font-bold text-[#52796F] uppercase tracking-wider block">Permanent Universal QR</span>
                <span className="font-mono text-xs text-[#081C15] font-semibold">{selectedStudentProfile.student.qrToken}</span>
                <p className="text-[11px] text-[#081C15]/60 mt-0.5">Status: {selectedStudentProfile.student.qrStatus}</p>
              </div>
            </div>

            {/* Full Append-Only Ledger for this Student */}
            <div>
              <h4 className="font-bold text-sm text-[#081C15] mb-3">Immutable Financial Ledger Timeline</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                {selectedStudentProfile.financials.ledgerEntries?.map((entry: any) => (
                  <div key={entry.id} className="p-2.5 rounded-lg bg-white/60 border border-[#52796F]/15 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[#081C15]">{entry.transactionType.replace(/_/g, " ")}</span>
                      <span className="text-[#081C15]/60 block text-[10px]">{entry.adjustmentReason}</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-serif font-bold ${entry.amount > 0 ? "text-[#52796F]" : "text-[#C5A059]"}`}>
                        {entry.amount > 0 ? `+₹${entry.amount.toLocaleString()}` : `-₹${Math.abs(entry.amount).toLocaleString()}`}
                      </span>
                      <span className="text-[10px] text-[#081C15]/50 block">Bal: ₹{entry.balanceAfter.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Register Student Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleRegisterSubmit} className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full">
            <h3 className="text-2xl font-serif font-bold text-[#081C15] mb-2">Register Student</h3>
            <p className="text-xs text-[#081C15]/70 mb-4">
              Registers new student account strictly with <code className="bg-[#E8E3D9] px-1 rounded">role: 'student'</code> and auto-generates a Universal QR identity.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Student Roll / ID *</label>
                <input
                  type="text"
                  required
                  value={newStudentForm.studentId}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, studentId: e.target.value })}
                  placeholder="e.g. 2026CSE090"
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15] uppercase"
                />
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newStudentForm.fullName}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, fullName: e.target.value })}
                  placeholder="e.g. Siddharth Rao"
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Institutional Email *</label>
                <input
                  type="email"
                  required
                  value={newStudentForm.email}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                  placeholder="e.g. siddharth.rao@messmate.edu"
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-[#081C15] block mb-1">Department</label>
                  <input
                    type="text"
                    value={newStudentForm.department}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#081C15] block mb-1">Hostel Room</label>
                  <input
                    type="text"
                    value={newStudentForm.roomNumber}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, roomNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Initial Advance Deposit (₹)</label>
                <input
                  type="number"
                  value={newStudentForm.initialAdvance}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, initialAdvance: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#52796F]/30 text-xs font-semibold text-[#081C15]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-bold shadow-md hover:bg-[#132F22]"
              >
                Register
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. Admin Mess Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleOverrideSubmit} className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full">
            <h3 className="text-2xl font-serif font-bold text-[#081C15] mb-2">Admin Mess Override</h3>
            <p className="text-xs text-[#081C15]/70 mb-4">
              Override mess selection for <strong>{showOverrideModal.fullName}</strong> ({showOverrideModal.studentId}). Mandatory reason will be saved to audit logs.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Target Month</label>
                <select
                  value={overrideForm.monthYear}
                  onChange={(e) => setOverrideForm({ ...overrideForm, monthYear: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                >
                  <option value="2026-11">November 2026</option>
                  <option value="2026-12">December 2026</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Assign Mess</label>
                <select
                  value={overrideForm.messId}
                  onChange={(e) => setOverrideForm({ ...overrideForm, messId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                >
                  <option value="1">South Mess (₹3,800/mo)</option>
                  <option value="2">North Mess (₹3,950/mo)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#081C15] block mb-1">Mandatory Override Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={overrideForm.overrideReason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, overrideReason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-[#52796F]/30 text-xs text-[#081C15]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowOverrideModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#52796F]/30 text-xs font-semibold text-[#081C15]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#C5A059] text-white text-xs font-bold shadow-md hover:bg-[#D4AF37]"
              >
                Record Override
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleBulkSubmit} className="glass-modal rounded-3xl p-6 sm:p-8 max-w-lg w-full">
            <h3 className="text-2xl font-serif font-bold text-[#081C15] mb-2">Bulk Student Import</h3>
            <p className="text-xs text-[#081C15]/70 mb-4">
              Paste a JSON array of students to import in batch. Each student is automatically assigned a Universal QR identity token.
            </p>

            <textarea
              rows={8}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              className="w-full p-3 font-mono text-xs rounded-xl bg-white/90 border border-[#52796F]/30 text-[#081C15] mb-4"
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#52796F]/30 text-xs font-semibold text-[#081C15]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#081C15] text-[#FAF8F5] text-xs font-bold shadow-md hover:bg-[#132F22]"
              >
                Import Batch
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
