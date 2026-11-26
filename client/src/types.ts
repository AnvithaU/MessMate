export type UserRole = "student" | "admin" | "staff";

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string | null;
  studentId?: string;
  studentDbId?: number;
}

export interface StudentProfile {
  id: number;
  studentId: string;
  department: string;
  semester: number;
  roomNumber: string;
  phone?: string | null;
  qrToken: string;
  qrStatus: "ACTIVE" | "REVOKED";
  fullName?: string;
  email?: string;
  messName?: string;
  messCode?: string;
}

export interface Mess {
  id: number;
  code: "SOUTH" | "NORTH";
  name: string;
  description: string;
  monthlyFee: number;
  cuisineType: string;
  dailyMealCount: number;
  isActive: number;
  imageUrl?: string;
}

export interface MonthlyWindow {
  id: number;
  semesterId: number;
  monthYear: string;
  openDate: string;
  deadlineDate: string;
  lockDate: string;
  isLocked: number;
}

export interface MonthlySelection {
  id: number;
  monthYear: string;
  messId: number;
  feeCharged: number;
  selectedAt: string;
  lockedAt?: string;
  messName?: string;
  messCode?: string;
  cuisineType?: string;
  imageUrl?: string;
  overrideReason?: string;
}

export interface Addon {
  id: number;
  code: string;
  name: string;
  description: string;
  unitPrice: number;
  availableDaysOfWeek: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  maxDailyCapacity: number;
  isActive: number;
  iconName?: string;
}

export interface AddonSelection {
  id: number;
  addonId: number;
  specificDate: string;
  mealSlot: string;
  unitPrice: number;
  status: string;
  selectedAt: string;
  addonName?: string;
  addonCode?: string;
  iconName?: string;
}

export interface EntitlementItem {
  id: number | null;
  itemName: string;
  category: "MESS_MEAL" | "ADDON";
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  status:
    | "AVAILABLE"
    | "REDEEMED"
    | "EXPIRED"
    | "CANCELLED"
    | "NOT_SELECTED"
    | "NOT_AVAILABLE_TODAY"
    | "OUTSIDE_COLLECTION_TIME";
  isSelectableForRedemption: boolean;
  redeemedAt?: string;
  staffName?: string;
  details?: string;
}

export interface LedgerEntry {
  id: number;
  studentId?: string;
  studentName?: string;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  referenceId: string;
  referenceType?: string;
  adjustmentReason?: string;
  createdAt: string;
}

export interface FinancialSummary {
  provisionalAdvance?: number;
  hasVerifiedDeposits?: boolean;
  totalAdvancePaid: number;
  totalCharges: number;
  totalMessCharges: number;
  totalAddonCharges: number;
  totalRefunds?: number;
  availableBalance: number;
  outstandingAmount: number;
  netBalance: number;
  ledgerReconstructedBalance?: number;
  isSettled: boolean;
  settlementRecord?: any;
  payments?: any[];
  messSelections?: any[];
  addonCount?: number;
  ledgerEntries?: LedgerEntry[];
}
