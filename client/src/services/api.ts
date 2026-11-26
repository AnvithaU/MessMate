import { UserRole } from "../types";

export const API_BASE =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "/api"
    : "http://localhost:5000/api";

let authToken = localStorage.getItem("messmate_token") || "";

export function setAuthToken(token: string) {
  authToken = token;
  if (token) {
    localStorage.setItem("messmate_token", token);
  } else {
    localStorage.removeItem("messmate_token");
  }
}

export function getAuthToken(): string {
  return authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const url = endpoint.startsWith("/api")
    ? `${API_BASE}${endpoint.slice(4)}`
    : endpoint;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Cannot reach MessMate backend server (port 5000). Please make sure the server is running."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    request<{ token: string; user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    }),

  register: (payload: {
    fullName: string;
    studentId: string;
    email: string;
    password: string;
    course?: string;
    department?: string;
    roomNumber?: string;
    semester?: number;
    phone?: string;
  }) =>
    request<{ token: string; user: any }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  switchRole: (role: UserRole) =>
    request<{ token: string; user: any }>("/api/auth/switch-role", {
      method: "POST",
      body: JSON.stringify({ role }),
    }),

  getMe: () => request<{ user: any; studentProfile: any }>("/api/auth/me"),

  getDemoUsers: () => request<any>("/api/auth/demo-users"),

  // Student Portal
  getStudentDashboard: () => request<any>("/api/student/dashboard"),

  getMessSelection: (monthYear?: string) =>
    request<any>(`/api/student/mess-selection${monthYear ? `?monthYear=${monthYear}` : ""}`),

  selectMess: (monthYear: string, messId: number) =>
    request<any>("/api/student/mess-selection", {
      method: "POST",
      body: JSON.stringify({ monthYear, messId }),
    }),

  getStudentAddons: (monthYear?: string) =>
    request<any>(`/api/student/addons${monthYear ? `?monthYear=${monthYear}` : ""}`),

  getStudentCalendar: (monthYear?: string) =>
    request<any>(`/api/student/calendar${monthYear ? `?monthYear=${monthYear}` : ""}`),

  submitMonthlyEnrolment: (payload: { monthYear: string; messId: number; addonIds: number[] }) =>
    request<any>("/api/student/enrolment", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  bookAddons: (bookings: Array<{ addonId: number; specificDate: string }>) =>
    request<any>("/api/student/addons/book", {
      method: "POST",
      body: JSON.stringify({ bookings }),
    }),

  getWallet: () => request<any>("/api/student/wallet"),

  getFinancials: () => request<any>("/api/student/financials"),

  getStudentHistory: () => request<any>("/api/student/history"),

  // Mess Staff Scanner
  lookupScan: (params: { qrToken?: string; studentId?: string }) => {
    const query = params.qrToken
      ? `qrToken=${encodeURIComponent(params.qrToken)}`
      : `studentId=${encodeURIComponent(params.studentId || "")}`;
    return request<any>(`/api/scanner/lookup?${query}`);
  },

  redeemBatch: (payload: {
    entitlementIds: number[];
    studentDbId: number;
    scanMethod?: "CAMERA_QR" | "MANUAL_LOOKUP";
    notes?: string;
  }) =>
    request<any>("/api/scanner/redeem-batch", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getStaffHistory: (limit: number = 30) =>
    request<any[]>(`/api/scanner/history?limit=${limit}`),

  getRecentStudents: (limit: number = 5) =>
    request<{ studentId: string; name: string }[]>(`/api/scanner/recent-students?limit=${limit}`),

  // Admin Portal
  getAdminOverview: () => request<any>("/api/admin/overview"),

  getAdminStudents: (search?: string, department?: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (department) params.set("department", department);
    return request<any[]>(`/api/admin/students?${params.toString()}`);
  },

  getStudentProfile: (id: number) => request<any>(`/api/admin/students/${id}/profile`),

  registerStudent: (payload: any) =>
    request<any>("/api/admin/students/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  bulkImportStudents: (studentsList: any[]) =>
    request<any>("/api/admin/students/bulk-import", {
      method: "POST",
      body: JSON.stringify({ studentsList }),
    }),

  overrideMess: (payload: {
    studentDbId: number;
    monthYear: string;
    messId: number;
    overrideReason: string;
  }) =>
    request<any>("/api/admin/mess-override", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAdminMesses: () => request<any>("/api/admin/messes"),

  updateMess: (id: number, payload: any) =>
    request<any>(`/api/admin/messes/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getAdminAddons: () => request<any[]>("/api/admin/addons"),

  updateAddon: (id: number, payload: any) =>
    request<any>(`/api/admin/addons/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getAdminCoupons: (status?: string, date?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (date) params.set("date", date);
    return request<any[]>(`/api/admin/coupons?${params.toString()}`);
  },

  recordPayment: (payload: {
    studentDbId: number;
    semesterId: number;
    amount: number;
    paymentMode: string;
    paymentType: string;
  }) =>
    request<any>("/api/admin/payments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAdminLedger: () => request<any[]>("/api/admin/ledger"),

  setProvisionalAdvance: (payload: {
    studentDbId: number;
    semesterLabel?: string;
    allocatedAmount: number;
    notes?: string;
  }) =>
    request<any>("/api/admin/semester-advances", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAdminRebates: () => request<any[]>("/api/admin/rebates"),

  approveRebate: (id: number, wardenNotes?: string) =>
    request<any>(`/api/admin/rebates/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ wardenNotes }),
    }),

  rejectRebate: (id: number, wardenNotes?: string) =>
    request<any>(`/api/admin/rebates/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ wardenNotes }),
    }),

  executeSettlement: (payload: {
    studentDbId: number;
    semesterId: number;
    refundPaymentReference?: string;
    remarks?: string;
  }) =>
    request<any>("/api/admin/settlement", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAuditLogs: () => request<any[]>("/api/admin/audit-logs"),
};
