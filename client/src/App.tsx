import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { Login } from "./portals/auth/Login";

// Student Views
import { StudentOverview } from "./portals/student/StudentOverview";
import { MonthlySelection } from "./portals/student/MonthlySelection";
import { AddonBooking } from "./portals/student/AddonBooking";
import { UniversalQrWallet } from "./portals/student/UniversalQrWallet";
import { PaymentBalance } from "./portals/student/PaymentBalance";
import { StudentHistory } from "./portals/student/StudentHistory";
import { HostelLeaveRebate } from "./portals/student/HostelLeaveRebate";

// Staff Views
import { StaffScanner } from "./portals/scanner/StaffScanner";

// Admin Views
import { AdminOverview } from "./portals/admin/AdminOverview";
import { StudentManagement } from "./portals/admin/StudentManagement";
import { MessManagement } from "./portals/admin/MessManagement";
import { AddonManagement } from "./portals/admin/AddonManagement";
import { CouponManagement } from "./portals/admin/CouponManagement";
import { FinancialLedger } from "./portals/admin/FinancialLedger";
import { FinalSettlement } from "./portals/admin/FinalSettlement";
import { AuditLogs } from "./portals/admin/AuditLogs";

const MainContent: React.FC = () => {
  const { role, user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>("overview");

  useEffect(() => {
    if (role === "admin") {
      setCurrentTab("admin-overview");
    } else if (role === "staff") {
      setCurrentTab("staff-scanner");
    } else {
      setCurrentTab("overview");
    }
  }, [role, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center ambient-gradient-bg">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 rounded-full animate-spin mx-auto" style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }} />
          <p className="font-serif text-base font-bold" style={{ color: "var(--obsidian)" }}>
            Verifying Session...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderCurrentView = () => {
    if (role === "student") {
      switch (currentTab) {
        case "overview":
          return <StudentOverview onNavigate={setCurrentTab} />;
        case "mess-selection":
          return <MonthlySelection onNavigate={setCurrentTab} />;
        case "addons":
          return <AddonBooking />;
        case "wallet":
          return <UniversalQrWallet />;
        case "financials":
          return <PaymentBalance />;
        case "history":
          return <StudentHistory />;
        case "hostel-leave":
          return <HostelLeaveRebate />;
        default:
          return <StudentOverview onNavigate={setCurrentTab} />;
      }
    }

    if (role === "admin") {
      switch (currentTab) {
        case "admin-overview":
          return <AdminOverview onNavigate={setCurrentTab} />;
        case "admin-students":
          return <StudentManagement />;
        case "admin-messes":
          return <MessManagement />;
        case "admin-addons":
          return <AddonManagement />;
        case "admin-coupons":
          return <CouponManagement />;
        case "admin-scanner":
          return <StaffScanner />;
        case "admin-ledger":
          return <FinancialLedger />;
        case "admin-settlement":
          return <FinalSettlement />;
        case "admin-audit":
          return <AuditLogs />;
        default:
          return <AdminOverview onNavigate={setCurrentTab} />;
      }
    }

    if (role === "staff") {
      switch (currentTab) {
        case "staff-scanner":
          return <StaffScanner />;
        case "staff-history":
          return <StaffScanner />;
        default:
          return <StaffScanner />;
      }
    }

    return <StudentOverview onNavigate={setCurrentTab} />;
  };

  return (
    <div className="min-h-screen ambient-gradient-bg flex flex-col justify-between">
      <div>
        <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {renderCurrentView()}
        </main>
      </div>

      {/* Footer */}
      <footer
        className="w-full py-5 mt-12 text-xs text-center"
        style={{ borderTop: "1px solid rgba(197,160,89,0.12)", color: "rgba(8,28,21,0.5)" }}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-sm" style={{ color: "var(--obsidian)" }}>
              MESS<span style={{ color: "var(--gold)" }}>MATE</span>
            </span>
            <span>&middot; NMAMIT Hostels, Nitte</span>
          </div>
          <div className="text-[11px]" style={{ color: "rgba(8,28,21,0.4)" }}>
            Session: <strong className="uppercase font-mono" style={{ color: "var(--obsidian)" }}>{role}</strong> &middot; Authenticated
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
