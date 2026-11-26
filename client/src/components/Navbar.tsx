import React from "react";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  UtensilsCrossed,
  PlusCircle,
  QrCode,
  Wallet,
  History,
  Home,
  ScanLine,
  Users,
  Building2,
  Package,
  Ticket,
  BookOpen,
  Scale,
  FileText,
  LogOut,
} from "lucide-react";

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

const studentTabs = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "mess-selection", label: "Enrolment", icon: UtensilsCrossed },
  { id: "addons", label: "Add-ons", icon: PlusCircle },
  { id: "wallet", label: "QR Wallet", icon: QrCode },
  { id: "financials", label: "Payments", icon: Wallet },
  { id: "hostel-leave", label: "Hostel Leave", icon: Home },
  { id: "history", label: "History", icon: History },
];

const adminTabs = [
  { id: "admin-overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "admin-students", label: "Students", icon: Users },
  { id: "admin-messes", label: "Messes", icon: Building2 },
  { id: "admin-addons", label: "Add-ons", icon: Package },
  { id: "admin-coupons", label: "Coupons", icon: Ticket },
  { id: "admin-scanner", label: "Scanner", icon: ScanLine },
  { id: "admin-ledger", label: "Ledger", icon: BookOpen },
  { id: "admin-settlement", label: "Settlement", icon: Scale },
  { id: "admin-audit", label: "Audit", icon: FileText },
];

const staffTabs = [
  { id: "staff-scanner", label: "Scanner", icon: ScanLine },
];

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange }) => {
  const { role, user, logout } = useAuth();

  const tabs = role === "admin" ? adminTabs : role === "staff" ? staffTabs : studentTabs;

  return (
    <nav className="glass-nav sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <img
              src="/messmate-n-emblem.png"
              alt="MessMate Emblem"
              className="h-9 w-auto object-contain filter drop-shadow-sm flex-shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
            <div className="flex flex-col justify-center leading-tight">
              <span className="font-serif text-lg font-bold tracking-wider" style={{ color: "var(--obsidian)" }}>
                MESS<span style={{ color: "var(--gold)" }}>MATE</span>
              </span>
              <span className="text-[9px] tracking-widest uppercase font-semibold block" style={{ color: "var(--olive)" }}>
                NMAMIT Hostels
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Role badge */}
            <div
              className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: role === "admin" ? "rgba(197,160,89,0.12)" : role === "staff" ? "rgba(82,121,111,0.12)" : "rgba(8,28,21,0.06)",
                color: role === "admin" ? "var(--gold-dark)" : role === "staff" ? "var(--olive)" : "rgba(8,28,21,0.6)",
              }}
            >
              {role}
            </div>

            {/* User name */}
            <span className="text-xs font-medium hidden sm:block" style={{ color: "rgba(8,28,21,0.6)" }}>
              {user?.fullName}
            </span>

            {/* Sign out */}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                border: "1px solid rgba(8,28,21,0.12)",
                color: "rgba(8,28,21,0.5)",
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 overflow-x-auto pb-0 -mb-px scrollbar-hide">
          {tabs.map((tab) => {
            const active = currentTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all border-b-2 flex-shrink-0"
                style={{
                  borderBottomColor: active ? "var(--gold)" : "transparent",
                  color: active ? "var(--obsidian)" : "rgba(8,28,21,0.45)",
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
